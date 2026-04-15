import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest'
import type { Browser, Page } from 'puppeteer-core'
import {
  launch,
  openEditMode,
  getNodeCount,
  getNode,
  getHistoryLengths,
  projectNode,
  getSelectedBearing,
  getRotHandlePos,
  getVelHandlePos,
  getEdgeMidpoint,
  getNodeVelocity,
  getSelections,
  getSelectedLabel,
  isSelected,
  mapClick,
  mapDblClick,
  undoViaApi,
  redoViaApi,
  setSelectionsViaApi,
} from './helpers'

let browser: Browser
let page: Page

beforeAll(async () => { browser = await launch() }, 30_000)
afterAll(async () => { await browser?.close() })

beforeEach(async () => {
  page = await openEditMode(browser, { nodeId: 'origin' })
}, 30_000)
afterEach(async () => { await page?.close() })

describe('selection', () => {
  it('shows overlay label for selected node', async () => {
    const label = await getSelectedLabel(page)
    expect(label).toBe('Origin')
  })

  it('shows rotation handle with bearing label', async () => {
    const pos = await getRotHandlePos(page)
    expect(pos).not.toBeNull()
    const bearing = await getSelectedBearing(page)
    expect(bearing).toBe('90°')
  })

  it('deselects on empty-map click', async () => {
    expect(await isSelected(page, 'origin')).toBe(true)
    // Click an area on the map with no node
    await mapClick(page, 600, 400)
    expect(await isSelected(page, 'origin')).toBe(false)
    // Overlay should be gone
    expect(await getSelectedLabel(page)).toBeNull()
  })

  it('selects a different node on click', async () => {
    // Use 'split' (mid-map) — 'dest' is occluded by the right-side drawer.
    const splitPos = await projectNode(page, 'split')
    expect(splitPos).not.toBeNull()
    await mapClick(page, splitPos!.x, splitPos!.y)
    expect(await isSelected(page, 'split')).toBe(true)
  })
})

describe('add node', () => {
  it('double-click adds a node', async () => {
    const before = await getNodeCount(page)
    await mapDblClick(page, 500, 500)
    const after = await getNodeCount(page)
    expect(after).toBe(before + 1)
  })

  it('single-click on empty map does NOT add a node', async () => {
    const before = await getNodeCount(page)
    await mapClick(page, 500, 500)
    const after = await getNodeCount(page)
    expect(after).toBe(before)
  })
})

describe('delete node', () => {
  it('Backspace deletes the selected node', async () => {
    const before = await getNodeCount(page)
    await page.keyboard.press('Backspace')
    await new Promise(r => setTimeout(r, 300))
    const after = await getNodeCount(page)
    expect(after).toBe(before - 1)
    expect(await isSelected(page, 'origin')).toBe(false)
  })

  it('Delete key also deletes the selected node', async () => {
    const before = await getNodeCount(page)
    await page.keyboard.press('Delete')
    await new Promise(r => setTimeout(r, 300))
    const after = await getNodeCount(page)
    expect(after).toBe(before - 1)
  })
})

describe('rotation handle', () => {
  it('drag updates bearing', async () => {
    const before = await getSelectedBearing(page)
    expect(before).toBe('90°')
    const handle = await getRotHandlePos(page)
    expect(handle).not.toBeNull()
    // Drag handle to below the node (south) — origin's screen position is roughly (X_handle - 40, Y_handle)
    // Drag direction: move from handle toward a south-of-node position
    // origin node is at the handle position minus the bearing-radius offset (40px east at 90°)
    const nodeCx = handle!.x - 40
    const nodeCy = handle!.y
    await page.mouse.move(handle!.x, handle!.y)
    await page.mouse.down()
    await page.mouse.move(nodeCx, nodeCy + 50, { steps: 10 })
    await page.mouse.up()
    await new Promise(r => setTimeout(r, 300))
    const after = await getSelectedBearing(page)
    expect(after).not.toBe('90°')
    // A drag to the south should yield a bearing in [120°, 210°] range
    const deg = parseInt(after!.replace('°', ''))
    expect(deg).toBeGreaterThan(120)
    expect(deg).toBeLessThan(210)
  })
})

