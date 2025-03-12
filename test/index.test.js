const LockFile = require('..')
const test = require('brittle')
const tmp = require('test-tmp')
const Hypercore = require('hypercore')
const path = require('path')

test('lock and unlock', async (t) => {
  const tmpDir = await tmp()

  const lock = new LockFile(path.join(tmpDir, 'LOCK'))

  t.ok(lock.fd === 0)
  t.ok(!lock.locked)

  await lock.lock()

  t.ok(lock.fd !== 0)
  t.ok(lock.locked)

  await lock.unlock()

  t.ok(lock.fd === 0)
  t.ok(!lock.locked)
})

test('if not waited, it cant use busy lock', async (t) => {
  t.plan(1)
  const tmpDir = await tmp()
  const core = new Hypercore(tmpDir)
  await core.ready()

  const lock = new LockFile(path.join(tmpDir, 'LOCK'))

  core.close()
  t.exception(async () => {
    await lock.lock()
  })
})

test('wait for freed RocksDB lock', async (t) => {
  const tmpDir = await tmp()
  const core = new Hypercore(tmpDir)
  await core.ready()

  const lock = new LockFile(path.join(tmpDir, 'LOCK'))
  const unlocked = lock.wait()
  core.close()
  await unlocked
  await lock.lock()

  t.ok(lock.fd !== 0)
  t.ok(lock.locked)
})
