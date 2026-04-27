import { useState, useEffect } from 'react'
import type { FlowGraph, GFlowNode, GFlowEdge } from 'geo-sankey'
import { Row, Slider } from './Drawer'

const { round } = Math

/** Number input that only commits on blur / Enter, to avoid firing updates
 *  (and history entries) on every intermediate keystroke. Escape reverts. */
function NumberInput({ value, onCommit, step, style, placeholder, allowEmpty }: {
  value: number | undefined
  onCommit: (v: number | undefined) => void
  step?: string
  style?: React.CSSProperties
  placeholder?: string
  allowEmpty?: boolean
}) {
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setDraft(value == null ? '' : String(value)) }, [value, focused])
  const commit = () => {
    if (draft === '') { if (allowEmpty) onCommit(undefined); return }
    const v = parseFloat(draft)
    if (!Number.isNaN(v) && v !== value) onCommit(v)
  }
  return (
    <input style={style} type="number" step={step} placeholder={placeholder}
      value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit() }}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        else if (e.key === 'Escape') { setDraft(value == null ? '' : String(value)); (e.target as HTMLInputElement).blur() }
      }} />
  )
}

export type SelectionRef = { type: 'node'; id: string } | { type: 'edge'; from: string; to: string }

export type NodeRole = 'source' | 'sink' | 'split' | 'merge' | 'through' | 'isolated'

interface Props {
  graph: FlowGraph
  selections: SelectionRef[]
  selectedNodes: GFlowNode[]
  selectedEdges: GFlowEdge[]
  resolvedWeights: Map<string, number>
  singlePoly: boolean
  nodeRoleOf: (id: string) => NodeRole
  aggEdge: (k: 'color' | 'opacity' | 'widthScale', fromStyle: true) => string | number | undefined

  updateNode: (id: string, patch: Partial<{ pos: [number, number]; bearing: number; label: string; velocity: number }>) => void
  renameNode: (oldId: string, newId: string) => void
  deleteNode: (id: string) => void
  addEdge: (from: string, to: string) => void
  deleteEdge: (from: string, to: string) => void
  reverseEdge: (from: string, to: string) => void
  setEdgeSource: (id: string | null) => void
  setSelections: (next: SelectionRef[] | ((prev: SelectionRef[]) => SelectionRef[])) => void
  applyEdgeStyle: (patch: Partial<{ color: string; opacity: number; widthScale: number }>) => void
  applyEdgeWeight: (weight: number | 'auto') => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 12, background: 'var(--bg, #11111b)', color: 'var(--fg, #cdd6f4)',
  border: '1px solid var(--border, #45475a)', borderRadius: 4, padding: '2px 6px',
}

const targetSelectStyle: React.CSSProperties = {
  fontSize: 11, background: 'var(--bg, #11111b)', color: 'var(--fg, #cdd6f4)',
  border: '1px solid var(--border, #45475a)', borderRadius: 4, padding: '2px 4px', maxWidth: 120,
}

export default function SelectionSection({
  graph, selectedNodes, selectedEdges, resolvedWeights, singlePoly,
  nodeRoleOf, aggEdge,
  updateNode, renameNode, deleteNode, addEdge, deleteEdge, reverseEdge,
  setEdgeSource, setSelections, applyEdgeStyle, applyEdgeWeight,
}: Props) {
  const singleNode = selectedNodes.length === 1 && selectedEdges.length === 0 ? selectedNodes[0] : null
  const twoNodes = selectedNodes.length === 2 && selectedEdges.length === 0
    ? [selectedNodes[0], selectedNodes[1]] as const
    : null
  const edgeExists = (from: string, to: string) =>
    graph.edges.some(e => e.from === from && e.to === to)
  const color = aggEdge('color', true) as string | undefined
  const opacityVal = aggEdge('opacity', true) as number | undefined

  return <>
    <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 6 }}>
      {selectedNodes.length > 0 && <span>{selectedNodes.length} node{selectedNodes.length === 1 ? '' : 's'}</span>}
      {selectedNodes.length > 0 && selectedEdges.length > 0 && <span> · </span>}
      {selectedEdges.length > 0 && <span>{selectedEdges.length} edge{selectedEdges.length === 1 ? '' : 's'}</span>}
    </div>

    {singleNode && <SingleNodeFields
      graph={graph} node={singleNode} nodeRoleOf={nodeRoleOf}
      updateNode={updateNode} renameNode={renameNode} deleteNode={deleteNode}
      addEdge={addEdge} setEdgeSource={setEdgeSource} setSelections={setSelections}
    />}

    {twoNodes && <TwoNodeConnect a={twoNodes[0]} b={twoNodes[1]}
      edgeExists={edgeExists} addEdge={addEdge} />}

    {selectedEdges.length > 0 && <EdgeFields
      graph={graph} selectedEdges={selectedEdges} selectedNodesLen={selectedNodes.length}
      resolvedWeights={resolvedWeights} singlePoly={singlePoly}
      color={color} opacityVal={opacityVal}
      addSpacer={!!singleNode}
      applyEdgeStyle={applyEdgeStyle} applyEdgeWeight={applyEdgeWeight}
      reverseEdge={reverseEdge} deleteEdge={deleteEdge} />}
  </>
}

