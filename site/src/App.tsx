import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { HotkeysProvider, useHotkeys, KbdOmnibar } from 'use-kbd'
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

function AppInner() {
  const [active, setActive] = useUrlState('ex', exParam)
  const Example = examples.find(e => e.id === active)!.component

  const keymap: Record<string, string> = {}
  const handlers: Record<string, () => void> = {}
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
