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

/** Serialize a Scene as a TS literal expression (no `const` prefix).
 *  Output is sorted (nodes by id, edges by from→to) for diff-friendliness. */
export function sceneToTS(scene: Scene): string {
  const nodes = [...scene.graph.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(cleanNode)
  const edges = [...scene.graph.edges].sort((a, b) => {
    const k = a.from.localeCompare(b.from)
    return k !== 0 ? k : a.to.localeCompare(b.to)
  }).map(cleanEdge)
  const top: Record<string, unknown> = {
    graph: { nodes, edges },
  }
  if (scene.opts) {
    const cleanOpts = Object.fromEntries(Object.entries(scene.opts).filter(([, v]) => v !== undefined))
    if (Object.keys(cleanOpts).length) top.opts = cleanOpts
  }
  if (scene.view) top.view = scene.view
  return fmtObjectBlock(top, '')
}

/** Parse a Scene from TS-literal or JSON text. Tries JSON first; falls back
 *  to `new Function('return …')` for TS-literal syntax (single-quoted
 *  strings, unquoted keys, trailing commas). The latter is `eval`-equivalent
 *  — only call on text the user pasted themselves. */
export function parseScene(text: string): Scene {
  const trimmed = text.trim()
  // Strip a leading `const x: T = ` / `export default ` if present.
  const stripped = trimmed
    .replace(/^(?:export\s+default\s+|export\s+const\s+\w+(?::\s*[\w<>[\],\s|]+)?\s*=\s*|const\s+\w+(?::\s*[\w<>[\],\s|]+)?\s*=\s*)/, '')
    .replace(/;\s*$/, '')
  try {
    return JSON.parse(stripped) as Scene
  } catch {
    // Fall through to TS-literal eval.
  }
  // eslint-disable-next-line no-new-func
  const fn = new Function(`return (${stripped})`)
  const obj = fn() as Scene
  if (!obj || !obj.graph || !Array.isArray(obj.graph.nodes) || !Array.isArray(obj.graph.edges)) {
    throw new Error('Parsed value is not a Scene (missing graph.nodes / graph.edges)')
  }
  return obj
}

export const _internal = { fmtKey, KEY_RE }
