import LockFile from './index.js'

const l = new LockFile('/tmp/lock')

await l.lock()

await new Promise(resolve => setTimeout(resolve, 30_000))

await l.unlock()
