# Cross-Tree Flow Rendering Regression

## Problem

Multi-polygon rendering of cross-tree split→merge flows is broken. Visible gaps appear at merge junctions where split branches from one tree should connect to merge positions in another tree. This is a regression from the commits after the initial `8b4fa32` extraction.

Additionally, `singlePoly: true` doesn't work at all for cross-tree flows — branches from the split tree are missing entirely.

## Concrete Test Case: Hudson Transit Ferry Layout

Three trees coordinated via junction map:

```ts
const HOB_SO_SPLIT: LatLon = [40.7359, -74.0230]
const UT_MERGE: LatLon = [40.7530, -74.0160]
const DT_MERGE: LatLon = [40.7142, -74.0210]

const FERRY_TREES: FlowTree[] = [
  // Tree 1: MT39 destination (uptown merge)
  {
    dest: 'MT39',
    destPos: [40.7555, -74.0060],
    root: {
      type: 'merge',
      pos: [40.7565, -74.0120],
      bearing: 110,
      children: [
        {
          type: 'merge',
          pos: UT_MERGE,
          bearing: 30,
          children: [
            // Weight-only placeholder (visual path drawn by split tree)
            { type: 'source', label: '', pos: UT_MERGE, weight: 0.15 },
            { type: 'source', label: 'Hob 14', pos: [40.7505, -74.0241], weight: 0.20, bearing: 90 },
          ],
        },
        { type: 'source', label: 'WHK', pos: [40.7771, -74.0136], weight: 0.30 },
      ],
    },
  },
  // Tree 2: BPT destination (downtown merge)
  {
    dest: 'BPT',
    destPos: [40.7142, -74.0169],
    root: {
      type: 'merge',
      pos: DT_MERGE,
      bearing: 90,
      children: [
        { type: 'source', label: 'PH', pos: [40.7138, -74.0337], weight: 0.20 },
        // Weight-only placeholder (visual path drawn by split tree)
        { type: 'source', label: '', pos: DT_MERGE, weight: 0.15 },
      ],
    },
  },
  // Tree 3: Hob So split — branches connect to Trees 1 and 2
  {
    dest: 'Hob So',
    destPos: [40.7359, -74.0275],
    root: {
      type: 'split',
      pos: HOB_SO_SPLIT,
      bearing: 90,
      children: [
        // S branch → DT merge (Tree 2)
        { type: 'source', label: '', pos: DT_MERGE, weight: 0.15, bearing: 90 },
        // N branch → UT sub-merge (Tree 1)
        { type: 'source', label: '', pos: UT_MERGE, weight: 0.15, bearing: 90 },
      ],
    },
  },
]
```

## Expected Behavior

With `renderFlows(FERRY_TREES, { ...opts, singlePoly: true })`:
- Tree 3's split branches should render as ribbons connecting to the correct offset positions in Trees 1 and 2 (via `junctionMap`)
- Each tree is its own polygon, but the split branches' endpoints align with the merge junctions in the other trees
- Currently: Tree 3's split branches don't target the correct positions; Trees 1 and 2 may have missing/broken merge children

## Root Cause

### Multi-polygon regression

The `renderNode` function was refactored between `8b4fa32` and current HEAD:
- `straightEnd?: LatLon` (single point appended to path) was replaced with `approachPts?: LatLon[]` (array from `straightLine(..., 5).slice(1)`)
- New path construction logic has multiple branches (`isTerminalSplit`, `terminal && isMergeOrSplit`, etc.) that may not correctly handle the cross-tree case where a merge child is a weight-only placeholder (`label: ''`) with `pos` matching the merge center

The original working code was simple:
```ts
renderNode(node.children[ci], childApproach, false, node.bearing, childEnd)
```
The new code generates approach points differently, and the junction geometry doesn't align.

### Single-poly mode

`renderFlowTreeSinglePoly` uses `collectEdges` which handles split children inline — but when a split child's position matches a `junctionMap` entry (cross-tree merge), the offset targeting may not be applied correctly in the edge-collection path.

## Fix

### Multi-polygon (priority — this is a regression)

Compare `renderNode` at `8b4fa32` vs HEAD. The cross-tree ferry layout (above) must render correctly in multi-polygon mode — split branches should connect flush to merge junctions with no gaps. This worked at `8b4fa32`.

Key things to verify:
- Weight-only placeholder sources (`label: ''`) at merge positions
- The `approachPts` refactor didn't break the junction geometry
- `junctionMap` lookup for split children targeting merge positions in other trees

### Single-poly mode

Ensure `collectEdges` (or `stitchSplit`) performs the same `junctionMap` lookup as `renderNode`:
1. When processing a split child, check `junctionMap.get(posKey(splitChild.pos))`
2. If found, use `slot.offset` as the child target position and `slot.bearing` as the arrival bearing
3. This should produce correct bezier curves from split departure to merge offset positions

## Testing

- Add a demo/test using the exact ferry layout above
- **Multi-polygon**: verify no gaps at merge junctions (regression test against `8b4fa32` behavior)
- **Single-poly**: verify split branches render and land at correct merge offset positions
- Both modes should produce visually equivalent results (modulo per-branch coloring)
