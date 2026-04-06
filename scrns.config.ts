import type { Config } from 'scrns'

const selector = '.maplibregl-canvas'
const width = 1200
const height = 800
const preScreenshotSleep = 5000

const config: Config = {
  screenshots: {
    'hbt-ferry': {
      query: '?ex=hbt&sp=1&o=0.75&llz=40.7450_-74.0150_14.00',
      selector, width, height, preScreenshotSleep,
    },
    'hbt-ferry-graph': {
      query: '?ex=hbt&sp=1&o=0.75&llz=40.7450_-74.0150_14.00&graph=1&nodes=1',
      selector, width, height, preScreenshotSleep,
    },
    'simple-flow': {
      query: '?ex=ferry&sp=1&o=0.75&llz=40.7350_-74.0300_13.50',
      selector, width, height, preScreenshotSleep,
    },
    'simple-flow-debug': {
      query: '?ex=ferry&sp=1&o=0.75&llz=40.7350_-74.0300_13.50&ring=1&graph=1&nodes=1',
      selector, width, height, preScreenshotSleep,
    },
  },
}

export default config
