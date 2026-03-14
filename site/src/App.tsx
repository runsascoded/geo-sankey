import { useState } from 'react'
import MultiTreeMerge from './examples/MultiTreeMerge'
import ParallelRibbons from './examples/ParallelRibbons'

const examples = [
  { id: 'multi', label: 'Flow Tree Merge', component: MultiTreeMerge },
  { id: 'parallel', label: 'Parallel Ribbons', component: ParallelRibbons },
] as const

export default function App() {
  const [active, setActive] = useState<string>(examples[0].id)
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
