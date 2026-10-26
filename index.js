import os from 'node:os'
import path from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { registerProjectsRoute } from './rpc.js'

export const inject = ['connection']

const MAX_AUDIT = 2000
const OWNER_ID = 'owner'

function emptyState() {
  return { version: 1, projects: [], members: [], chats: [], messages: [], invites: [], audit: [], idempotency: {} }
}
function trimText(value, max) { return String(value ?? '').trim().slice(0, max) }
function now() { return new Date().toISOString() }
function newId(prefix) { return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 18)}` }
function normalize(raw) {
  const state = emptyState()
  if (!raw || typeof raw !== 'object') return state
  for (const key of ['projects', 'members', 'chats', 'messages', 'invites', 'audit']) if (Array.isArray(raw[key])) state[key] = raw[key]
  if (raw.idempotency && typeof raw.idempotency === 'object') state.idempotency = raw.idempotency
  return state
}

function createService() {
  const state = emptyState()
  let ready = Promise.resolve()
  let writeChain = Promise.resolve()
  let filePath
  let loadError
  const audit = (action, data = {}) => {
    state.audit.push({ id: newId('audit'), action, at: now(), actorId: OWNER_ID, ...data })
    if (state.audit.length > MAX_AUDIT) state.audit.splice(0, state.audit.length - MAX_AUDIT)
  }
  const persist = () => {
    writeChain = writeChain.then(async () => {
      if (!filePath) return
      await mkdir(path.dirname(filePath), { recursive: true })
      const temp = `${filePath}.${process.pid}.tmp`
      await writeFile(temp, JSON.stringify(state, null, 2), 'utf8')
      await rename(temp, filePath)
    })
    return writeChain
  }
  const ensureLoaded = async () => {
    await ready
    if (loadError) throw loadError
  }
  const project = (id) => state.projects.find((row) => row.id === id)
  const chat = (id) => state.chats.find((row) => row.id === id)
  const member = (projectId, userId = OWNER_ID) => state.members.find((row) => row.projectId === projectId && row.userId === userId)
  const requireAccess = (projectId, userId = OWNER_ID, write = false) => {
    if (!project(projectId)) { const error = new Error('Project not found.'); error.code = 'projects/not-found'; throw error }
    const row = member(projectId, userId)
    if (!row) { const error = new Error('You are not a member of this project.'); error.code = 'projects/forbidden'; throw error }
    if (write && !['owner', 'admin', 'member'].includes(row.role)) { const error = new Error('Your project role cannot perform this action.'); error.code = 'projects/forbidden'; throw error }
    return row
  }
  const idem = (key) => typeof key === 'string' && key.length > 0 && key.length <= 160 ? state.idempotency[key] : undefined
  const remember = (key, value) => { if (typeof key === 'string' && key.length > 0 && key.length <= 160) state.idempotency[key] = value }
  const service = {
    async listProjects() {
      await ensureLoaded()
      return state.projects.map((row) => ({ ...row, memberCount: state.members.filter((m) => m.projectId === row.id).length, chatCount: state.chats.filter((c) => c.projectId === row.id).length }))
    },
    async createProject(input) {
      await ensureLoaded()
      const key = trimText(input.idempotencyKey, 160)
      const existing = idem(key)
      if (existing) return existing
      const row = { id: newId('project'), name: trimText(input.name, 120), description: trimText(input.description, 500), createdAt: now(), updatedAt: now() }
      state.projects.push(row)
      state.members.push({ id: newId('member'), projectId: row.id, userId: OWNER_ID, displayName: 'You', role: 'owner', joinedAt: now() })
      audit('project.created', { projectId: row.id })
      remember(key, row)
      await persist()
      return row
    },
    async listChats(input) {
      await ensureLoaded(); requireAccess(input.projectId)
      return state.chats.filter((row) => row.projectId === input.projectId).map((row) => ({ ...row, messageCount: state.messages.filter((m) => m.chatId === row.id).length }))
    },
    async createChat(input) {
      await ensureLoaded(); requireAccess(input.projectId, input.actorId, true)
      const key = trimText(input.idempotencyKey, 160); const existing = idem(key); if (existing) return existing
      const row = { id: newId('chat'), projectId: input.projectId, name: trimText(input.name, 120), createdAt: now(), updatedAt: now() }
      state.chats.push(row); audit('chat.created', { projectId: row.projectId, chatId: row.id }); remember(key, row); await persist(); return row
    },
    async appendMessage(input) {
      await ensureLoaded(); const target = chat(input.chatId)
      if (!target) { const error = new Error('Chat not found.'); error.code = 'projects/not-found'; throw error }
      requireAccess(target.projectId, input.actorId, true)
      const key = trimText(input.idempotencyKey, 160); const existing = idem(key); if (existing) return existing
      const row = { id: newId('message'), chatId: target.id, authorId: trimText(input.actorId, 120) || OWNER_ID, body: trimText(input.body, 12000), createdAt: now() }
      state.messages.push(row); target.updatedAt = now(); audit('message.appended', { projectId: target.projectId, chatId: target.id, messageId: row.id }); remember(key, row); await persist(); return row
    },
    async listMembers(input) { await ensureLoaded(); requireAccess(input.projectId); return state.members.filter((row) => row.projectId === input.projectId) },
    async addMember(input) {
      await ensureLoaded(); const actor = requireAccess(input.projectId, input.actorId, true)
      if (!['owner', 'admin'].includes(actor.role)) { const error = new Error('Only project owners or admins can add members.'); error.code = 'projects/forbidden'; throw error }
      const userId = trimText(input.userId, 120); const found = member(input.projectId, userId); if (found) return found
      const row = { id: newId('member'), projectId: input.projectId, userId, displayName: trimText(input.displayName || userId, 120), role: input.role || 'member', joinedAt: now() }
      state.members.push(row); state.invites.push({ id: newId('invite'), projectId: input.projectId, userId, status: 'accepted', createdAt: now() }); audit('member.added', { projectId: input.projectId, userId }); await persist(); return row
    },
    async audit(input) { await ensureLoaded(); if (input.projectId) requireAccess(input.projectId); return state.audit.slice(-Math.min(Math.max(Number(input.limit) || 50, 1), 200)).reverse() },
  }
  return {
    async init(target) {
      filePath = path.join(target, 'projects-collab.json')
      ready = readFile(filePath, 'utf8').then((text) => Object.assign(state, normalize(JSON.parse(text)))).catch((error) => {
        if (error?.code !== 'ENOENT') loadError = error
      })
      await ready
    },
    service,
    state,
  }
}

export function apply(ctx) {
  const holder = createService()
  const home = process.env.DSH_HOME?.trim() || path.join(os.homedir(), '.dsh')
  let disposeRoute
  ctx.effect(() => {
    void holder.init(home).catch((error) => { try { ctx.logger?.error?.(error, 'projects-collab init failed') } catch {} })
    disposeRoute = registerProjectsRoute(ctx, holder.service)
    return () => { try { disposeRoute?.() } catch {} }
  })
}

export const __test__ = { createService, normalize }