function SingleNodeFields({
  graph, node, nodeRoleOf, updateNode, renameNode, deleteNode, addEdge, setEdgeSource, setSelections,
}: {
  graph: FlowGraph
  node: GFlowNode
  nodeRoleOf: (id: string) => NodeRole
  updateNode: Props['updateNode']
  renameNode: Props['renameNode']
  deleteNode: Props['deleteNode']
  addEdge: Props['addEdge']
  setEdgeSource: Props['setEdgeSource']
  setSelections: Props['setSelections']
}) {
  const otherIds = graph.nodes.filter(n => n.id !== node.id).map(n => n.id)
  const existingOut = new Set(graph.edges.filter(e => e.from === node.id).map(e => e.to))
  const existingIn = new Set(graph.edges.filter(e => e.to === node.id).map(e => e.from))
  const outCandidates = otherIds.filter(id => !existingOut.has(id))
  const inCandidates = otherIds.filter(id => !existingIn.has(id))
  return <>
    <Row label="Role">
      <span style={{ fontSize: 11, opacity: 0.7, fontFamily: 'monospace' }}>{nodeRoleOf(node.id)}</span>
    </Row>
    <Row label="ID">
      <input style={inputStyle} defaultValue={node.id} key={node.id}
        onBlur={e => {
          const v = e.target.value.trim()
          if (v && v !== node.id) renameNode(node.id, v)
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
    </Row>
    <Row label="Label">
      <input style={inputStyle} value={node.label ?? ''}
        onChange={e => updateNode(node.id, { label: e.target.value || undefined } as any)} />
    </Row>
    <Row label="Lat">
      <NumberInput style={inputStyle} step="0.0001" value={node.pos[0]}
        onCommit={v => { if (v != null) updateNode(node.id, { pos: [v, node.pos[1]] }) }} />
    </Row>
    <Row label="Lon">
      <NumberInput style={inputStyle} step="0.0001" value={node.pos[1]}
        onCommit={v => { if (v != null) updateNode(node.id, { pos: [node.pos[0], v] }) }} />
    </Row>
    <Row label="Bearing">
      <NumberInput style={inputStyle} step="1" value={round(node.bearing ?? 90)}
        onCommit={v => { if (v != null) updateNode(node.id, { bearing: v }) }} />
    </Row>
    <Row label="Velocity">
      <div style={{ display: 'flex', gap: 4, width: '100%' }}>
        <NumberInput style={{ ...inputStyle, flex: 1 }} step="0.0001" placeholder="auto" allowEmpty
          value={node.velocity}
          onCommit={v => updateNode(node.id, { velocity: v } as any)} />
        <button onClick={() => updateNode(node.id, { velocity: undefined } as any)}
          title="Reset to auto" style={{ fontSize: 10, padding: '0 6px' }}>×</button>
      </div>
    </Row>
    <Row label="Out →">
      <div style={{ display: 'flex', gap: 4, width: '100%' }}>
        <select value="" onChange={e => { if (e.target.value) addEdge(node.id, e.target.value) }}
          disabled={outCandidates.length === 0} style={targetSelectStyle}>
          <option value="">{outCandidates.length === 0 ? 'no targets' : 'Pick…'}</option>
          {outCandidates.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
        <button onClick={() => { setEdgeSource(node.id); setSelections([]) }} title="Pick on map" style={{ fontSize: 11 }}>map</button>
      </div>
    </Row>
    <Row label="← In">
      <div style={{ display: 'flex', gap: 4, width: '100%' }}>
        <select value="" onChange={e => { if (e.target.value) addEdge(e.target.value, node.id) }}
          disabled={inCandidates.length === 0} style={targetSelectStyle}>
          <option value="">{inCandidates.length === 0 ? 'no sources' : 'Pick…'}</option>
          {inCandidates.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>
    </Row>
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
      <button onClick={() => deleteNode(node.id)} style={{ fontSize: 11, color: '#ef4444' }}>Delete</button>
    </div>
  </>
}

function TwoNodeConnect({
  a, b, edgeExists, addEdge,
}: {
  a: GFlowNode; b: GFlowNode
  edgeExists: (from: string, to: string) => boolean
  addEdge: Props['addEdge']
}) {
  const ab = edgeExists(a.id, b.id)
  const ba = edgeExists(b.id, a.id)
  return <>
    <Row label="A"><span style={{ fontSize: 11, opacity: 0.7 }}>{a.id}{a.label ? ` (${a.label})` : ''}</span></Row>
    <Row label="B"><span style={{ fontSize: 11, opacity: 0.7 }}>{b.id}{b.label ? ` (${b.label})` : ''}</span></Row>
    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
      <button disabled={ab} title={ab ? 'Edge already exists' : ''}
        onClick={() => addEdge(a.id, b.id)} style={{ fontSize: 11, opacity: ab ? 0.4 : 1 }}>
        {a.id} → {b.id}
      </button>
      <button disabled={ba} title={ba ? 'Edge already exists' : ''}
        onClick={() => addEdge(b.id, a.id)} style={{ fontSize: 11, opacity: ba ? 0.4 : 1 }}>
        {b.id} → {a.id}
      </button>
    </div>
  </>
}

function EdgeFields({
  graph, selectedEdges, selectedNodesLen, resolvedWeights, singlePoly,
  color, opacityVal, addSpacer,
  applyEdgeStyle, applyEdgeWeight, reverseEdge, deleteEdge,
}: {
  graph: FlowGraph
  selectedEdges: GFlowEdge[]
  selectedNodesLen: number
  resolvedWeights: Map<string, number>
  singlePoly: boolean
  color: string | undefined
  opacityVal: number | undefined
  addSpacer: boolean
  applyEdgeStyle: Props['applyEdgeStyle']
  applyEdgeWeight: Props['applyEdgeWeight']
  reverseEdge: Props['reverseEdge']
  deleteEdge: Props['deleteEdge']
}) {
  const allAuto = selectedEdges.every(e => e.weight === 'auto')
  const numericWeights = selectedEdges.filter(e => typeof e.weight === 'number').map(e => e.weight as number)
  const sharedNumeric = numericWeights.length === selectedEdges.length && numericWeights.every(w => w === numericWeights[0])
    ? numericWeights[0] : undefined
  const singleAutoResolved = allAuto && selectedEdges.length === 1
    ? +(resolvedWeights.get(`${selectedEdges[0].from}→${selectedEdges[0].to}`) ?? 0).toFixed(2)
    : undefined
  const inputVal = sharedNumeric ?? singleAutoResolved ?? ''
  const placeholder = sharedNumeric === undefined && singleAutoResolved === undefined
    ? (allAuto ? 'auto' : 'Mixed') : ''
  const weightStyle: React.CSSProperties = {
    ...inputStyle, flex: 1,
    ...(singleAutoResolved !== undefined ? { color: '#a78bfa', fontStyle: 'italic' } : {}),
  }
  return <>
    {addSpacer && <div style={{ height: 8 }} />}
    <Row label="Weight">
      <div style={{ display: 'flex', gap: 4, width: '100%' }}>
        <input type="number" value={inputVal} placeholder={placeholder}
          onChange={e => applyEdgeWeight(e.target.value === '' ? 'auto' : (parseFloat(e.target.value) || 0))}
          style={weightStyle}
          title={singleAutoResolved !== undefined ? 'derived from upstream — type to override' : ''} />
        <button onClick={() => applyEdgeWeight('auto')} title="Auto = sum of inputs"
          style={{ fontSize: 10, padding: '0 6px', opacity: allAuto ? 0.4 : 1 }}>auto</button>
      </div>
    </Row>
    {!singlePoly && <>
      <Row label="Color">
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="color" value={color ?? '#888888'}
            onChange={e => applyEdgeStyle({ color: e.target.value })}
            style={{ width: 32, height: 24, padding: 0, border: '1px solid var(--border, #45475a)', borderRadius: 4, background: 'transparent' }} />
          <input type="text" value={color ?? ''} placeholder={color === undefined ? 'Mixed' : ''}
            onChange={e => applyEdgeStyle({ color: e.target.value })}
            style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
          <button onClick={() => applyEdgeStyle({ color: undefined as any })} title="Clear (use page default)"
            style={{ fontSize: 10, padding: '0 6px' }}>×</button>
        </div>
      </Row>
      <Row label="Opacity">
        <Slider value={opacityVal ?? 1} onChange={v => applyEdgeStyle({ opacity: v })}
          min={0} max={1} step={0.05} fmt={v => opacityVal === undefined ? 'Mix' : v.toFixed(2)} />
      </Row>
    </>}
    {singlePoly && (
      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
        Per-edge color &amp; opacity require <strong>single-poly off</strong>.
      </div>
    )}
    {selectedEdges.length === 1 && selectedNodesLen === 0 && (() => {
      const e = selectedEdges[0]
      const reverseExists = graph.edges.some(x => x.from === e.to && x.to === e.from)
      return (
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <button onClick={() => reverseEdge(e.from, e.to)}
            disabled={reverseExists}
            title={reverseExists ? `${e.to}→${e.from} already exists` : `Flip to ${e.to}→${e.from}`}
            style={{ fontSize: 11, opacity: reverseExists ? 0.4 : 1 }}>
            ↔ Reverse
          </button>
          <button onClick={() => deleteEdge(e.from, e.to)} style={{ fontSize: 11, color: '#ef4444' }}>Delete</button>
        </div>
      )
    })()}
  </>
}
