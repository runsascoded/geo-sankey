import { useState } from 'react'

const { atan2, PI, cos, sin, round } = Math

export default function BearingDial({ value, onChange, size = 56 }: {
  value: number
  onChange: (deg: number) => void
  size?: number
}) {
  const r = size / 2
  const [hover, setHover] = useState<number | null>(null)

  const calcDeg = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - rect.left - r
    const dy = e.clientY - rect.top - r
    return round(((atan2(dx, -dy) * 180 / PI) + 360) % 360)
  }

  const display = hover ?? value
  const cardinals = [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const

  const arm = (deg: number, color: string, opacity = 1) => {
    const a = (deg - 90) * PI / 180
    const ex = r + (r - 6) * cos(a), ey = r + (r - 6) * sin(a)
    return <g opacity={opacity}>
      <line x1={r} y1={r} x2={ex} y2={ey} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={ex} cy={ey} r={3} fill={color} />
    </g>
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{ width: size, height: size, cursor: 'crosshair', flexShrink: 0, userSelect: 'none', position: 'relative' }}
        onMouseDown={e => { e.stopPropagation(); onChange(calcDeg(e)) }}
        onMouseMove={e => {
          e.stopPropagation()
          if (e.buttons > 0) onChange(calcDeg(e))
          else setHover(calcDeg(e))
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg width={size} height={size} style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0 }}>
          <circle cx={r} cy={r} r={r - 2} fill="var(--bg, #11111b)" stroke="var(--border, #45475a)" strokeWidth={1} />
          {cardinals.map(([label, deg]) => {
            const a = (deg - 90) * PI / 180
            return <text key={label} x={r + (r - 12) * cos(a)} y={r + (r - 12) * sin(a)} textAnchor="middle" dominantBaseline="central" fontSize={8} fill="var(--fg-muted, #a3a3a3)">{label}</text>
          })}
          {hover != null && hover !== value && arm(hover, '#14B8A6', 0.3)}
          {arm(value, '#14B8A6')}
          <circle cx={r} cy={r} r={2} fill="var(--fg, #cdd6f4)" />
        </svg>
      </div>
      <span style={{ fontSize: 11, minWidth: 24 }}>{display}&deg;</span>
    </div>
  )
}
