import { useState, useEffect, type ReactNode } from 'react'

export interface DrawerSection {
  id: string
  title: string
  children: ReactNode
  /** Default open state. */
  defaultOpen?: boolean
}

interface Props {
  sections: DrawerSection[]
  /** Anchor side. */
  side?: 'left' | 'right'
  /** Default collapsed state for the whole drawer. */
  defaultCollapsed?: boolean
}

/**
 * Side drawer overlaying the map. Stacks collapsible sections.
 * Fully collapsible via a chevron tab so it never fully occludes the map.
 */
const SS_DRAWER_KEY = 'geo-sankey-drawer'

function loadDrawerState(): { collapsed?: boolean; openIds?: string[] } | null {
  try {
    const s = sessionStorage.getItem(SS_DRAWER_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function saveDrawerState(collapsed: boolean, openIds: Set<string>) {
  sessionStorage.setItem(SS_DRAWER_KEY, JSON.stringify({ collapsed, openIds: [...openIds] }))
}

export default function Drawer({ sections, side = 'right', defaultCollapsed = false }: Props) {
  const stored = loadDrawerState()
  const [collapsed, setCollapsedRaw] = useState(stored?.collapsed ?? defaultCollapsed)
  const [openIds, setOpenIdsRaw] = useState<Set<string>>(() =>
    stored?.openIds
      ? new Set(stored.openIds)
      : new Set(sections.filter(s => s.defaultOpen !== false).map(s => s.id))
  )
  const setCollapsed = (v: boolean | ((p: boolean) => boolean)) => {
    setCollapsedRaw(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      saveDrawerState(next, openIds)
      return next
    })
  }
  const setOpenIds = (fn: (prev: Set<string>) => Set<string>) => {
    setOpenIdsRaw(prev => {
      const next = fn(prev)
      saveDrawerState(collapsed, next)
      return next
    })
  }
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set(sections.map(s => s.id)))
  useEffect(() => {
    const newlyAdded = sections.filter(s => !seenIds.has(s.id))
    if (newlyAdded.length === 0) return
    setSeenIds(prev => {
      const next = new Set(prev)
      for (const s of sections) next.add(s.id)
      return next
    })
    setOpenIds(prev => {
      const next = new Set(prev)
      for (const s of newlyAdded) if (s.defaultOpen !== false) next.add(s.id)
      return next
    })
  }, [sections, seenIds])
  const toggle = (id: string) => setOpenIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const sideProps: React.CSSProperties = side === 'right' ? { right: 8 } : { left: 8 }
  const tabSideProps: React.CSSProperties = side === 'right'
    ? { right: collapsed ? 8 : 290 }
    : { left: collapsed ? 8 : 290 }

  return <>
    {/* Collapse/expand chevron tab */}
    <button
      onClick={() => setCollapsed(c => !c)}
      style={{
        position: 'absolute', top: 8, ...tabSideProps,
        zIndex: 22,
        background: 'var(--bg-surface, #1e1e2e)',
        color: 'var(--fg, #cdd6f4)',
        border: '1px solid var(--border, #45475a)',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 11,
        cursor: 'pointer',
        minWidth: 20,
      }}
      title={collapsed ? 'Show drawer' : 'Hide drawer'}
    >
      {collapsed
        ? (side === 'right' ? '◀' : '▶')
        : (side === 'right' ? '▶' : '◀')}
    </button>
    {!collapsed && (
      <div style={{
        position: 'absolute', top: 8, bottom: 8, ...sideProps,
        width: 280,
        background: 'var(--bg-surface, #1e1e2e)',
        color: 'var(--fg, #cdd6f4)',
        border: '1px solid var(--border, #45475a)',
        borderRadius: 6,
        fontSize: 12,
        zIndex: 20,
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}>
        {sections.map(s => {
          const open = openIds.has(s.id)
          return <div key={s.id} style={{ borderBottom: '1px solid var(--border, #45475a)' }}>
            <div
              onClick={() => toggle(s.id)}
              style={{
                padding: '6px 10px',
                fontWeight: 600,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                cursor: 'pointer',
                userSelect: 'none',
                background: 'var(--bg, #11111b)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>{s.title}</span>
              <span style={{ opacity: 0.5, fontSize: 10 }}>{open ? '▼' : '▶'}</span>
            </div>
            {open && <div style={{ padding: '8px 10px' }}>{s.children}</div>}
          </div>
        })}
      </div>
    )}
  </>
}

/** A labeled row inside a drawer section. */
export function Row({ label, children, align = 'center' }: {
  label: string
  children: ReactNode
  align?: 'start' | 'center'
}) {
  return <div style={{
    display: 'flex', alignItems: align === 'center' ? 'center' : 'flex-start',
    gap: 6, marginBottom: 4,
  }}>
    <span style={{ fontSize: 11, opacity: 0.7, minWidth: 60 }}>{label}</span>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
}

/** A range slider with label + numeric display. */
export function Slider({
  value, onChange, min, max, step, fmt,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  fmt?: (v: number) => string
}) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      style={{ flex: 1, minWidth: 0 }} />
    <span style={{ fontSize: 11, minWidth: 30, textAlign: 'right' }}>{fmt ? fmt(value) : value}</span>
  </div>
}

/** A checkbox. */
export function Check({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    {label}
  </label>
}
