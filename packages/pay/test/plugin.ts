import { DataHandler, MoneyHandler, PluginInstance } from 'ilp-connector/dist/types/plugin'
import { EventEmitter } from 'events'
import { Plugin } from 'ilp-protocol-stream/dist/src/util/plugin-interface'
import { sleep } from '../src/utils'

// TODO Normal distribution
// TODO Cite this: https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
const getRandomFloat = (min: number, max: number): number => {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random() // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random()
  let num = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  num = num / 10 + 0.5 // Translate to 0 -> 1
  if (num > 1 || num < 0) return getRandomFloat(min, max) // resample between 0 and 1
  num *= max - min
  num += min
  return num
}

const defaultDataHandler = async () => {
  throw new Error('No data handler registered')
}

const defaultMoneyHandler = () => {
  throw new Error('No money handler registered')
}

export class MirrorPlugin extends EventEmitter implements Plugin, PluginInstance {
  private connected = false

  public mirror?: MirrorPlugin

  public dataHandler: DataHandler = defaultDataHandler
  public moneyHandler: MoneyHandler = defaultMoneyHandler

  private readonly minNetworkLatency: number
  private readonly maxNetworkLatency: number

  private readonly minSettlementLatency: number
  private readonly maxSettlementLatency: number

  constructor(
    minNetworkLatency = 10,
    maxNetworkLatency = 50,
    minSettlementLatency = 3000,
    maxSettlementLatency = 6000
  ) {
    super()
    this.minNetworkLatency = minNetworkLatency
    this.maxNetworkLatency = maxNetworkLatency
    this.minSettlementLatency = minSettlementLatency
    this.maxSettlementLatency = maxSettlementLatency
  }

  static createPair(
    minNetworkLatency?: number,
    maxNetworkLatency?: number
  ): [MirrorPlugin, MirrorPlugin] {
    const pluginA = new MirrorPlugin(minNetworkLatency, maxNetworkLatency)
    const pluginB = new MirrorPlugin(minNetworkLatency, maxNetworkLatency)

    pluginA.mirror = pluginB
    pluginB.mirror = pluginA

    return [pluginA, pluginB]
  }

  async connect() {
    this.connected = true
  }

  async disconnect() {
    this.connected = false
  }

  isConnected() {
    return this.connected
  }

  async sendData(data: Buffer) {
    if (this.mirror && this.connected) {
      await this.addNetworkDelay()
      const response = await this.mirror.dataHandler(data)
      await this.addNetworkDelay()
      return response
    } else {
      throw new Error('Not connected')
    }
  }

  registerDataHandler(handler: DataHandler) {
    this.dataHandler = handler
  }

  deregisterDataHandler() {
    this.dataHandler = defaultDataHandler
  }

  async sendMoney(amount: string) {
    if (this.mirror && this.connected) {
      await this.addSettlementDelay()
      await this.mirror.moneyHandler(amount)
    } else {
      throw new Error('Not connected')
    }
  }

  registerMoneyHandler(handler: MoneyHandler) {
    this.moneyHandler = handler
  }

  deregisterMoneyHandler() {
    this.moneyHandler = defaultMoneyHandler
  }

  private async addNetworkDelay() {
    await sleep(getRandomFloat(this.minNetworkLatency, this.maxNetworkLatency))
  }

  private async addSettlementDelay() {
    await sleep(getRandomFloat(this.minSettlementLatency, this.maxSettlementLatency))
  }
}