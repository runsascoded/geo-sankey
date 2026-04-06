import type { ScreenshotsMap } from 'scrns'

const selector = '.maplibregl-canvas'
const width = 1200
const preScreenshotSleep = 5000

const config: ScreenshotsMap = {
  'hbt-ferry': {
    query: '?ex=hbt&sp=1&o=0.85&nodes=1&llz=40.7415_-74.0180_12.60',
    selector, width: 900, height: 1100, preScreenshotSleep,
  },
  'simple-flow-debug': {
    query: '?ex=ferry&sp=1&o=0.75&llz=40.7350_-74.0300_13.50&ring=1&graph=1&nodes=2',
    selector, width, height: 800, preScreenshotSleep,
  },
}

export default config
