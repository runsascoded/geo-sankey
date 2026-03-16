import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import MultiTreeMerge from './examples/MultiTreeMerge'
import ParallelRibbons from './examples/ParallelRibbons'
import SeamTest from './examples/SeamTest'

const examples = [
  { id: 'multi-tree', label: 'Flow Tree Merge', component: MultiTreeMerge },
  { id: 'parallel', label: 'Parallel Ribbons', component: ParallelRibbons },
  { id: 'seam-test', label: 'Seam Test', component: SeamTest },
] as const

const exParam: Param<string> = {
  encode: (v) => v === examples[0].id ? undefined : v,
  decode: (s) => s && examples.some(e => e.id === s) ? s : examples[0].id,
}

export default function App() {
  const [active, setActive] = useUrlState('ex', exParam)
  const Example = examples.find(e => e.id === active)!.component

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
