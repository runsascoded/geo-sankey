import { FlowGraph } from 'geo-sankey';
interface SceneOpts {
    color: string;
    pxPerWeight: number;
    refLat: number;
    wing: number;
    angle: number;
    bezierN: number;
    nodeApproach: number;
    widthScale: number;
    creaseSkip: number;
}
interface View {
    lat: number;
    lng: number;
    zoom: number;
}
export interface UseSceneIOArgs {
    graph: FlowGraph;
    opts: SceneOpts;
    view: View;
    title: string;
    /** Set the graph (with a history entry). */
    pushGraph: (next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => void;
    /** Apply scene opts on import. */
    applyOpts: (o: Partial<SceneOpts>) => void;
    setView: (v: View) => void;
    /** maplibre `Map` ref for fit-to-bounds after a view-less import. */
    mapRef: React.RefObject<any>;
}
export interface UseSceneIO {
    /** Download full scene as minimized/sorted JSON. */
    exportSceneJSON: () => void;
    /** Download full scene as TS literal (.ts file). */
    exportSceneTS: () => void;
    /** Copy full scene TS literal to clipboard. */
    copySceneAsTS: () => Promise<void>;
    /** Copy just `{ nodes, edges }` (paste directly into source FlowGraph). */
    copyGraphAsTS: () => Promise<void>;
    /** Open the file picker for JSON import. */
    openImport: () => void;
    /** Open the paste-import modal. */
    openPaste: () => void;
    /** JSX for the modal + toast — render at the end of your component. */
    ui: React.ReactNode;
}
export declare function useSceneIO({ graph, opts, view, title, pushGraph, applyOpts, setView, mapRef, }: UseSceneIOArgs): UseSceneIO;
export {};
