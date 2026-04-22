import puppeteer, { Browser, Page } from 'puppeteer-core'

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const BASE_URL = process.env.GS_BASE_URL ?? 'http://localhost:7251'

export async function launch(): Promise<Browser> {
  return puppeteer.launch({
    headless: process.env.HEADFUL ? false : true,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
}

/** Load the Simple Flow example in edit mode with the Origin node selected. */
export async function openEditMode(browser: Browser, opts: { nodeId?: string } = {}): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width: 1200, height: 800 })
  await page.evaluateOnNewDocument((sel) => {
    sessionStorage.setItem('geo-sankey-edit', '1')
    if (sel) sessionStorage.setItem('geo-sankey-sel', JSON.stringify({ type: 'node', id: sel }))
  }, opts.nodeId ?? '')
  await page.goto(`${BASE_URL}/?ex=ferry&nodes=2&llz=40.7350_-74.0300_13.50`)
  await waitForMap(page)
  return page
}

export async function waitForMap(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(() => {
    const gs = (window as any).__geoSankey
    return gs && gs.mapRef?.current?.getMap?.()
  }, { timeout })
  await new Promise(r => setTimeout(r, 500))
}

export async function getNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__geoSankey?.graph?.nodes?.length ?? -1)
}

export async function getNode(page: Page, id: string): Promise<any> {
  return page.evaluate((nodeId) => {
    const g = (window as any).__geoSankey?.graph
    return g?.nodes?.find((n: any) => n.id === nodeId) ?? null
  }, id)
}

export async function getHistoryLengths(page: Page): Promise<{ past: number; future: number }> {
  return page.evaluate(() => {
    const gs = (window as any).__geoSankey
    return { past: gs?.pastLen ?? 0, future: gs?.futureLen ?? 0 }
  })
}

export async function undoViaApi(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__geoSankey?.undo?.())
  await new Promise(r => setTimeout(r, 150))
}

export async function redoViaApi(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__geoSankey?.redo?.())
  await new Promise(r => setTimeout(r, 150))
}

/** Set the selection directly via the test hook. */
export async function setSelectionsViaApi(page: Page, refs: any[]): Promise<void> {
  await page.evaluate((r) => (window as any).__geoSankey?.setSelections?.(r), refs)
  await new Promise(r => setTimeout(r, 150))
}

/** Project a node's LL to VIEWPORT pixel coords (accounting for canvas offset). */
export async function projectNode(page: Page, id: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((nodeId) => {
    const gs = (window as any).__geoSankey
    const map = gs?.mapRef?.current?.getMap?.()
    const node = gs?.graph?.nodes?.find((n: any) => n.id === nodeId)
    if (!map || !node) return null
    const pt = map.project([node.pos[1], node.pos[0]]) // [lng, lat] → canvas px
    const canvas = map.getCanvas() as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    return { x: pt.x + rect.left, y: pt.y + rect.top }
  }, id)
}

export async function getSelectedBearing(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const els = document.querySelectorAll('.map-container div[style]')
    for (const el of els) {
      const txt = (el as HTMLElement).textContent ?? ''
      // The "NN°" label next to the rotation handle
      if (/^\d+°$/.test(txt)) return txt
    }
    return null
  })
}

export async function getRotHandlePos(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    const divs = document.querySelectorAll('.map-container div[style]')
    for (const d of divs) {
      const style = (d as HTMLElement).style
      if (style.cursor === 'grab' && style.borderRadius === '50%') {
        const r = (d as HTMLElement).getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }
    }
    return null
  })
}

/** Tangent handle (unified bearing+velocity). Same as rotation handle
 *  since they're now merged into one circle. */
export const getVelHandlePos = getRotHandlePos

/** Midpoint of the first edge's centerline in viewport pixel coords. */
export async function getEdgeMidpoint(page: Page, from: string, to: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((f, t) => {
    const gs = (window as any).__geoSankey
    const map = gs?.mapRef?.current?.getMap?.()
    if (!map) return null
    const src = map.getSource('edge-centerlines') as any
    if (!src?._data) return null
    const feat = src._data.features.find((x: any) => x.properties?.from === f && x.properties?.to === t)
    if (!feat) return null
    const coords = feat.geometry.coordinates as [number, number][]
    const mid = coords[Math.floor(coords.length / 2)]
    const pt = map.project(mid as any)
    const rect = (map.getCanvas() as HTMLCanvasElement).getBoundingClientRect()
    return { x: pt.x + rect.left, y: pt.y + rect.top }
  }, from, to)
}

export async function getSelections(page: Page): Promise<any[]> {
  return page.evaluate(() => (window as any).__geoSankey?.selections ?? [])
}

export async function getNodeVelocity(page: Page, id: string): Promise<number | null | undefined> {
  return page.evaluate((nodeId) => {
    const g = (window as any).__geoSankey?.graph
    const n = g?.nodes?.find((x: any) => x.id === nodeId)
    return n?.velocity
  }, id)
}

export async function isSelected(page: Page, nodeId: string): Promise<boolean> {
  return page.evaluate((id) => {
    const stored = sessionStorage.getItem('geo-sankey-sel')
    if (!stored) return false
    try {
      const s = JSON.parse(stored)
      // Back-compat: selection may be stored as a single ref or an array of refs.
      const arr = Array.isArray(s) ? s : s ? [s] : []
      return arr.some((r: any) => r?.type === 'node' && r?.id === id)
    } catch { return false }
  }, nodeId)
}

/** Map-canvas click (single-click = select/deselect in edit mode). */
export async function mapClick(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.click(x, y)
  await new Promise(r => setTimeout(r, 200))
}

export async function mapDblClick(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.click(x, y, { clickCount: 2 })
  await new Promise(r => setTimeout(r, 200))
}
