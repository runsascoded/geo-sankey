import type { Config } from 'scrns'

const base = 'http://localhost:7251'
const selector = '.maplibregl-canvas'
const width = 800
const height = 600
const sleep = 3000 // wait for map tiles to load

// Bezier junction scenarios at different fix modes
const bjModes = [
  { s: 'bzr-default', label: 'bj-default' },
  { s: 'bzr-shared', label: 'bj-miter' },
  { s: 'bzr-bearing', label: 'bj-exact-bearing' },
  { s: 'bzr-both', label: 'bj-steps-2-3' },
]

// Rectangle scenarios
const rectModes = [
  { s: 'rect-exact', label: 'rect-shared' },
  { s: 'rect-gap', label: 'rect-gap' },
  { s: 'rect-single', label: 'rect-single' },
]

// Merge scenarios
const mergeModes = [
  { s: 'merge-multi', label: 'merge-multi' },
  { s: 'merge-single', label: 'merge-single' },
]

const opacities = ['0.50', '1.00']
const llz = '40.7300_-74.0350_15.00'

const config: Config = {
  screenshots: [
    // Bezier junctions at 50% opacity, all 4 fix modes
    ...bjModes.map(m => ({
      name: `seam-test/${m.label}`,
      url: `${base}/?ex=seam-test&s=${m.s}&o=0.50&llz=${llz}`,
      selector, width, height, sleep,
    })),
    // Bezier junctions at 50% opacity with low BPL (n=6) to show chunky sampling
    ...bjModes.map(m => ({
      name: `seam-test/${m.label}-n6`,
      url: `${base}/?ex=seam-test&s=${m.s}&o=0.50&n=6&llz=${llz}`,
      selector, width, height, sleep,
    })),
    // Rectangles at 50% opacity
    ...rectModes.map(m => ({
      name: `seam-test/${m.label}`,
      url: `${base}/?ex=seam-test&s=${m.s}&o=0.50&llz=40.7300_-74.0350_15.50`,
      selector, width, height, sleep,
    })),
    // Merge at 50% opacity
    ...mergeModes.map(m => ({
      name: `seam-test/${m.label}`,
      url: `${base}/?ex=seam-test&s=${m.s}&o=0.50&llz=${llz}`,
      selector, width, height, sleep,
    })),
    // Flow tree merge example (single-poly mode)
    {
      name: 'flow-tree-merge',
      url: `${base}/?ex=multi-tree`,
      selector, width, height, sleep,
    },
  ],
}

export default config
