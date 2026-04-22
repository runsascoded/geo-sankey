import { LatLon } from './types';
export interface NodeStyle {
    color?: string;
    radius?: number;
    icon?: string;
    labelColor?: string;
    labelSize?: number;
    labelOffset?: [number, number];
    hidden?: boolean;
}
export interface EdgeStyle {
    /** Ribbon fill color for this edge (overrides `FlowGraphOpts.color`). */
    color?: string;
    /** Per-edge opacity multiplier (0..1), composed with the page-level opacity. */
    opacity?: number;
    /** Multiplier on `pxPerWeight` for this edge's ribbon width. Default 1. */
    widthScale?: number;
}
export interface GFlowNode {
    id: string;
    pos: LatLon;
    /** Bearing of throughput axis (degrees, 0=N 90=E). Inputs merge from
     *  behind, outputs split ahead. Optional — auto-derived for nodes with
     *  a single output or sinks with a single input; defaults to 90. */
    bearing?: number;
    /** Bezier control-point distance for edges at this node (G1 smoothness:
     *  all edges leaving/arriving share one velocity). Units: scaled-degree
     *  space used internally by `directedBezier`. Undefined → heuristic. */
    velocity?: number;
    label?: string;
    style?: NodeStyle;
}
export interface GFlowEdge {
    from: string;
    to: string;
    /** Numeric weight, or `'auto'` to derive from upstream inputs. */
    weight: number | 'auto';
    style?: EdgeStyle;
}
export interface FlowGraph {
    nodes: GFlowNode[];
    edges: GFlowEdge[];
}
export interface FlowGraphOpts {
    refLat: number;
    zoom: number;
    geoScale?: number;
    /** Pixels of ribbon width per unit weight. Ignored if `mPerWeight` is set. */
    pxPerWeight: number | ((w: number) => number);
    /** Real-world meters per unit weight; overrides `pxPerWeight` when set,
     *  computing px-per-frame from the current zoom + `refLat`. */
    mPerWeight?: number;
    color: string;
    arrowWing?: number;
    arrowLen?: number;
    wing?: number;
    angle?: number;
    minArrowWingPx?: number;
    plugBearingDeg?: number;
    plugFraction?: number;
    bezierN?: number;
    nodeApproach?: number;
    creaseSkip?: number;
}
/** Resolve `'auto'` edge weights via topological propagation:
 *  - Through-node output (1 input, 1 output): output = input weight.
 *  - Merge output (≥1 input, 1 auto output): output = sum of inputs.
 *  - Split outputs (1 input, multiple outputs): auto outputs share the
 *    remainder (input − sum of explicit outputs) equally.
 *  Unresolvable edges (cycles, missing source weight) default to 0
 *  with a console warning. */
export declare function resolveEdgeWeights(graph: FlowGraph): Map<string, number>;
/** Return debug geometry: edge center-line beziers and approach rectangles. */
export declare function renderFlowGraphDebug(graph: FlowGraph, opts: FlowGraphOpts): GeoJSON.FeatureCollection;
/** Return per-edge bezier centerlines as LineString features. Used by the
 *  editor to hit-test edges even when the ribbon rendering merges them
 *  (singlePoly mode) or a user wants an invisible selection overlay. */
export declare function renderEdgeCenterlines(graph: FlowGraph, opts: FlowGraphOpts): GeoJSON.FeatureCollection;
export declare function renderFlowGraph(graph: FlowGraph, opts: FlowGraphOpts): GeoJSON.FeatureCollection;
/** Render a flow graph as a single polygon per connected component. */
export declare function renderFlowGraphSinglePoly(graph: FlowGraph, opts: FlowGraphOpts): GeoJSON.FeatureCollection;
export type NodeRole = 'source' | 'sink' | 'split' | 'merge' | 'through';
export interface NodePointProperties {
    id: string;
    label: string;
    role: NodeRole;
    bearing: number;
    color?: string;
    radius?: number;
    icon?: string;
    labelColor?: string;
    labelSize?: number;
    labelOffset?: [number, number];
    hidden?: boolean;
    [k: string]: unknown;
}
/** Classify each node and return a GeoJSON FeatureCollection of Points.
 *  Each feature carries `NodePointProperties` including the node's role
 *  (source/sink/split/merge/through) and any per-node style overrides. */
export declare function renderNodes(graph: FlowGraph, filter?: 'all' | 'endpoints' | NodeRole[]): GeoJSON.FeatureCollection<GeoJSON.Point>;
