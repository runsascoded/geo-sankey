import { useCallback, useEffect, useState } from 'react'
import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { HotkeysProvider, useHotkeys } from 'use-kbd'
import MultiTreeMerge from './examples/MultiTreeMerge'
import ParallelRibbons from './examples/ParallelRibbons'
import SeamTest from './examples/SeamTest'
import FerryTest from './examples/FerryTest'

const examples = [
  { id: 'multi-tree', label: 'Flow Tree Merge', key: '1', component: MultiTreeMerge },
  { id: 'parallel', label: 'Parallel Ribbons', key: '2', component: ParallelRibbons },
  { id: 'seam-test', label: 'Seam Test', key: '3', component: SeamTest },
  { id: 'ferry', label: 'Hudson Ferry', key: '4', component: FerryTest },
] as const

const exParam: Param<string> = {
  encode: (v) => v === examples[0].id ? undefined : v,
  decode: (s) => s && examples.some(e => e.id === s) ? s : examples[0].id,
}

function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('geo-sankey-theme')
    if (stored === 'dark') return 'dark'
    if (stored === 'light') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('geo-sankey-theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    setThemeState(t => t === 'light' ? 'dark' : 'light')
  }, [])

  return { theme, toggle }
}

function AppInner() {
  const [active, setActive] = useUrlState('ex', exParam)
  const Example = examples.find(e => e.id === active)!.component
  const { theme, toggle: toggleTheme } = useTheme()

  const keymap: Record<string, string> = { toggleTheme: 'd' }
  const handlers: Record<string, () => void> = { toggleTheme }
  for (const e of examples) {
    keymap[e.id] = e.key
    handlers[e.id] = () => setActive(e.id)
  }
  useHotkeys(keymap, handlers)

  return (
    <div className="app">
      <header>
        <h1>geo-sankey</h1>
        <nav>
          {examples.map(e => (
            <button
              key={e.id}
              className={e.id === active ? 'active' : ''}
              onClick={() => setActive(e.id)}
              title={`Shortcut: ${e.key}`}
            >
              {e.label}
            </button>
          ))}
        </nav>
        <button className="theme-toggle" onClick={toggleTheme} title="Shortcut: d">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </header>
      <main>
        <Example />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <HotkeysProvider>
      <AppInner />
    </HotkeysProvider>
  )
}
