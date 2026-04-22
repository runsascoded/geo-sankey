import { LatLon, FlowNode, FlowTree } from './types';
/** Compute the total weight of a flow tree node. */
export declare function nodeWeight(node: FlowNode): number;
/** Collect all leaf source positions from a flow tree. */
export declare function flowSources(node: FlowNode): {
    label: string;
    pos: LatLon;
}[];
export interface RenderFlowTreeOpts {
    refLat: number;
    zoom: number;
    geoScale: number;
    color: string;
    key: string;
    /** Pixels per unit weight at current scale */
    pxPerWeight: (weight: number) => number;
    arrowWing: number;
    arrowLen: number;
    /** If true, reverse path direction (for "leaving" flows) */
    reverse?: boolean;
    /** Fraction of trunk half-width used as distance convergence threshold for
     *  plugging inner comb crevices in single-poly mode. Lower = longer crevices,
     *  higher = earlier plug. Default 0.3. Set to 0 to disable distance-based plugging. */
    plugFraction?: number;
    /** Bearing convergence threshold in degrees for plugging inner comb crevices.
     *  When adjacent inner edge directions are within this angle of parallel,
     *  the crevice is plugged. Default 1. Set to 0 to disable bearing-based plugging. */
    plugBearingDeg?: number;
}
/** Compute pixel width for a node. For merge nodes, width is the exact sum
 *  of children widths (not independently computed from total weight) to
 *  ensure seamless tiling at junctions. */
export declare function nodeWidth(node: FlowNode, pxPerWeight: (w: number) => number): number;
/** Render a single flow tree, returning GeoJSON polygon features. */
export declare function renderFlowTree(tree: FlowTree, opts: RenderFlowTreeOpts, junctionMap?: Map<string, JunctionSlot>): GeoJSON.Feature[];
/** Render a single flow tree as ONE polygon feature (no seams at junctions). */
export declare function renderFlowTreeSinglePoly(tree: FlowTree, opts: RenderFlowTreeOpts, junctionMap?: Map<string, JunctionSlot>): GeoJSON.Feature;
/** Info about a merge junction slot for a specific child */
interface JunctionSlot {
    offset: LatLon;
    bearing: number;
}
/** Build a map of merge positions → per-child junction offsets.
 *  For each merge, computes the perpendicular offset for each child
 *  based on its position in the stacking order. The map is keyed by
 *  the child's source position (so a split branch targeting that
 *  position can look up its correct offset). */
export declare function buildJunctionMap(trees: FlowTree[], opts: RenderFlowTreeOpts): Map<string, JunctionSlot>;
/** Render multiple flow trees, returning a GeoJSON FeatureCollection.
 *  Performs a compilation pass first to coordinate split→merge offsets.
 *  When `singlePoly` is true, each tree is rendered as a single polygon
 *  (no seams at junctions). */
export declare function renderFlows(trees: FlowTree[], opts: RenderFlowTreeOpts & {
    singlePoly?: boolean;
}): GeoJSON.FeatureCollection;
export {};