describe('undo / redo', () => {
  it('undo reverts a double-click add', async () => {
    const before = await getNodeCount(page)
    await mapDblClick(page, 500, 500)
    expect(await getNodeCount(page)).toBe(before + 1)
    await undoViaApi(page)
    expect(await getNodeCount(page)).toBe(before)
  })

  it('redo re-adds after undo', async () => {
    const before = await getNodeCount(page)
    await mapDblClick(page, 500, 500)
    expect(await getNodeCount(page)).toBe(before + 1)
    await undoViaApi(page)
    expect(await getNodeCount(page)).toBe(before)
    await redoViaApi(page)
    expect(await getNodeCount(page)).toBe(before + 1)
  })

  it('undo reverts a rotation drag (single history entry, not per-mousemove)', async () => {
    expect(await getSelectedBearing(page)).toBe('90°')
    const handle = (await getRotHandlePos(page))!
    const nodeCx = handle.x - 40
    const nodeCy = handle.y
    await page.mouse.move(handle.x, handle.y)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(nodeCx + 10, nodeCy + 3 * i, { steps: 1 })
    }
    await page.mouse.up()
    await new Promise(r => setTimeout(r, 300))
    expect(await getSelectedBearing(page)).not.toBe('90°')
    await undoViaApi(page)
    expect(await getSelectedBearing(page)).toBe('90°')
  })

  it('undo reverts a node drag to pre-drag position', async () => {
    const originBefore = await getNode(page, 'origin')
    const originScreen = (await projectNode(page, 'origin'))!
    // Drag origin 100px to the right via the map canvas (edit-mode node drag)
    await page.mouse.move(originScreen.x, originScreen.y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(originScreen.x + 10 * i, originScreen.y, { steps: 1 })
    }
    await page.mouse.up()
    await new Promise(r => setTimeout(r, 300))
    const moved = await getNode(page, 'origin')
    expect(moved.pos[1]).not.toBeCloseTo(originBefore.pos[1], 4)
    await undoViaApi(page)
    const restored = await getNode(page, 'origin')
    expect(restored.pos[0]).toBeCloseTo(originBefore.pos[0], 4)
    expect(restored.pos[1]).toBeCloseTo(originBefore.pos[1], 4)
  })

  async function pressMod(keys: string) {
    // On macOS, Cmd (Meta) is the mod key. Try Meta first; some headless
    // environments need Control.
    const mods = process.platform === 'darwin' ? ['Meta'] : ['Control']
    for (const k of keys.split('+').slice(0, -1)) mods.push(k === 'Shift' ? 'Shift' : k)
    const target = keys.split('+').slice(-1)[0]
    for (const m of mods) await page.keyboard.down(m)
    await page.keyboard.press(target)
    for (const m of mods.slice().reverse()) await page.keyboard.up(m)
  }

  it('Cmd+Z undo works via keyboard shortcut', async () => {
    const before = await getNodeCount(page)
    await mapDblClick(page, 500, 500)
    expect(await getNodeCount(page)).toBe(before + 1)
    await pressMod('z')
    await new Promise(r => setTimeout(r, 300))
    expect(await getNodeCount(page)).toBe(before)
  })

  it('Cmd+Shift+Z redo works via keyboard shortcut', async () => {
    const before = await getNodeCount(page)
    await mapDblClick(page, 500, 500)
    await undoViaApi(page)
    expect(await getNodeCount(page)).toBe(before)
    await pressMod('Shift+z')
    await new Promise(r => setTimeout(r, 300))
    expect(await getNodeCount(page)).toBe(before + 1)
  })

  it('rotation drag produces exactly ONE history entry (not per-mousemove)', async () => {
    const histBefore = await getHistoryLengths(page)
    const handle = (await getRotHandlePos(page))!
    await page.mouse.move(handle.x, handle.y)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(handle.x + 2 * i, handle.y + 5 * i, { steps: 1 })
    }
    await page.mouse.up()
    await new Promise(r => setTimeout(r, 300))
    const histAfter = await getHistoryLengths(page)
    expect(histAfter.past).toBe(histBefore.past + 1)
  })
})

