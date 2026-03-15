# Adaptive Bezier-Polyline Tessellation

## Problem

Bezier curves are approximated as polylines with a fixed sample count (`n=20` in `cubicBezier()`). At high zoom levels, the individual straight segments become visible — the "curve" looks like a polygon. At low zoom levels, 20 samples is overkill for curves that occupy a few pixels on screen.

## Proposed Fix

Re-tessellate bezier-polylines (BPLs) based on zoom level, so segments are always fine enough to look smooth but not wastefully dense.

### Option A: Zoom-adaptive sample count

Scale `n` with zoom. At zoom 10 a curve might need 8 samples; at zoom 16 it might need 64. The key metric is **maximum segment length in screen pixels** — segments should never exceed some threshold (e.g. 2–4px) at the current zoom.

```ts
function adaptiveBezier(
  p0: LatLon, p1: LatLon, p2: LatLon, p3: LatLon,
  opts: {
    zoom: number
    refLat: number
    /** Max segment length in screen pixels. Default 3. */
    maxSegmentPx?: number
  },
): LatLon[]
```

Estimate total curve length in pixels (chord length × ~1.2 as a rough bezier-to-chord ratio), divide by `maxSegmentPx` to get `n`.

### Option B: Curvature-adaptive sampling

Sample densely where curvature is high (tight bends) and sparsely where curvature is low (nearly straight). This is more sophisticated and produces fewer points for the same visual quality. Could be combined with Option A (curvature-adaptive within a zoom-determined budget).

### Option C: Re-render on zoom change

The simplest approach: keep `n` fixed but re-run `renderFlows()` on zoom change, passing the current zoom so the library can adjust sample counts. This is what we'd need anyway if ribbon widths are in pixels (geo-scaled rendering already depends on zoom).

Currently hudson-transit already re-renders on zoom change (for width scaling). So this may just be a matter of threading `zoom` into `cubicBezier()` calls.

## Recommendation

Option C (re-render on zoom) combined with Option A (zoom-adaptive `n`). The re-render already happens; we just need `cubicBezier` to accept zoom and compute an appropriate `n`. Option B (curvature-adaptive) is a nice-to-have refinement but not necessary for v1.

## Interaction with Junction Fixes

Adaptive tessellation interacts with the exact-end-bearing fix from the [junctions spec](smooth-junctions-waypoints.md): the appended end-bearing segment should be half the length of the adaptive segment size (not a fixed length), so it scales with zoom too.

## Non-Goals

- Simplifying polylines at low zoom (removing points) — MapLibre handles this internally for rendering
- Level-of-detail for the flow tree structure itself (hiding small flows at low zoom) — separate concern
