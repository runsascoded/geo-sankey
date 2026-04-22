import { useState, useEffect, useCallback, useRef } from 'react'
import { lngScale } from 'geo-sankey'

const { atan2, cos, sin, PI, round, sqrt, max } = Math

interface Props {
  nodeId: string
  bearing: number
  pos: [number, number] // [lat, lon]
  velocity?: number     // per-node bezier control distance (scaled-degrees)
  refLat: number
  mapRef: React.RefObject<any>
  /** Called once at the start of a drag (capture snapshot for undo). */
  onBeginDrag: () => void
  /** Transient bearing+velocity update during drag (no history push). */
  onDragTransient: (bearing: number, velocity: number | undefined) => void
  /** Reset velocity to auto (dbl-click). */
  onResetVelocity: () => void
}

const HANDLE_DEFAULT_PX = 60
const HANDLE_MIN_PX = 20

export default function NodeOverlay({ bearing, pos, velocity, refLat, mapRef, onBeginDrag, onDragTransient, onResetVelocity }: Props) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const project = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return null
    const pt = map.project([pos[1], pos[0]])
    return { x: pt.x, y: pt.y }
  }, [mapRef, pos])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) {
      const timer = setTimeout(() => setScreenPos(project()), 500)
      return () => clearTimeout(timer)
    }
    const update = () => setScreenPos(project())
    update()
    map.on('move', update)
    map.on('zoom', update)
    return () => { map.off('move', update); map.off('zoom', update) }
  }, [project, mapRef])

  const cbRef = useRef({ onBeginDrag, onDragTransient, project })
  cbRef.current = { onBeginDrag, onDragTransient, project }

  // Unified tangent-handle drag: angle from node → bearing, distance → velocity
  useEffect(() => {
    if (!dragging) return
    const map = mapRef.current?.getMap()
    if (!map) return
    const canvas = map.getCanvas()
    const ls = lngScale(refLat)
    let committed = false
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sp = cbRef.current.project()
      if (!sp) return
      // Screen-space delta from node center
      const dx = (e.clientX - rect.left) - sp.x
      const dy = (e.clientY - rect.top) - sp.y
      const dist = sqrt(dx * dx + dy * dy)
      if (dist < 2) return  // ignore micro-movements

      // Bearing from angle
      let deg = ((atan2(dx, -dy) * 180 / PI) + 360) % 360
      if (e.shiftKey) deg = Math.round(deg / 15) * 15 % 360

      // Velocity from distance: unproject cursor to lat/lon, project onto bearing axis
      const ll = map.unproject([e.clientX - rect.left, e.clientY - rect.top])
      const bRad = deg * PI / 180
      const dLatS = (ll.lat - pos[0]) * ls
      const dLon = ll.lng - pos[1]
      const vel = max(dLatS * cos(bRad) + dLon * sin(bRad), 0)

      if (!committed) { cbRef.current.onBeginDrag(); committed = true }
      cbRef.current.onDragTransient(round(deg), vel > 0 ? vel : undefined)
    }
    const onUp = () => setDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging, mapRef, refLat, pos])

  if (!screenPos) return null

  // Handle position: project velocity to screen px along bearing
  const bRad = (bearing - 90) * PI / 180
  let hx = screenPos.x + HANDLE_DEFAULT_PX * cos(bRad)
  let hy = screenPos.y + HANDLE_DEFAULT_PX * sin(bRad)
  let velSet = false
  if (velocity != null && velocity > 0) {
    const ls = lngScale(refLat)
    const bR = bearing * PI / 180
    const targetLat = pos[0] + (cos(bR) * velocity) / ls
    const targetLon = pos[1] + sin(bR) * velocity
    const map = mapRef.current?.getMap()
    if (map) {
      const pt = map.project([targetLon, targetLat])
      hx = pt.x; hy = pt.y
      velSet = true
    }
  }

  // Mirror on opposite side
  const mx = 2 * screenPos.x - hx
  const my = 2 * screenPos.y - hy

  return <>
    {/* Tangent axis through node */}
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 25 }}>
      <line x1={mx} y1={my} x2={hx} y2={hy}
        stroke={velSet ? '#14B8A6' : '#14B8A688'} strokeWidth={1.5} strokeDasharray="4 2" />
    </svg>
    {/* Primary tangent handle */}
    <div
      style={{
        position: 'absolute', left: hx - 7, top: hy - 7,
        width: 14, height: 14, borderRadius: '50%',
        background: '#14B8A6', border: '1.5px solid #fff',
        cursor: 'grab', zIndex: 26,
      }}
      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setDragging(true) }}
      onDoubleClick={e => { e.stopPropagation(); onResetVelocity() }}
      title="Drag to set bearing + curve tightness (Shift: snap 15°, dbl-click: reset velocity)"
    />
    {/* Mirror handle (visual only) */}
    <div
      style={{
        position: 'absolute', left: mx - 5, top: my - 5,
        width: 10, height: 10, borderRadius: '50%',
        background: 'transparent', border: '1.5px solid #14B8A6',
        opacity: 0.5, zIndex: 26, pointerEvents: 'none',
      }}
    />
    {/* Bearing label */}
    <div style={{ position: 'absolute', left: hx + 10, top: hy - 6, fontSize: 10, color: '#14B8A6', pointerEvents: 'none', zIndex: 26 }}>
      {round(bearing)}&deg;
    </div>
  </>
}
