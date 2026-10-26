import test from 'node:test'
import assert from 'node:assert/strict'
import { handleProjectsCall, validatePayload } from '../rpc.js'
import { __test__ } from '../index.js'

test('validates required project and message fields', () => {
  assert.equal(validatePayload('createProject', {}).ok, false)
  assert.equal(validatePayload('appendMessage', { chatId: 'c' }).ok, false)
  assert.equal(validatePayload('listProjects', {}), undefined)
})

test('creates project/chat/message idempotently', async () => {
  const holder = __test__.createService()
  await holder.init('/tmp/dsh-projects-collab-test-do-not-use')
  const projectCall = await handleProjectsCall(holder.service, 'createProject', { name: 'Demo', idempotencyKey: 'p1' })
  assert.equal(projectCall.ok, true)
  const duplicate = await handleProjectsCall(holder.service, 'createProject', { name: 'Demo', idempotencyKey: 'p1' })
  assert.equal(duplicate.value.id, projectCall.value.id)
  const chat = await handleProjectsCall(holder.service, 'createChat', { projectId: projectCall.value.id, name: 'Team', idempotencyKey: 'c1' })
  assert.equal(chat.ok, true)
  const message = await handleProjectsCall(holder.service, 'appendMessage', { chatId: chat.value.id, body: 'hello', idempotencyKey: 'm1' })
  assert.equal(message.ok, true)
})
