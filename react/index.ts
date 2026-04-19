// Hooks
export { useGraphState } from './hooks/useGraphState'
export type { UseGraphState, GraphAction } from './hooks/useGraphState'

export { useGraphSelection, selRefEq } from './hooks/useGraphSelection'
export type { UseGraphSelection, SelectionRef, NodeRole } from './hooks/useGraphSelection'

export { useGraphMutations } from './hooks/useGraphMutations'
export type { UseGraphMutations } from './hooks/useGraphMutations'

export { useSceneIO } from './hooks/useSceneIO'
export type { UseSceneIO, UseSceneIOArgs } from './hooks/useSceneIO'

// Scene serialization (framework-free, but typically used with the hooks)
export { sceneToTS, sceneToJSON, graphToTS, parseScene } from './scene'
export type { Scene } from './scene'

// Reference components
export { default as Drawer, Row, Slider, Check } from './components/Drawer'
export type { DrawerSection } from './components/Drawer'

export { default as SelectionSection } from './components/SelectionSection'

export { default as NodeOverlay } from './components/NodeOverlay'
