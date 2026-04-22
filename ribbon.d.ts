import { LatLon } from './types';
export interface RibbonArrowOpts {
    arrowWingFactor: number;
    arrowLenFactor: number;
    widthPx?: number;
    /** Max fraction of path length the arrow can occupy. Default 0.4. */
    maxArrowFraction?: number;
}
/** Build a ribbon polygon with integrated arrowhead.
 *  Returns GeoJSON [lng, lat][] ring (closed). */
export declare function ribbonArrow(path: LatLon[], halfW: number, refLat: number, opts: RibbonArrowOpts): [number, number][];
/** Build a ribbon polygon WITHOUT arrowhead. */
export declare function ribbon(path: LatLon[], halfW: number, refLat: number): [number, number][];
/** Return left/right edges separately (same direction as path), without closing into a ring. */
export declare function ribbonEdges(path: LatLon[], halfW: number, refLat: number): {
    left: [number, number][];
    right: [number, number][];
};
/** Return left/right edges and arrow tip separately for stitching into a single polygon. */
export declare function ribbonArrowEdges(path: LatLon[], halfW: number, refLat: number, opts: RibbonArrowOpts): {
    left: [number, number][];
    right: [number, number][];
    tip: [number, number];
};
/** Wrap a [lng, lat][] ring as a GeoJSON Polygon Feature. */
export declare function ringFeature<P>(ring: [number, number][], properties: P): GeoJSON.Feature<GeoJSON.Polygon, P>;
