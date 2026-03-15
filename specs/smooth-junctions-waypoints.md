# Smooth Junctions & Waypoints

## Problem

Split/merge junctions have large, clearly visible artifacts: gaps, overlaps, and seams where child ribbons meet the trunk. This has been the case throughout development — no junction has rendered cleanly.

Ribbons are semi-transparent, so both gaps AND overlaps produce visible seams.

Additionally:
- Bezier curvature is hardcoded; callers can't tune it per-path or per-node
- No way to specify intermediate waypoints with bearings for routing paths

## Rendering Stack Context

MapLibre GL JS has no native bezier curves. All geometry is polyline approximations: cubic beziers sampled at ~20 points → GeoJSON `Polygon` features → MapLibre `fill` layers (WebGL).

This is actually an advantage for uniform-width ribbons: true beziers can't natively produce uniform-offset curves (the offset of a cubic bezier is not a cubic bezier), but polyline approximations can be offset perpendicular at each sample point to produce a good uniform-width ribbon.

## Likely Root Cause: Polyline End-Bearing Mismatch

`cubicBezier()` samples at uniform `t` values (`0, 1/20, 2/20, ...`). The final segment (from `t=19/20` to `t=1`) has whatever direction the bezier tangent happens to have there — which generally does NOT match the desired arrival bearing exactly. When `perpAt()` computes the perpendicular at the endpoint, it averages this not-quite-right final segment direction, producing an edge position that doesn't align with the adjacent polygon's edge (which starts with a segment at the exact bearing).

This alone likely explains most of the visible seams.

## Verification & Fix Sequence

### Step 1: Adjacent polygon seam test

Verify that two polygons sharing exact vertex coordinates render seamlessly in MapLibre:
- Two adjacent rectangles (simulating width-bearing ribbons) sharing an edge
- Same test with `fill-opacity < 1`
- If this shows seams, we have a deeper stack issue; if not, the fix is about getting exact vertex alignment

### Step 2: Exact end-bearing on polyline beziers

Update `cubicBezier()` (or `directedBezier()`) to append a short final segment with the **exact desired end-bearing**. Roughly half the length of a normal inter-sample segment, so it joins naturally with the curve but guarantees the final direction matches the specified arrival bearing.

Similarly, prepend a short initial segment at the exact departure bearing.

This means `perpAt()` at the endpoints will compute perpendiculars based on segments at the exact specified bearings, so adjacent polygons that share a bearing will produce matching edge positions.

### Step 3: Forced shared junction vertices

Independent of the end-bearing fix: add a post-processing pass that **forces junction boundary vertices to be identical** from both sides. When two ribbons meet at a junction, the library computes the boundary vertices once and injects them into both polygons' coordinate rings at the shared edge.

This is a separate mechanism from exact end-bearing (Step 2). Both help, and they're complementary:
- Exact end-bearing fixes the *perpendicular direction* at the junction (so independently-computed edges would land in the right place)
- Forced shared vertices fixes the *actual coordinates* (so even if perpendicular computation has any residual floating-point drift, the vertices are identical by construction)

Both should be implemented and independently configurable (on by default).

### Step 4: Test bezier-to-bezier joins

With Steps 2–3 in place, test whether two bezier ribbons meeting at a shared point (with matching bearings) produce a seamless join. Test each fix independently and together, to characterize which contributes how much.

### Step 5: Single-polygon rendering mode

Regardless of whether Steps 1–3 fully solve seams, implement an additional rendering mode that combines all upstream and downstream components of a flow tree into a **single polygon**. The entire ferry octopus (trunk + all split/merge branches) would be one polygon as far as MapLibre is concerned — no internal seams by construction.

This works because polyline ribbons can be stitched: the left edge of child A continues into the left edge of the trunk, etc. The composite polygon's ring walks along the left edge of the entire tree, then back along the right edge.

**Both rendering modes should be supported** — callers pick between them:
- **Multi-polygon mode** (current, with exact-bearing fix): each branch is its own polygon; supports per-branch coloring/opacity/interaction
- **Single-polygon mode**: entire flow tree is one polygon; guaranteed seamless but all branches share one color/opacity

Multi-polygon is better for interactivity (hover/highlight individual branches). Single-polygon is better for visual quality when branches share the same style.

## Additional Changes

### Customizable bezier curvature

Add optional `curvature` parameter to `directedBezier`:

```ts
export function directedBezier(
  start: LatLon,
  end: LatLon,
  departBearing?: number,
  arriveBearing?: number,
  opts?: {
    /** Control-arm length as fraction of chord distance. Default ~0.4.
     *  Lower = tighter, higher = smoother.
     *  Can specify [depart, arrive] independently. */
    curvature?: number | [number, number]
  },
): LatLon[]
```

Expose on `FlowNode` so callers can tune per-node.

### Configurable approach/departure length

Currently hardcoded to `1.5 * halfWidth`. Expose on merge/split nodes as a multiplier (default 1.5).

### Waypoints with bearings

Allow intermediate waypoints on flow nodes:

```ts
interface Waypoint {
  pos: LatLon
  bearing?: number  // tangent direction (degrees, 0=N 90=E)
}
```

Path is constructed as a chain of directed bezier segments through each waypoint. Enables routing flows along geographic features with controlled tangent directions.

## Junction Fix Modes (Summary)

Three independent, complementary mechanisms for eliminating junction seams. All should be implemented and independently togglable so callers can pick the combination that works for their use case:

| Mode | What it does | Tradeoff |
|---|---|---|
| **Exact end-bearing** | Appends/prepends short segment at exact specified bearing | Fixes perpendicular direction; slight extra segment near endpoints |
| **Forced shared vertices** | Post-pass injects identical boundary vertices into both polygons | Guarantees coordinate identity; requires junction-aware bookkeeping |
| **Single-polygon** | Entire flow tree rendered as one polygon | Eliminates seams by construction; loses per-branch styling/interaction |

## Phasing

1. **Step 1**: Adjacent polygon seam test (baseline: can MapLibre tile shared-vertex polygons?)
2. **Step 2**: Exact end-bearing segments on polyline beziers
3. **Step 3**: Forced shared junction vertices
4. **Step 4**: Test joins with each fix independently and together (characterize contribution)
5. **Step 5**: Single-polygon rendering mode
6. **Step 6**: Customizable curvature, approach length, waypoints (independent improvements)

## Non-Goals

- Automatic waypoint generation / obstacle avoidance
- Changing the merge/split stacking algorithm
- Variable width along a single ribbon path
