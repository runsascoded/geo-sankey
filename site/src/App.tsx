import { useCallback, useEffect, useState, createContext, useContext } from 'react'
import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { HotkeysProvider, useActions, SpeedDial, Omnibar, LookupModal, ShortcutsModal } from 'use-kbd'
import 'use-kbd/styles.css'
import About from './examples/About'
import SeamTest from './examples/SeamTest'
import FerryTest from './examples/FerryTest'
import HBTFerry from './examples/HBTFerry'

const examples = [
  { id: 'about', label: 'About', key: '1', component: About },
  { id: 'hbt', label: 'HBT Ferry', key: '2', component: HBTFerry },
  { id: 'ferry', label: 'Simple Flow', key: '3', component: FerryTest },
  { id: 'seam-test', label: 'Seam Test', key: '4', component: SeamTest },
] as const

const GH_URL = 'https://github.com/runsascoded/geo-sankey'

const GitHubIcon = ({ size = 18 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.57.1.78-.25.78-.55v-2c-3.2.7-3.88-1.38-3.88-1.38-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.33.96.1-.74.4-1.25.72-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.21-1.5 3.18-1.18 3.18-1.18.62 1.6.23 2.77.11 3.06.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.35.78 1.05.78 2.12v3.14c0 .3.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/>
  </svg>
)

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
        <span className="tagline">Width-proportional flow maps</span>
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
        <div className="header-right">
          <a href={GH_URL} target="_blank" rel="noreferrer" title="GitHub">
            <GitHubIcon />
          </a>
        </div>
      </header>
      <main>
        <Example />
      </main>
      <SpeedDial
        actions={[
          {
            key: 'github',
            label: 'GitHub',
            icon: <GitHubIcon size={20} />,
            href: GH_URL,
            external: true,
          },
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