describe('multi-select', () => {
  it('selection state accepts an array of refs', async () => {
    await setSelectionsViaApi(page, [{ type: 'node', id: 'origin' }, { type: 'node', id: 'split' }])
    expect(await isSelected(page, 'origin')).toBe(true)
    expect(await isSelected(page, 'split')).toBe(true)
  })

  it('delete with multi-select removes all selected nodes', async () => {
    await setSelectionsViaApi(page, [{ type: 'node', id: 'origin' }, { type: 'node', id: 'split' }])
    const before = await getNodeCount(page)
    await page.keyboard.press('Backspace')
    await new Promise(r => setTimeout(r, 300))
    expect(await getNodeCount(page)).toBe(before - 2)
  })

  it('normal (no-shift) click on a node replaces the selection', async () => {
    await setSelectionsViaApi(page, [{ type: 'node', id: 'origin' }, { type: 'node', id: 'split' }])
    expect(await isSelected(page, 'split')).toBe(true)
    const mergePos = (await projectNode(page, 'merge'))!
    await page.mouse.click(mergePos.x, mergePos.y)
    await new Promise(r => setTimeout(r, 200))
    expect(await isSelected(page, 'origin')).toBe(false)
    expect(await isSelected(page, 'split')).toBe(false)
    expect(await isSelected(page, 'merge')).toBe(true)
  })

  it('Escape clears selection', async () => {
    expect(await isSelected(page, 'origin')).toBe(true)
    await page.keyboard.press('Escape')
    await new Promise(r => setTimeout(r, 200))
    expect(await isSelected(page, 'origin')).toBe(false)
  })
})

describe('edge selection', () => {
  it('click on edge centerline selects that edge', async () => {
    // Start with no selection so any edge click produces a single edge sel.
    await setSelectionsViaApi(page, [])
    const mid = await getEdgeMidpoint(page, 'origin', 'split')
    expect(mid).not.toBeNull()
    await mapClick(page, mid!.x, mid!.y)
    const sel = await getSelections(page)
    expect(sel).toEqual([{ type: 'edge', from: 'origin', to: 'split' }])
  })

  it('clicking an edge replaces a node selection (no shift)', async () => {
    expect(await isSelected(page, 'origin')).toBe(true)
    // Use split→merge so the midpoint is far from any currently-selected node.
    const mid = (await getEdgeMidpoint(page, 'split', 'merge'))!
    await mapClick(page, mid.x, mid.y)
    const sel = await getSelections(page)
    expect(sel).toEqual([{ type: 'edge', from: 'split', to: 'merge' }])
  })
})

describe('split edge on dbl-click', () => {
  it('inserts a through-node and replaces the edge', async () => {
    await setSelectionsViaApi(page, [])
    const beforeNodes = await getNodeCount(page)
    const beforeEdges = await page.evaluate(() => (window as any).__geoSankey?.graph?.edges?.length ?? 0)
    const mid = (await getEdgeMidpoint(page, 'split', 'merge'))!
    await mapDblClick(page, mid.x, mid.y)
    expect(await getNodeCount(page)).toBe(beforeNodes + 1)
    const afterEdges = await page.evaluate(() => (window as any).__geoSankey?.graph?.edges?.length ?? 0)
    expect(afterEdges).toBe(beforeEdges + 1)
    // Original split→merge should be gone
    const stillThere = await page.evaluate(() => (window as any).__geoSankey?.graph?.edges?.some((e: any) => e.from === 'split' && e.to === 'merge'))
    expect(stillThere).toBe(false)
    // New node should be selected
    const sel = await getSelections(page)
    expect(sel.length).toBe(1)
    expect(sel[0].type).toBe('node')
  })
})

describe('velocity handle', () => {
  it('drag sets node.velocity and produces one history entry', async () => {
    expect(await getNodeVelocity(page, 'origin')).toBeUndefined()
    const histBefore = await getHistoryLengths(page)
    const handle = (await getVelHandlePos(page))!
    expect(handle).not.toBeNull()
    // Drag handle 40px further along (same direction) and release
    await page.mouse.move(handle.x, handle.y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(handle.x + 4 * i, handle.y, { steps: 1 })
    }
    await page.mouse.up()
    await new Promise(r => setTimeout(r, 300))
    const vel = await getNodeVelocity(page, 'origin')
    expect(typeof vel).toBe('number')
    expect(vel).toBeGreaterThan(0)
    const histAfter = await getHistoryLengths(page)
    expect(histAfter.past).toBe(histBefore.past + 1)
    // Undo should clear the velocity back to undefined
    await undoViaApi(page)
    expect(await getNodeVelocity(page, 'origin')).toBeUndefined()
  })
})


