import { useCallback, useEffect, useState, createContext, useContext } from 'react'
import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { HotkeysProvider, useActions, SpeedDial, Omnibar, LookupModal, ShortcutsModal } from 'use-kbd'
import 'use-kbd/styles.css'
import SeamTest from './examples/SeamTest'
import FerryTest from './examples/FerryTest'
import HBTFerry from './examples/HBTFerry'

const examples = [
  { id: 'hbt', label: 'HBT Ferry', key: '1', component: HBTFerry },
  { id: 'ferry', label: 'Simple Flow', key: '2', component: FerryTest },
  { id: 'seam-test', label: 'Seam Test', key: '3', component: SeamTest },
] as const

const exParam: Param<string> = {
  encode: (v) => v === examples[0].id ? undefined : v,
  decode: (s) => s && examples.some(e => e.id === s) ? s : examples[0].id,
}

// --- Theme ---

type Theme = 'light' | 'dark'
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} })
export const useTheme = () => useContext(ThemeContext)

export const MAP_STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} as const

function useThemeState() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('geo-sankey-theme')
    if (stored === 'dark') return 'dark'
    if (stored === 'light') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('geo-sankey-theme', theme)
  }, [theme])

  const toggle = useCallback(() => setTheme(t => t === 'light' ? 'dark' : 'light'), [])

  return { theme, toggle }
}

// --- App ---

function AppInner() {
  const [active, setActive] = useUrlState('ex', exParam)
  const Example = examples.find(e => e.id === active)!.component
  const { toggle: toggleTheme } = useTheme()

  const actions: Record<string, { label: string; group?: string; defaultBindings: string[]; handler: () => void }> = {
    toggleTheme: { label: 'Toggle theme', group: 'View', defaultBindings: ['d'], handler: toggleTheme },
  }
  for (const e of examples) {
    actions[e.id] = { label: e.label, group: 'Examples', defaultBindings: [e.key], handler: () => setActive(e.id) }
  }
  useActions(actions)

  return (
    <div className="app">
      <header>
        <h1>geo-sankey</h1>
        <nav>
          {examples.map(e => {
            const params = new URLSearchParams(window.location.search)
            params.set('ex', e.id)
            const href = `?${params.toString()}`
            return (
              <a
                key={e.id}
                href={href}
                className={e.id === active ? 'active' : ''}
                onClick={ev => {
                  if (!ev.metaKey && !ev.ctrlKey) {
                    ev.preventDefault()
                    setActive(e.id)
                  }
                }}
                title={`Shortcut: ${e.key}`}
              >
                {e.label}
              </a>
            )
          })}
        </nav>
      </header>
      <main>
        <Example />
      </main>
      <SpeedDial
        actions={[
          {
            key: 'theme',
            label: 'Toggle theme (d)',
            icon: <span style={{ fontSize: 18 }}>🌓</span>,
            onClick: toggleTheme,
          },
        ]}
      />
      <Omnibar />
      <LookupModal />
      <ShortcutsModal />
    </div>
  )
}

export default function App() {
  const themeState = useThemeState()
  return (
    <ThemeContext.Provider value={themeState}>
      <HotkeysProvider>
        <AppInner />
      </HotkeysProvider>
    </ThemeContext.Provider>
  )
}
