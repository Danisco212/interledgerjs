import EventEmitter3 = require('eventemitter3')
import * as Debug from 'debug'
import BigNumber from 'bignumber.js'
import 'source-map-support/register'

export interface MoneyStreamOpts {
  id: number,
  isServer: boolean
}

export class MoneyStream extends EventEmitter3 {
  protected id: number
  protected debug: Debug.IDebugger
  protected isServer: boolean

  protected _amountIncoming: BigNumber
  protected _amountOutgoing: BigNumber
  protected closed: boolean
  protected holds: { [id: string]: BigNumber }

  constructor (opts: MoneyStreamOpts) {
    super()
    this.id = opts.id
    this.isServer = opts.isServer
    this.debug = Debug(`ilp-protocol-stream:${this.isServer ? 'Server' : 'Client'}:MoneyStream:${this.id}`)

    this._amountIncoming = new BigNumber(0)
    this._amountOutgoing = new BigNumber(0)
    this.closed = false
    this.holds = {}
  }

  get amountIncoming (): BigNumber {
    return new BigNumber(this._amountIncoming)
  }

  get amountOutgoing (): BigNumber {
    return new BigNumber(this._amountOutgoing)
  }

  close (): void {
    this.emit('close')
    this.closed = true
  }

  isClosed (): boolean {
    return this.closed
  }

  /**
   * Add money to the stream
   *
   * @param amount Amount to send
   */
  send (amount: BigNumber.Value): void {
    if (this.closed) {
      throw new Error('Stream already closed')
    }

    this._amountOutgoing = this._amountOutgoing.plus(amount)
    this.debug(`send: ${amount} (amountOutgoing: ${this._amountOutgoing})`)
    this.emit('_send')
  }

  /**
   * Take money out of the stream
   *
   * @param amount Amount to receive. If unspecified, it will return the full amount available
   */
  receive (amount?: BigNumber.Value): BigNumber {
    const amountToReceive = new BigNumber(amount || this._amountIncoming)

    // The user can call receive to pull money out of the stream that they previously sent,
    // in addition to money they've received from the other party
    const amountAvailable = this._amountIncoming.plus(this._amountOutgoing)
    if (amountToReceive.isGreaterThan(amountAvailable)) {
      throw new Error(`Cannot receive ${amount}, only ${amountAvailable} available`)
    }

    this._amountIncoming = this._amountIncoming.minus(amountToReceive)
    if (this._amountIncoming.isNegative()) {
      this._amountOutgoing = this._amountOutgoing.plus(this._amountIncoming)
      this._amountIncoming = new BigNumber(0)
    }

    this.debug(`receive: ${amountToReceive} (amountIncoming: ${this._amountIncoming}, amountOutgoing: ${this._amountOutgoing})`)

    return amountToReceive
  }

  async flushed (): Promise<void> {
    if (this._amountOutgoing.isEqualTo(0)) {
      return Promise.resolve()
    }

    // TODO should this only wait for the current amount to be sent, rather than any additional added after?
    return new Promise((resolve, reject) => {
      const self = this
      function outgoingHandler () {
        if (self._amountOutgoing.isEqualTo(0) && Object.keys(self.holds).length === 0) {
          cleanup()
          resolve()
        }
      }
      function errorHandler (err: Error) {
        cleanup()
        reject(err)
      }
      function cleanup () {
        self.removeListener('outgoing', outgoingHandler)
        self.removeListener('error', errorHandler)
      }

      this.on('outgoing', outgoingHandler)
      this.once('error', errorHandler)
    }) as Promise<void>
  }

  /**
   * (Internal) Add money to the stream (from an external source)
   * @private
   */
  _addToIncoming (amount: BigNumber): void {
    this._amountIncoming = this._amountIncoming.plus(amount)
    this.debug(`added money to stream from external source: ${amount} (amountIncoming: ${this._amountIncoming})`)
    this.emit('incoming', amount.toString())
  }

  /**
   * (Internal) Hold outgoing balance
   * @private
   */
  _holdOutgoing (holdId: string, maxAmount?: BigNumber): BigNumber {
    const amountToReceive = (maxAmount === undefined ? this._amountOutgoing : BigNumber.minimum(maxAmount, this._amountOutgoing))
    if (amountToReceive.isGreaterThan(0)) {
      this._amountOutgoing = this._amountOutgoing.minus(amountToReceive)
      this.holds[holdId] = amountToReceive
      this.debug(`holding outgoing balance. holdId: ${holdId}, amount: ${amountToReceive}`)
    }
    return amountToReceive
  }

  /**
   * (Internal) Execute hold when money has been successfully transferred
   * @private
   */
  _executeHold (holdId: string): void {
    if (!this.holds[holdId]) {
      return
    }
    const amount = this.holds[holdId].toString()
    delete this.holds[holdId]
    this.debug(`executed holdId: ${holdId} for: ${amount}`)
    this.emit('outgoing', amount)
  }

  /**
   * (Internal) Cancel hold if sending money failed
   * @private
   */
  _cancelHold (holdId: string): void {
    if (!this.holds[holdId]) {
      return
    }
    this.debug(`cancelled holdId: ${holdId} for: ${this.holds[holdId]}`)
    this._amountOutgoing = this._amountOutgoing.plus(this.holds[holdId])
    delete this.holds[holdId]
  }
}
