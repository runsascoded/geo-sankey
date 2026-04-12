import { useState, useEffect, useCallback, useRef } from 'react'

const { atan2, PI, round } = Math

interface Props {
  nodeId: string
  label: string
  bearing: number
  pos: [number, number] // [lat, lon]
  mapRef: React.RefObject<any>
  onUpdateBearing: (deg: number) => void
  onBeginRotate: () => void // capture pre-drag snapshot to history
  onRotateTransient: (deg: number) => void // update bearing w/o history
  onUpdateLabel: (label: string) => void
  onUpdatePos: (pos: [number, number]) => void
  onAddEdge: () => void
  onDelete: () => void
}

export default function NodeOverlay({ nodeId, label, bearing, pos, mapRef, onUpdateBearing, onBeginRotate, onRotateTransient, onUpdateLabel, onUpdatePos, onAddEdge, onDelete }: Props) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null)
  const [rotDragging, setRotDragging] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Project lat/lon → screen px
  const project = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return null
    const pt = map.project([pos[1], pos[0]]) // [lng, lat]
    return { x: pt.x, y: pt.y }
  }, [mapRef, pos])

  // Update position on mount and map moves
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) {
      // Map not ready — retry after a short delay
      const timer = setTimeout(() => setScreenPos(project()), 500)
      return () => clearTimeout(timer)
    }
    const update = () => setScreenPos(project())
    update()
    map.on('move', update)
    map.on('zoom', update)
    return () => { map.off('move', update); map.off('zoom', update) }
  }, [project, mapRef])

  // Stabilise callbacks so the drag-effect only re-runs on rotDragging change
  const cbRef = useRef({ onBeginRotate, onRotateTransient, project })
  cbRef.current = { onBeginRotate, onRotateTransient, project }

  // Rotation handle drag
  const handleRadius = 40
  useEffect(() => {
    if (!rotDragging) return
    const map = mapRef.current?.getMap()
    if (!map) return
    const canvas = map.getCanvas()
    let committed = false
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sp = cbRef.current.project()
      if (!sp) return
      const dx = (e.clientX - rect.left) - sp.x
      const dy = (e.clientY - rect.top) - sp.y
      const deg = ((atan2(dx, -dy) * 180 / PI) + 360) % 360
      if (!committed) { cbRef.current.onBeginRotate(); committed = true }
      cbRef.current.onRotateTransient(round(deg))
    }
    const onUp = () => setRotDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [rotDragging, mapRef])

  if (!screenPos) return null

  const bRad = (bearing - 90) * PI / 180
  const hx = screenPos.x + handleRadius * Math.cos(bRad)
  const hy = screenPos.y + handleRadius * Math.sin(bRad)

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg, #11111b)', color: 'var(--fg, #cdd6f4)',
    border: '1px solid var(--border, #45475a)', borderRadius: 4,
    padding: '2px 6px', width: '100%', fontSize: 12,
  }

  return <>
    {/* Bearing line (visual only) */}
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 25 }}>
      <line x1={screenPos.x} y1={screenPos.y} x2={hx} y2={hy} stroke="#14B8A6" strokeWidth={1.5} strokeDasharray="4 2" />
    </svg>
    {/* Rotation handle — div for reliable mouse events */}
    <div
      style={{
        position: 'absolute', left: hx - 7, top: hy - 7,
        width: 14, height: 14, borderRadius: '50%',
        background: '#14B8A6', border: '1.5px solid #fff',
        cursor: 'grab', zIndex: 26,
      }}
      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setRotDragging(true) }}
    />
    {/* Bearing degree label */}
    <div style={{ position: 'absolute', left: hx + 10, top: hy - 6, fontSize: 10, color: '#14B8A6', pointerEvents: 'none', zIndex: 26 }}>
      {round(bearing)}&deg;
    </div>

    {/* Node label + expand toggle */}
    <div
      style={{
        position: 'absolute',
        left: screenPos.x + 12,
        top: screenPos.y - 12,
        background: 'var(--bg-surface, #1e1e2e)',
        color: 'var(--fg, #cdd6f4)',
        border: '1px solid var(--border, #45475a)',
        borderRadius: 6,
        padding: expanded ? '8px 12px' : '4px 8px',
        fontSize: 12,
        zIndex: 25,
        minWidth: expanded ? 180 : undefined,
        whiteSpace: 'nowrap',
        cursor: 'default',
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); if (!expanded) setExpanded(true) }}
    >
      {expanded ? <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{nodeId}</span>
          <span style={{ cursor: 'pointer', opacity: 0.5, fontSize: 14 }} onClick={e => { e.stopPropagation(); setExpanded(false) }}>&times;</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 10, opacity: 0.6, minWidth: 32 }}>Label</span>
          <input style={inputStyle} value={label} onChange={e => onUpdateLabel(e.target.value || '')} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 10, opacity: 0.6, minWidth: 32 }}>Lat</span>
          <input style={inputStyle} type="number" step="0.0001" value={pos[0]} onChange={e => onUpdatePos([parseFloat(e.target.value), pos[1]])} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 10, opacity: 0.6, minWidth: 32 }}>Lon</span>
          <input style={inputStyle} type="number" step="0.0001" value={pos[1]} onChange={e => onUpdatePos([pos[0], parseFloat(e.target.value)])} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={onAddEdge} style={{ fontSize: 10 }}>Add edge</button>
          <button onClick={onDelete} style={{ fontSize: 10, color: '#ef4444' }}>Delete</button>
        </div>
      </> : <>
        <span style={{ fontSize: 11 }}>{label || nodeId}</span>
      </>}
    </div>
  </>
}
