# How should GS surface the `fill-antialias: false` recommendation?

> **Resolution (2026-04):** Shipped **Option A** — `flowFillPaint()` helper
> exported from `geo-sankey` (`src/layer.ts`). Zero runtime deps; works with
> both `react-map-gl/maplibre` and `react-map-gl/mapbox` since the return
> value is a plain paint spec. `site/src/FlowMapView.tsx` uses the helper
> as the reference callsite, and `README.md` documents it under a new
> "MapLibre / Mapbox paint defaults" section so new consumers find it
> before hitting the ghost-outline artifact.
>
> Option B (a `<FlowFillLayer>` component from a `geo-sankey/maplibre`
> subpath) remains open — worth revisiting once a second consumer appears
> and we have signal on whether the react-map-gl peerDep hit is worth the
> batteries-included ergonomics.

## The problem (what hbt ran into)

Hub-bound-travel renders multiple flow ribbons on one MapLibre `fill` layer
with `fill-opacity: ~0.85` and sorts features widest-first so narrower
ribbons draw on top of wider ones.

Where a wider ribbon (Lincoln Bus, 28,883 pax, orange) is partially occluded
by a narrower one (Amtrak, 20,180 pax, indigo), MapLibre renders an orange
line *on top of* the indigo polygon — as if LB's outline were z-above
Amtrak's fill. Looks like a rendering bug; reads as "ghost outlines".

Root cause: MapLibre's default `fill-antialias: true` does a second pass
after the fills, drawing each feature's boundary as an AA line. That pass
runs in draw order too, so the underlying (earlier-drawn) polygon's edge
ends up stroked on top of the polygon that was supposed to cover it.

Fix in hbt: `'fill-antialias': false` on the flow-fills layer. At the
pixel sizes ribbons render at (on DPR=2 displays in practice), edges are
visually indistinguishable with AA on vs off.

`site/src/FlowMapView.tsx:396` already carries `'fill-antialias': false`,
so the maintainer has hit this before. But nothing in `geo-sankey/src` or
`geo-sankey/react` tells a new consumer this is important.

The failure mode for anyone building a multi-flow ribbon map with
translucent fills is: ribbons render, look "almost right", and a ghost
outline artifact appears in overlapping regions. They won't know it's a
MapLibre paint-prop thing — they'll suspect geo-sankey's polygon output.

## Relevant layers of the stack (so the surface area is clear)

1. `geo-sankey/src` — pure-geometry. Returns `GeoJSON.FeatureCollection`.
   No runtime deps on any map library. **Cannot set paint props here.**
2. `geo-sankey/react` — editing hooks + overlay components. Takes
   `mapRef: React.RefObject<any>` and duck-types `.getMap()`, `.project()`,
   `.unproject()`, `.getCanvas()`. Works with react-map-gl/maplibre or
   react-map-gl/mapbox without importing either. **No `<Layer>` component
   is exported.**
3. Consumer (hbt, site examples) — imports `react-map-gl/maplibre` (or
   mapbox) themselves, wires up `<Source>`, `<Layer type="fill" paint={…}>`
   around GS-produced GeoJSON.

The AA-default question lives between layers 2 and 3. GS `/src` can't touch
it; consumers currently must discover it themselves.

## Options

### A) Export a plain paint-prop helper from `geo-sankey/src`

```ts
// src/layer.ts
export function flowFillPaint(overrides: Record<string, unknown> = {}) {
  return {
    'fill-color': ['get', 'color'],
    'fill-opacity': 1,
    'fill-antialias': false,
    ...overrides,
  }
}
```

Consumer code:
```tsx
<Layer id="flows" type="fill" paint={flowFillPaint({ 'fill-opacity': 0.85 })} />
```

- Pros: zero deps, works with any MapLibre/Mapbox-compatible `<Layer>`,
  map-lib-agnostic (the paint object is a plain spec that both libs read).
- Cons: not discoverable — consumers still need to know this helper exists.
  Doesn't cover Source/Layer boilerplate.

### B) Publish a `<FlowFillLayer>` in `geo-sankey/react`

A thin component that imports `Layer` from `react-map-gl/maplibre` (or
both, with a conditional import / subpath) and hardcodes `fill-antialias:
false` plus sensible paint defaults.

- Pros: most "batteries included" — consumer writes
  `<FlowFillLayer sourceId="flows" opacity={0.85} />` and the AA gotcha is
  invisible.
- Cons: forces a runtime dep on react-map-gl/maplibre (currently GS has
  none). Either:
  - Add it as a peerDep alongside `react` (cheap, but GS becomes
    map-lib-specific at that layer).
  - Split into two subpath exports: `geo-sankey/maplibre` and
    `geo-sankey/mapbox`, each importing their respective `react-map-gl/…`.
    More plumbing; still the right option if you want a component.
  - Keep the core `/react` subpath library-agnostic (as today) and put
    the layer components in a sibling package entirely
    (`geo-sankey-maplibre`). Cleanest separation; most work.

### C) Documentation-only

Add a "Gotchas" section to the README and to the types doc linking to
this spec. No code changes.

- Pros: zero commitment.
- Cons: bug-shaped — consumers keep rediscovering this. Docs pay compound
  tax.

## Asymmetry worth weighing

Setting `fill-antialias: false` is **safe** for the 99% case (ribbons,
translucent overlays) because ribbon edges are rarely single-pixel-wide
and AA barely helps. Setting it to `true` (MapLibre default) is **unsafe**
for any multi-ribbon + translucent-fill layer — it produces the ghost-
outline artifact every time. So:

- Opt-in "turn AA off" helper (option A): makes the safer choice
  available, but default behavior stays wrong-out-of-the-box for the
  main use case.
- Opt-out "we disable AA for you" component (option B): makes the
  default right-out-of-the-box, at the cost of one more layer of
  library surface area.

This is less "should we expose a helper" and more "should the library
have an opinion about how its output is rendered, or is it
render-agnostic pure geometry?"

## Concrete recommendation (uty)

My lean is **A now, consider B later**: ship `flowFillPaint()` in `src`
this week to give the hbt-style consumer a one-liner and a callsite to
read about the gotcha, and leave the `<FlowFillLayer>` question open
until someone other than hbt is writing a consumer. The map-lib-agnostic
story for `/react` is already clean — changing it for a rendering-layer
opinion feels like stepping down a road you haven't committed to.

But writing this out, the case for B is stronger than I expected: the
rendering quirk is genuinely non-obvious, and a consumer who *doesn't*
find the helper is going to ship a broken-looking map. If you'd rather
have opinionated defaults and take the `react-map-gl` peerDep hit, B
with a `geo-sankey/maplibre` subpath export seems most honest.

## Context: how hbt got here

- `www/src/components/GeoSankey.tsx` rendered all flow ribbons on one
  `<Layer type="fill">` with `fill-opacity: 0.85` (hover-dimmable).
- Features sorted widest-first, so LB (30 px, orange) was drawn below
  Amtrak (20.96 px, indigo).
- User screenshotted the overlap region and flagged "descending z order
  appears to be e.g. 1. LB arrowhead outline, 2. purple arrow and head,
  3. LB arrowhead fill". Verified that this is MapLibre's AA pass
  drawing LB's polygon boundary after Amtrak's fill.
- Applied `'fill-antialias': false` in hbt; artifact gone.
- User asked: can this be baked into GS by default? → this spec.
