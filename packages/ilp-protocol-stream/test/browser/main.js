// This code is executed within Chromium by Puppeteer.

const IlpPluginBtp = require('ilp-plugin-btp')
const { createConnection, Connection } = require('../..')

// Use a wrapper function, because for some reason attaching `Client` to `window`
// loses the constructor so the test can't use it.
async function makeStreamClient(btpOpts, opts) {
  const clientPlugin = new IlpPluginBtp(btpOpts)
  return await createConnection({
    plugin: clientPlugin,
    destinationAccount: opts.destinationAccount,
    sharedSecret: Buffer.from(opts.sharedSecret, 'base64'),
    slippage: 0,
  })
}

window.makeStreamClient = makeStreamClient
window.runCryptoTests = require('../crypto.spec').runCryptoTests
