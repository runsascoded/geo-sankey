# Arrow defaults: ship the demo settings as library defaults

## Problem

Library defaults for arrowhead geometry diverge from the values used on
the public demo (https://geo-sankey.rbw.sh/) and from what looks "right"
in real flow-map applications.

In `src/graph.ts`, `resolveArrow()` defaults are:

```ts
const wing  = opts.wing  ?? 0.4
const angle = opts.angle ?? 45
```

The demo's "Page Defaults" panel ships **`wing = 0.65, angle = 60`**.

Downstream apps (e.g. `hbt` / `hudson-transit`) hand-pick arrow factors
and end up with inconsistent results across pages — `/` looks fine,
`/nyc` ends up with stubby/pinched arrows because the developer (or
LLM) chose smaller numbers without realizing the demo had richer
defaults.

In addition, `ribbonArrow()` and `ribbonArrowEdges()` in `src/ribbon.ts`
take **no** defaults at all — `arrowWingFactor` and `arrowLenFactor`
are required. Apps that use the bare ribbon API have nothing to fall
back on, and inevitably pick suboptimal numbers.

## Goals

1. Lib defaults match the demo (`wing = 0.65, angle = 60`).
2. `ribbonArrow()` / `ribbonArrowEdges()` accept optional
   `arrowWingFactor`/`arrowLenFactor`, falling back to the same defaults
   (computed from wing/angle) — i.e. they should be optional.
3. Export a tiny helper (`resolveArrowDefaults({ wing?, angle? })`) so
   downstream apps that don't pass a full `FlowGraphOpts` (e.g. when
   using `ribbonArrow` directly) can produce identical results to the
   `FlowGraph*` codepath.
4. Bump version + note the change in CHANGELOG.

## Why these specific values

`wing = 0.65, angle = 60` produces arrows that:
- are wide enough to read clearly at small ribbon widths
- have a 60° internal angle that reads as "arrowy" rather than
  "spear-like" (45°) or "stubby" (>75°)
- match the original visual identity established by the demo

If a project wants the prior "spearier" look, they pass `wing = 0.4,
angle = 45` explicitly — the change is opt-out, not opt-in.

## Computed equivalents

With `wing = 0.65, angle = 60`:

```
arrowWingFactor = 1 + 2 * wing            = 2.3
arrowLenFactor  = arrowWing * tan(60°)/2  ≈ 1.99
```

vs. the current defaults (`wing = 0.4, angle = 45`):

```
arrowWingFactor = 1.8
arrowLenFactor  = 0.9
```

## Surface-area changes

- `src/graph.ts`: `resolveArrow()` defaults `wing` → `0.65`, `angle` →
  `60`.
- `src/ribbon.ts`: make `arrowWingFactor` / `arrowLenFactor` optional
  in `RibbonArrowOpts`; fall back to the resolved defaults.
- `src/index.ts`: export `resolveArrowDefaults({ wing?, angle? })`
  returning `{ arrowWingFactor, arrowLenFactor }`.
- Update the demo so its visible "Page Defaults" still match (no-op if
  the demo is just reading the lib defaults).

## Acceptance

- All existing tests pass with the new defaults (some snapshot updates
  expected for any tests asserting on geometry).
- A simple "happy path" test: `ribbonArrow` with no arrow opts produces
  identical geometry to passing `arrowWingFactor: 2.3, arrowLenFactor:
  ≈1.99` explicitly.
- Demo screenshots in the README regenerate with no visible regression.

## Out of scope

- Changing the wing/angle parameterization itself.
- Changing the `widthPx`-based wing scaling (the `+ (8 - widthPx) *
  0.15` term in `ribbon.ts`); that auto-correction stays.
