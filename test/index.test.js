const LockFile = require('..')
const test = require('brittle')
const tmp = require('test-tmp')
const path = require('path')

test('lock and unlock', async (t) => {
  const tmpDir = await tmp()

  const lock = new LockFile(path.join(tmpDir, 'lock'))

  t.ok(lock.fd === 0)
  t.ok(!lock.locked)

  await lock.lock()

  t.ok(lock.fd !== 0)
  t.ok(lock.locked)

  await lock.unlock()

  t.ok(lock.fd === 0)
  t.ok(!lock.locked)
})

test('try to lock without busy lockfile', async (t) => {
  t.plan(1)
  const tmpDir = await tmp()
  const lockA = new LockFile(path.join(tmpDir, 'lock'))
  const lockB = new LockFile(path.join(tmpDir, 'lock'), { wait: false })

  await lockA.lock()
  t.exception(async () => await lockB.lock())
})

test('wait for lock', async (t) => {
  t.plan(2)
  const tmpDir = await tmp()
  const lockA = new LockFile(path.join(tmpDir, 'lock'))
  const lockB = new LockFile(path.join(tmpDir, 'lock'), { wait: true })

  await lockA.lock()

  setTimeout(async () => await lockA.unlock(), 1000)

  await lockB.lock()

  t.ok(!lockA.locked)
  t.ok(lockB.locked)
})
