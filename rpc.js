export const RPC_ENDPOINT = 'projects-collab'

const METHODS = new Set([
  'listProjects', 'createProject', 'listChats', 'createChat', 'appendMessage',
  'listMembers', 'addMember', 'audit',
])

export function ok(value) { return { ok: true, value } }
export function fail(code, message, details = {}) {
  return { ok: false, error: { code, message, details } }
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function validatePayload(method, payload) {
  if (!METHODS.has(method)) return fail('projects/unknown-method', 'Unknown Projects operation.')
  if (!isRecord(payload)) return fail('projects/invalid-input', 'Payload must be an object.')
  const stringFields = {
    listChats: ['projectId'], createChat: ['projectId'], appendMessage: ['chatId', 'body'],
    listMembers: ['projectId'], addMember: ['projectId', 'userId'],
  }
  for (const field of stringFields[method] || []) {
    if (typeof payload[field] !== 'string' || payload[field].trim() === '') {
      return fail('projects/invalid-input', `${field} is required.`)
    }
  }
  if (method === 'createProject' && (typeof payload.name !== 'string' || payload.name.trim() === '')) {
    return fail('projects/invalid-input', 'name is required.')
  }
  if (method === 'createChat' && (typeof payload.name !== 'string' || payload.name.trim() === '')) {
    return fail('projects/invalid-input', 'name is required.')
  }
  if (method === 'addMember' && payload.role !== undefined && !['owner', 'admin', 'member', 'viewer'].includes(payload.role)) {
    return fail('projects/invalid-input', 'role is invalid.')
  }
  if (method === 'appendMessage' && payload.body.length > 12000) return fail('projects/invalid-input', 'Message is too long.')
  return undefined
}

export async function handleProjectsCall(service, method, payload, signal) {
  const invalid = validatePayload(method, payload)
  if (invalid) return invalid
  if (signal?.aborted) return fail('projects/aborted', 'Request was cancelled.')
  try {
    const value = await service[method](payload || {})
    return ok(value)
  } catch (error) {
    return fail(error?.code || 'projects/failed', error?.message || 'Projects operation failed.')
  }
}

export function registerProjectsRoute(ctx, service) {
  if (typeof ctx.connection?.fetch?.register !== 'function') throw new Error('Host connection fetch registry unavailable.')
  return ctx.connection.fetch.register({
    path: `/api/${RPC_ENDPOINT}`,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
      const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
      if (contentType !== 'application/json') return new Response('content type must be application/json', { status: 415 })
      const length = Number(request.headers.get('content-length') || 0)
      if (Number.isFinite(length) && length > 128 * 1024) return Response.json({ ok: false, error: { code: 'projects/payload-too-large', message: 'Payload too large.', details: {} } }, { status: 413 })
      let message
      try { message = await request.json() } catch { return Response.json({ ok: false, error: { code: 'projects/bad-request', message: 'Request is not JSON.', details: {} } }, { status: 400 }) }
      const rpcId = typeof message?.rpcId === 'string' ? message.rpcId : 'invalid-request'
      const call = message?.payload
      if (!isRecord(message) || message.type !== 'client-request' || typeof message.rpcId !== 'string' || message.method !== RPC_ENDPOINT || !isRecord(call) || typeof call.method !== 'string') {
        return Response.json({ type: 'server-response', rpcId, result: fail('projects/bad-request', 'Request format is invalid.') }, { status: 400 })
      }
      // The browser connection is authenticated as the local owner. Never trust an actorId supplied by the UI.
      const payload = isRecord(call.payload) ? { ...call.payload, actorId: 'owner' } : call.payload
      const result = await handleProjectsCall(service, call.method, payload, request.signal)
      return Response.json({ type: 'server-response', rpcId, result })
    },
  })
}
