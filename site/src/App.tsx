import { useState } from 'react'
import BasicFlowTree from './examples/BasicFlowTree'
import MultiTreeMerge from './examples/MultiTreeMerge'

const examples = [
  { id: 'basic', label: 'Basic Flow Tree', component: BasicFlowTree },
  { id: 'multi', label: 'Multi-Tree Merge', component: MultiTreeMerge },
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
