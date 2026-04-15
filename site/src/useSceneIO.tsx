import { useCallback, useRef, useState } from 'react'
import type { FlowGraph } from 'geo-sankey'
import { sceneToTS, sceneToJSON, graphToTS, parseScene, type Scene } from './scene'

interface SceneOpts {
  color: string
  pxPerWeight: number
  refLat: number
  wing: number
  angle: number
  bezierN: number
  nodeApproach: number
  widthScale: number
  creaseSkip: number
}

interface View { lat: number; lng: number; zoom: number }

export interface UseSceneIOArgs {
  graph: FlowGraph
  opts: SceneOpts
  view: View
  title: string
  /** Set the graph (with a history entry). */
  pushGraph: (next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => void
  /** Apply scene opts on import. */
  applyOpts: (o: Partial<SceneOpts>) => void
  setView: (v: View) => void
  /** maplibre `Map` ref for fit-to-bounds after a view-less import. */
  mapRef: React.RefObject<any>
}

export interface UseSceneIO {
  /** Download full scene as minimized/sorted JSON. */
  exportSceneJSON: () => void
  /** Download full scene as TS literal (.ts file). */
  exportSceneTS: () => void
  /** Copy full scene TS literal to clipboard. */
  copySceneAsTS: () => Promise<void>
  /** Copy just `{ nodes, edges }` (paste directly into source FlowGraph). */
  copyGraphAsTS: () => Promise<void>
  /** Open the file picker for JSON import. */
  openImport: () => void
  /** Open the paste-import modal. */
  openPaste: () => void
  /** JSX for the modal + toast — render at the end of your component. */
  ui: React.ReactNode
}

export function useSceneIO({
  graph, opts, view, title, pushGraph, applyOpts, setView, mapRef,
}: UseSceneIOArgs): UseSceneIO {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)

  const buildScene = useCallback((): Scene => ({
    version: 1, graph, opts, view,
  }), [graph, opts, view])

  const flashHint = useCallback((msg: string) => {
    setCopyHint(msg)
    setTimeout(() => setCopyHint(null), 1800)
  }, [])

  const downloadText = useCallback((text: string, filename: string, mime: string) => {
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const baseName = title.toLowerCase().replace(/\s+/g, '-')

  const exportSceneJSON = useCallback(() => {
    downloadText(sceneToJSON(buildScene()), `${baseName}.json`, 'application/json')
  }, [buildScene, baseName, downloadText])

  const exportSceneTS = useCallback(() => {
    const ts = `// geo-sankey scene\nexport default ${sceneToTS(buildScene())}\n`
    downloadText(ts, `${baseName}.ts`, 'text/typescript')
  }, [buildScene, baseName, downloadText])

  const copyToClipboard = useCallback(async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text)
      flashHint(successMsg)
    } catch (e) {
      flashHint(`Copy failed: ${e}`)
    }
  }, [flashHint])

  const copySceneAsTS = useCallback(async () => {
    await copyToClipboard(sceneToTS(buildScene()), 'Copied scene as TS literal')
  }, [buildScene, copyToClipboard])

  const copyGraphAsTS = useCallback(async () => {
    await copyToClipboard(graphToTS(graph), 'Copied graph (paste into source)')
  }, [graph, copyToClipboard])

  const fitToGraph = useCallback((g: FlowGraph) => {
    if (!g.nodes.length) return
    const map = mapRef.current?.getMap?.()
    if (!map) return
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
    for (const n of g.nodes) {
      if (n.pos[0] < minLat) minLat = n.pos[0]
      if (n.pos[0] > maxLat) maxLat = n.pos[0]
      if (n.pos[1] < minLon) minLon = n.pos[1]
      if (n.pos[1] > maxLon) maxLon = n.pos[1]
    }
    if (minLat === maxLat && minLon === maxLon) {
      map.easeTo({ center: [minLon, minLat], zoom: 13, duration: 400 })
      return
    }
    map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 80, duration: 400 })
  }, [mapRef])

  const applyScene = useCallback((scene: Scene) => {
    pushGraph(scene.graph)
    if (scene.opts) applyOpts(scene.opts)
    if (scene.view) {
      setView(scene.view)
    } else {
      setTimeout(() => fitToGraph(scene.graph), 50)
    }
  }, [pushGraph, applyOpts, setView, fitToGraph])

  const importScene = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const scene = parseScene(reader.result as string)
        applyScene(scene)
        flashHint(`Loaded ${file.name}`)
      } catch (e) {
        flashHint(`Import failed: ${e instanceof Error ? e.message : e}`)
      }
    }
    reader.readAsText(file)
  }, [applyScene, flashHint])

  const applyPastedScene = useCallback(() => {
    setPasteError(null)
    let scene: Scene
    try {
      scene = parseScene(pasteText)
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : String(e))
      return
    }
    applyScene(scene)
    setPasteOpen(false)
    setPasteText('')
    flashHint('Pasted scene applied')
  }, [pasteText, applyScene, flashHint])

  const openImport = useCallback(() => fileInputRef.current?.click(), [])
  const openPaste = useCallback(() => setPasteOpen(true), [])

  const ui = <>
    <input ref={fileInputRef} type="file" accept=".json,.ts" style={{ display: 'none' }}
      onChange={e => { if (e.target.files?.[0]) importScene(e.target.files[0]); e.target.value = '' }} />
    {copyHint && (
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '8px 14px',
        borderRadius: 6, fontSize: 12, zIndex: 50,
      }}>{copyHint}</div>
    )}
    {pasteOpen && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} onClick={() => setPasteOpen(false)}>
        <div onClick={e => e.stopPropagation()} style={{
          background: 'var(--bg-surface, #1e1e2e)', color: 'var(--fg, #cdd6f4)',
          border: '1px solid var(--border, #45475a)', borderRadius: 8,
          padding: 16, width: 'min(720px, 90vw)', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Paste scene (full scene or bare graph)</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>
            Accepts JSON or TS literal. Bare <code>{'{ nodes, edges }'}</code> is wrapped into a scene automatically.
          </div>
          <textarea
            autoFocus
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={'{ nodes: [...], edges: [...] }\n\nor a full scene:\n{ graph: { ... }, opts: { ... }, view: { ... } }'}
            style={{
              flex: 1, minHeight: 320, fontFamily: 'monospace', fontSize: 12,
              background: 'var(--bg, #11111b)', color: 'var(--fg, #cdd6f4)',
              border: '1px solid var(--border, #45475a)', borderRadius: 4,
              padding: 8, resize: 'vertical',
            }}
          />
          {pasteError && (
            <div style={{ color: '#ef4444', fontSize: 11 }}>{pasteError}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setPasteOpen(false); setPasteText(''); setPasteError(null) }}
              style={{ fontSize: 12, padding: '4px 10px' }}>Cancel</button>
            <button onClick={applyPastedScene}
              style={{ fontSize: 12, padding: '4px 10px', background: '#14B8A6', color: '#000', fontWeight: 600 }}>
              Load
            </button>
          </div>
        </div>
      </div>
    )}
  </>

  return { exportSceneJSON, exportSceneTS, copySceneAsTS, copyGraphAsTS, openImport, openPaste, ui }
}
