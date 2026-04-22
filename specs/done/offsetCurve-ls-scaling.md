# `offsetCurve` renders ribbons ~1/ls too narrow (≈76% at lat 40.74)

## Symptom

In hbt (hud-bound-travel), a ferry edge with effective pixel width 1.58 px
renders at a rendered perpendicular of ~36 m, while a tunnel ribbon at
1.55 px renders at ~46 m. The ratio is ≈ 0.79 = 1/ls(40.74°) =
cos(40.74°).

`ribbon.ts` helpers (used for non-graph flows) produce correct widths.
`offsetCurve` in `graph.ts` (used by `renderFlowGraph` +
`renderFlowGraphSinglePoly`) produces widths shrunken by 1/ls.

## Root cause

`offsetCurve` computes segment perpendiculars in a Mercator-scaled frame
where `dy = dLat * ls` and `dx = dLon`. That's fine for direction, but
the offset application at graph.ts:349–350 is:

```ts
left.push([path[i][1] + pLon * halfW,       path[i][0] + pLat * halfW / ls])
right.push([path[i][1] - pLon * halfW,      path[i][0] - pLat * halfW / ls])
```

`halfW` comes from `pxToHalfDeg` and is in degrees-of-latitude. To apply
it as a geometric offset:

- Longitude offset (deg lon) = `pLon * halfW * ls` (convert lat-deg → lon-deg at this latitude).
- Latitude offset (deg lat) = `pLat * halfW` (already in the right units).

The current formula drops `* ls` from the lon term and divides the lat
term by `ls`, i.e. shrinks both by 1/ls.

Compare `ribbon.ts:85` which does it correctly:

```ts
left.push([path[i][1] + pLng * halfW * ls, path[i][0] + pLat * halfW])
```

## Fix

Change graph.ts:349–350 to:

```ts
left.push([path[i][1] + pLon * halfW * ls, path[i][0] + pLat * halfW])
right.push([path[i][1] - pLon * halfW * ls, path[i][0] - pLat * halfW])
```

## Verification

At lat 40.74 (ls ≈ 1.32), a 1.58 px wide ribbon should render at ≈ 46 m
perpendicular width (matching non-graph flows of the same px width). hbt
polygon measurement pre-fix: 36 m. Post-fix expected: 46 m.

Test: render the same graph as an E-W chain and an N-S chain, measure
polygon perpendicular in meters — should match each other and match
`ribbon.ts` output for the same `halfW`.
