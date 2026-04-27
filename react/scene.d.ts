import { FlowGraph } from 'geo-sankey';
export interface Scene {
    version?: number;
    graph: FlowGraph;
    opts?: Partial<{
        color: string;
        pxPerWeight: number;
        refLat: number;
        wing: number;
        angle: number;
        bezierN: number;
        nodeApproach: number;
        widthScale: number;
        creaseSkip: number;
    }>;
    view?: {
        lat: number;
        lng: number;
        zoom: number;
    };
}
declare function fmtKey(k: string): string;
/** Serialize a Scene as a TS literal expression (no `const` prefix).
 *  Output is sorted (nodes by id, edges by from→to) for diff-friendliness. */
export declare function sceneToTS(scene: Scene): string;
/** Serialize just the `{ nodes, edges }` portion as a TS literal — the
 *  shape users have in their source files. Paste-friendly for the
 *  "edit diagram in browser → feed to claude → update source" flow. */
export declare function graphToTS(g: FlowGraph): string;
/** Same sort+strip as `sceneToTS` but emitted as canonical JSON with
 *  2-space indent. Good for a diff-friendly download. */
export declare function sceneToJSON(scene: Scene): string;
/** Parse a Scene (or a bare graph literal) from TS-literal or JSON text.
 *  Tries JSON first; falls back to `new Function('return …')` for TS-literal
 *  syntax (single-quoted strings, unquoted keys, trailing commas). The
 *  latter is `eval`-equivalent — only call on text the user pasted
 *  themselves. Input forms accepted:
 *  - Full scene: `{ graph: { nodes, edges }, opts?, view? }`
 *  - Bare graph: `{ nodes, edges }` — wrapped into a scene automatically. */
export declare function parseScene(text: string): Scene;
export declare const _internal: {
    fmtKey: typeof fmtKey;
    KEY_RE: RegExp;
};
export {};
