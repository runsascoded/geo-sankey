import type { FlowGraph, GFlowNode, GFlowEdge } from 'geo-sankey'

export interface Scene {
  version?: number
  graph: FlowGraph
  opts?: Partial<{
    color: string
    pxPerWeight: number
    refLat: number
    wing: number
    angle: number
    bezierN: number
    nodeApproach: number
    widthScale: number
    creaseSkip: number
  }>
  view?: { lat: number; lng: number; zoom: number }
}

const KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$-]*$/
const PLAIN_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function fmtKey(k: string): string {
  return PLAIN_KEY_RE.test(k) ? k : JSON.stringify(k)
}

function fmtString(s: string): string {
  return s.includes("'") && !s.includes('"')
    ? JSON.stringify(s)
    : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function fmtValue(v: unknown, indent: string): string {
  if (v === null) return 'null'
  if (typeof v === 'undefined') return 'undefined'
  if (typeof v === 'string') return fmtString(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]'
    // Inline if all primitives.
    if (v.every(x => x === null || typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')) {
      return `[${v.map(x => fmtValue(x, indent)).join(', ')}]`
    }
    const next = indent + '  '
    return `[\n${v.map(x => next + fmtValue(x, next)).join(',\n')},\n${indent}]`
  }
  if (typeof v === 'object') {
    return fmtObjectInline(v as Record<string, unknown>)
  }
  return JSON.stringify(v)
}

/** Format an object on a single line with `key: value` pairs. Used for
 *  individual node/edge entries which fit on one line. */
function fmtObjectInline(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return '{}'
  const parts = entries.map(([k, v]) => `${fmtKey(k)}: ${fmtValue(v, '')}`)
  return `{ ${parts.join(', ')} }`
}

/** Format an object across multiple lines (top-level layout). */
function fmtObjectBlock(obj: Record<string, unknown>, indent: string): string {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return '{}'
  const next = indent + '  '
  const lines = entries.map(([k, v]) => `${next}${fmtKey(k)}: ${fmtValue(v, next)},`)
  return `{\n${lines.join('\n')}\n${indent}}`
}

/** Strip default/undefined fields from a node so output stays minimal. */
function cleanNode(n: GFlowNode): Record<string, unknown> {
  const out: Record<string, unknown> = { id: n.id, pos: n.pos }
  if (n.bearing != null) out.bearing = n.bearing
  if (n.velocity != null) out.velocity = n.velocity
  if (n.label != null) out.label = n.label
  if (n.style) out.style = n.style
  return out
}

function cleanEdge(e: GFlowEdge): Record<string, unknown> {
  const out: Record<string, unknown> = { from: e.from, to: e.to, weight: e.weight }
  if (e.style) out.style = e.style
  return out
}

function sortedCleanGraph(g: FlowGraph): { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] } {
  const nodes = [...g.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(cleanNode)
  const edges = [...g.edges].sort((a, b) => {
    const k = a.from.localeCompare(b.from)
    return k !== 0 ? k : a.to.localeCompare(b.to)
  }).map(cleanEdge)
  return { nodes, edges }
}

/** Serialize a Scene as a TS literal expression (no `const` prefix).
 *  Output is sorted (nodes by id, edges by from→to) for diff-friendliness. */
export function sceneToTS(scene: Scene): string {
  const top: Record<string, unknown> = { graph: sortedCleanGraph(scene.graph) }
  if (scene.opts) {
    const cleanOpts = Object.fromEntries(Object.entries(scene.opts).filter(([, v]) => v !== undefined))
    if (Object.keys(cleanOpts).length) top.opts = cleanOpts
  }
  if (scene.view) top.view = scene.view
  return fmtObjectBlock(top, '')
}

/** Serialize just the `{ nodes, edges }` portion as a TS literal — the
 *  shape users have in their source files. Paste-friendly for the
 *  "edit diagram in browser → feed to claude → update source" flow. */
export function graphToTS(g: FlowGraph): string {
  return fmtObjectBlock(sortedCleanGraph(g), '')
}

/** Same sort+strip as `sceneToTS` but emitted as canonical JSON with
 *  2-space indent. Good for a diff-friendly download. */
export function sceneToJSON(scene: Scene): string {
  const top: Record<string, unknown> = { graph: sortedCleanGraph(scene.graph) }
  if (scene.opts) {
    const cleanOpts = Object.fromEntries(Object.entries(scene.opts).filter(([, v]) => v !== undefined))
    if (Object.keys(cleanOpts).length) top.opts = cleanOpts
  }
  if (scene.view) top.view = scene.view
  return JSON.stringify(top, null, 2)
}

/** Parse a Scene (or a bare graph literal) from TS-literal or JSON text.
 *  Tries JSON first; falls back to `new Function('return …')` for TS-literal
 *  syntax (single-quoted strings, unquoted keys, trailing commas). The
 *  latter is `eval`-equivalent — only call on text the user pasted
 *  themselves. Input forms accepted:
 *  - Full scene: `{ graph: { nodes, edges }, opts?, view? }`
 *  - Bare graph: `{ nodes, edges }` — wrapped into a scene automatically. */
export function parseScene(text: string): Scene {
  const trimmed = text.trim()
  const stripped = trimmed
    .replace(/^(?:export\s+default\s+|export\s+const\s+\w+(?::\s*[\w<>[\],\s|]+)?\s*=\s*|const\s+\w+(?::\s*[\w<>[\],\s|]+)?\s*=\s*)/, '')
    .replace(/;\s*$/, '')
  let obj: any
  try {
    obj = JSON.parse(stripped)
  } catch {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${stripped})`)
    obj = fn()
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error('Parsed value is not an object')
  }
  // Bare graph form: has top-level nodes/edges arrays.
  if (Array.isArray(obj.nodes) && Array.isArray(obj.edges)) {
    return { graph: obj as FlowGraph }
  }
  if (!obj.graph || !Array.isArray(obj.graph.nodes) || !Array.isArray(obj.graph.edges)) {
    throw new Error('Parsed value is not a Scene (missing graph.nodes / graph.edges)')
  }
  return obj as Scene
}

export const _internal = { fmtKey, KEY_RE }
