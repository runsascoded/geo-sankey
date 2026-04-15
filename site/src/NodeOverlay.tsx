import { useState, useEffect, useCallback, useRef } from 'react'
import { lngScale } from 'geo-sankey'

const { atan2, cos, sin, PI, round, sqrt } = Math

interface Props {
  nodeId: string
  label: string
  bearing: number
  pos: [number, number] // [lat, lon]
  velocity?: number     // per-node bezier control distance (scaled-degrees)
  refLat: number
  mapRef: React.RefObject<any>
  onBeginRotate: () => void
  onRotateTransient: (deg: number) => void
  onBeginVelocity: () => void
  onVelocityTransient: (vel: number) => void
  onResetVelocity: () => void
}

const ROT_RADIUS = 40
const VEL_DEFAULT_PX = 80

export default function NodeOverlay({ nodeId, label, bearing, pos, velocity, refLat, mapRef, onBeginRotate, onRotateTransient, onBeginVelocity, onVelocityTransient, onResetVelocity }: Props) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null)
  const [rotDragging, setRotDragging] = useState(false)
  const [velDragging, setVelDragging] = useState(false)

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

  const cbRef = useRef({ onBeginRotate, onRotateTransient, onBeginVelocity, onVelocityTransient, project })
  cbRef.current = { onBeginRotate, onRotateTransient, onBeginVelocity, onVelocityTransient, project }

  // Rotation drag
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
      let deg = ((atan2(dx, -dy) * 180 / PI) + 360) % 360
      // Shift snaps to 15° increments (so e.g. 0, 15, 30, 45, 90 are easy targets).
      if (e.shiftKey) deg = Math.round(deg / 15) * 15 % 360
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

  // Velocity drag — project mouse back to lat/lon, decompose onto bearing axis
  useEffect(() => {
    if (!velDragging) return
    const map = mapRef.current?.getMap()
    if (!map) return
    const canvas = map.getCanvas()
    const ls = lngScale(refLat)
    const bRad = bearing * PI / 180
    let committed = false
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const ll = map.unproject([e.clientX - rect.left, e.clientY - rect.top])
      const dLatS = (ll.lat - pos[0]) * ls
      const dLon = ll.lng - pos[1]
      const vel = dLatS * cos(bRad) + dLon * sin(bRad)
      if (!committed) { cbRef.current.onBeginVelocity(); committed = true }
      cbRef.current.onVelocityTransient(Math.max(vel, 0))
    }
    const onUp = () => setVelDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [velDragging, mapRef, refLat, bearing, pos])

  if (!screenPos) return null

  const bRad = (bearing - 90) * PI / 180
  const hx = screenPos.x + ROT_RADIUS * cos(bRad)
  const hy = screenPos.y + ROT_RADIUS * sin(bRad)

  // Velocity handle position. When velocity is set, project from lat/lon space.
  // Otherwise, show a default-distance ghost along the bearing ray.
  let vx = screenPos.x + VEL_DEFAULT_PX * cos(bRad)
  let vy = screenPos.y + VEL_DEFAULT_PX * sin(bRad)
  let velSet = false
  if (velocity != null && velocity > 0) {
    const ls = lngScale(refLat)
    const bR = bearing * PI / 180
    const targetLat = pos[0] + (cos(bR) * velocity) / ls
    const targetLon = pos[1] + sin(bR) * velocity
    const map = mapRef.current?.getMap()
    if (map) {
      const pt = map.project([targetLon, targetLat])
      vx = pt.x; vy = pt.y
      velSet = true
    }
  }

  // Mirror positions on the opposite side of the bearing axis — visual cue
  // for the smooth-spline constraint (one velocity applies to all edges at
  // this node, so both tangent directions have the same handle length).
  const mx = 2 * screenPos.x - hx
  const my = 2 * screenPos.y - hy
  const mvx = 2 * screenPos.x - vx
  const mvy = 2 * screenPos.y - vy

  return <>
    {/* Tangent axis: full line through the node from one velocity handle to
     *  the other. Plus the shorter bearing ray (solid node→rotation handle
     *  segment) to anchor the rotation handle visually. */}
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 25 }}>
      <line x1={mvx} y1={mvy} x2={vx} y2={vy}
        stroke={velSet ? '#a78bfa' : '#a78bfa55'} strokeWidth={1.5} strokeDasharray="2 3" />
      <line x1={mx} y1={my} x2={hx} y2={hy}
        stroke="#14B8A6" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.9} />
    </svg>
    {/* Rotation handle (primary) */}
    <div
      style={{
        position: 'absolute', left: hx - 7, top: hy - 7,
        width: 14, height: 14, borderRadius: '50%',
        background: '#14B8A6', border: '1.5px solid #fff',
        cursor: 'grab', zIndex: 26,
      }}
      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setRotDragging(true) }}
      title="Drag to rotate bearing (hold Shift to snap to 15°)"
    />
    {/* Rotation handle mirror (visual only — same axis, opposite side) */}
    <div
      style={{
        position: 'absolute', left: mx - 4, top: my - 4,
        width: 8, height: 8, borderRadius: '50%',
        background: 'transparent', border: '1.5px solid #14B8A6',
        opacity: 0.7, zIndex: 26, pointerEvents: 'none',
      }}
    />
    <div style={{ position: 'absolute', left: hx + 10, top: hy - 6, fontSize: 10, color: '#14B8A6', pointerEvents: 'none', zIndex: 26 }}>
      {round(bearing)}&deg;
    </div>
    {/* Velocity handle (primary) — diamond to distinguish from rotation */}
    <div
      style={{
        position: 'absolute', left: vx - 6, top: vy - 6,
        width: 12, height: 12,
        background: velSet ? '#a78bfa' : 'transparent',
        border: `1.5px solid ${velSet ? '#fff' : '#a78bfa'}`,
        transform: 'rotate(45deg)',
        cursor: 'grab', zIndex: 26,
      }}
      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setVelDragging(true) }}
      onDoubleClick={e => { e.stopPropagation(); onResetVelocity() }}
      title={velSet ? `Velocity ${velocity!.toFixed(4)} — drag to adjust, dbl-click to reset` : 'Drag to set bezier control distance'}
    />
    {/* Velocity mirror (visual only) */}
    <div
      style={{
        position: 'absolute', left: mvx - 4, top: mvy - 4,
        width: 8, height: 8,
        background: 'transparent',
        border: `1.5px solid ${velSet ? '#a78bfa' : '#a78bfa88'}`,
        transform: 'rotate(45deg)',
        opacity: 0.7, zIndex: 26, pointerEvents: 'none',
      }}
    />

    {/* Node label pill (no editing here — properties live in the drawer) */}
    <div
      style={{
        position: 'absolute',
        left: screenPos.x + 12,
        top: screenPos.y - 12,
        background: 'var(--bg-surface, #1e1e2e)',
        color: 'var(--fg, #cdd6f4)',
        border: '1px solid var(--border, #45475a)',
        borderRadius: 6,
        padding: '4px 8px',
        fontSize: 11,
        zIndex: 25,
        whiteSpace: 'nowrap',
        cursor: 'default',
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <span>{label || nodeId}</span>
    </div>
  </>
}
