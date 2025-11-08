const fsx = require('fs-native-extensions')
const fs = require('fs')
const path = require('path')
const onexit = require('resource-on-exit')

// needed as fd locks are process wide...
const LOCKS = new Map()

module.exports = class LockFile {
  constructor (filename, { wait = false } = {}) {
    this.filename = path.resolve(filename)
    this.fd = 0
    this.wait = wait
    this.locked = false
    this.locking = null
    this.opening = null
    this.closed = false
  }

  _open () {
    if (this.opening) return this.opening
    this.opening = this._openFile()
    return this.opening
  }

  async lock () {
    if (this.locking) return this.locking
    if (this.locked) return

    try {
      this.locking = this._lock()
      await this.locking
    } catch (err) {
      this.locking = null
      throw err
    }
  }

  _tryLock (fd) {
    const existing = LOCKS.get(this.filename)
    if (existing && existing !== this) return false
    if (!fsx.tryLock(fd)) return false
    return true
  }

  async _lock () {
    const fd = await open(this.filename)
    onexit.add(this, closeSync)

    try {
      while (true) {
        if (this.closed) throw new Error('Lock is closed')
        if (this._tryLock(fd)) break
        if (!this.wait) throw new Error('ELOCKED: ' + this.filename)
        // TODO: move away from a poll to waitForLock
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (err) {
      onexit.remove(this)
      await close(fd)
      throw err
    }

    this.fd = fd
    this.locked = true
    LOCKS.set(this.filename, this)
  }

  async unlock () {
    try {
      await this.locking
    } catch {}

    if (LOCKS.get(this.filename) !== this) return

    const fd = this.fd
    LOCKS.delete(this.filename)
    this.fd = 0
    this.locked = false
    onexit.remove(this)
    await close(fd)
  }
}

function open (filename) {
  return new Promise((resolve, reject) => {
    fs.open(filename, 'w', (err, fd) => {
      if (err) return reject(err)
      resolve(fd)
    })
  })
}

function close (fd) {
  return new Promise(resolve => {
    fs.close(fd, () => resolve())
  })
}

function closeSync (lock) {
  const fd = lock.fd
  if (!fd) return
  lock.fd = 0
  fs.closeSync(fd)
}
