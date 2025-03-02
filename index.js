const fsx = require('fs-native-extensions')
const fs = require('fs')
const path = require('path')

// needed as fd locks are process wide...
const LOCKS = new Map()

module.exports = class LockFile {
  constructor (filename) {
    this.filename = path.resolve(filename)
    this.fd = 0
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

  async _lock () {
    const fd = await open(this.filename)

    try {
      if (this.closed) throw new Error('Lock is closed')
      const existing = LOCKS.get(this.filename)
      if (existing && existing !== this) throw new Error('ELOCKED: ' + this.filename)
      if (!fsx.tryLock(fd)) throw new Error('ELOCKED: ' + this.filename)
    } catch (err) {
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
