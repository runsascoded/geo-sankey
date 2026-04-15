# LRU-linked weight propagation (research spec)

## Context

The current `'auto'` edge-weight system (P4.1) is one-directional: edits on
explicit upstream weights flow to downstream `'auto'` edges via topological
resolution. But users editing a downstream value can't influence an
upstream value — and at split nodes, marking siblings `'auto'` would silently
equalize them, losing the user-set ratios.

A more flexible model: treat each node's flow-conservation constraint
(`Σ inputs = Σ outputs`) as an **invariant** over a *linked set* of edges.
When the user edits any one edge in the set, the **least-recently-set**
edge in that set is recomputed to preserve the invariant. Users can grab
*any* knob; the system always derives one of the others.

`/Users/ryan/c/rac/mortgage-viz/src/lib/model.ts` already implements this
pattern for mortgage parameters (purchase price ↔ down payment ↔ principal,
plus a PMT circuit). Each constraint is a closure with manual math; LRU
order is tracked via an explicit `userSetOrder: FieldName[]` queue, and the
*oldest* user-set field in an overdetermined constraint becomes derived.

This spec asks: should we factor out the LRU-linked-variables abstraction
into its own small library, then build geo-sankey's flow-conservation on
top of it?

## What mortgage-viz does today

- **State**: `MortgageModel` class holds field values + per-field
  `source: 'user' | 'derived'` + an LRU queue.
- **API**: `model.get(field)`, `model.set(field, value)`, `model.getSource(field)`.
- **Constraints**: three hardcoded closures (triangle, %, PMT). Each
  resolver:
  1. Counts user-set fields in the constraint.
  2. If under-determined, derives the non-user-set field.
  3. If overdetermined, derives the **oldest** user-set field
     (`oldestInConstraint(fields)`).
- **Limitations**: mortgage-specific field names, no generic solver, PMT
  rate-derivation skipped (would need numerical solving), constraint
  resolvers run in a fixed sequence so cycles are avoided by convention.

## The library factoring

Working title: **`lru-linked`** (or similar). Public surface, sketch:

```ts
type FieldId = string

interface LinkedSet<F extends FieldId = FieldId> {
  /** All fields in this constraint. */
  fields: readonly F[]
  /** Given the values of `fields \ target`, compute `target`.
   *  Return `null` if not derivable (e.g. inverse not implemented). */
  derive(target: F, values: Record<F, number>): number | null
}

class LinkedModel<F extends FieldId = FieldId> {
  constructor(initial: Record<F, number>, sets: LinkedSet<F>[])
  get(field: F): number
  source(field: F): 'user' | 'derived'
  set(field: F, value: number): void  // re-resolves all affected sets
  values(): Record<F, number>
  // optional:
  freeze(field: F): void   // pin a field as user-set even without an edit
  unfreeze(field: F): void // mark as derivable again
}
```

Internals:
- One LRU queue across all fields (per mortgage-viz).
- On `set(field, value)`: mark field user, push to LRU end, then re-resolve
  every `LinkedSet` that contains `field`. Re-resolution may flip another
  field to derived (the LRU one in that set), which can cascade through
  other sets that contain *that* field. Iterate to a fixed point.
- Hard-cap iteration depth to detect over-constrained / cyclic cases.

Decisions to nail down before writing code:
- **Generic vs. domain-shaped.** The mortgage code uses bespoke math per
  constraint; abstracting `derive(target, values)` as user-supplied keeps
  the library tiny but pushes math onto callers. Probably fine — a
  generic numerical solver is overkill for v1.
- **Data shape.** Mortgage model uses an OO class. For React/Vite apps a
  `useLinkedModel(initial, sets)` hook returning `[values, set, sources]`
  is more idiomatic and avoids manual `useState` wiring.
- **Per-set vs. global LRU.** mortgage-viz is global (one queue); for
  geo-sankey, per-node-constraint LRU might be cleaner since splits and
  merges are independent. Worth prototyping both.
- **Validation hooks.** mortgage-viz returns a per-field error map
  (`validate()`); geo-sankey wants the same for "weight became negative
  after rebalance".

## How geo-sankey would use it

Each node `n` defines one `LinkedSet`:
- Fields: the IDs of all incident edges (`{from→n}` ∪ `{n→to}`).
- Constraint: `Σ inputs − Σ outputs = 0`.
- `derive(target, values)`: solve for `target`. Easy because the
  constraint is linear in each field — `target = Σ others (in) − Σ others (out)`
  with the right sign.

Source nodes (no inputs) and sink nodes (no outputs) don't define a
constraint — their incident edges are free unless the user pins them.

Behaviorally:
- All edges start "explicit"; the user-set queue starts empty (or seeded
  from the initial scene's order).
- Editing any edge inside a constraint causes the LRU sibling to flip
  to "derived" and recompute. The current `'auto'` flag goes away
  (or becomes the manually-pinned-derived state — i.e., a user-explicit
  decision to never let a particular edge become user-set even on edit).
- At a split, editing one output rebalances the LRU output to absorb
  the delta — exactly the user's mortgage-viz example.
- At a merge, editing one input bumps the merge output by the delta
  (assuming merge output is the LRU). Editing the merge output rebalances
  the LRU input.

UI implications:
- Drawer weight input no longer needs the `auto` button — every field is
  a knob; the system displays which fields are currently `derived` (e.g.
  italic / muted).
- A small "pin / unpin" toggle per edge to manually freeze/unfreeze (so
  the user can park values they don't want touched).
- New scene format: instead of `weight: number | 'auto'`, optionally an
  `initialUserOrder: string[]` per scene to seed the LRU. Or scenes just
  store the current numeric values; LRU is editor session state.

## Migration notes

- The current `'auto'` resolver becomes obsolete — every edge has a
  numeric weight at all times, and `source(edge)` distinguishes user vs.
  derived.
- Renderers (`renderFlowGraph*`, `edgePx`) only need numeric weights, so
  no change to the geometry layer.
- Existing scenes with `weight: 'auto'` would migrate to `weight:
  <resolved number>` + that edge being initially "derived".

## Open questions

- Should the library ship a numerical solver fallback (e.g. Brent's
  method) for nonlinear constraints? mortgage-viz skips PMT rate
  derivation specifically because it's nonlinear. Maybe v2.
- Is there a clean way to represent constraints as **expressions** (so
  the library can auto-derive `derive()` for any target) without dragging
  in symbolic-math weight? Probably not in v1.
- How does this interact with undo/redo? The LRU queue is part of the
  state — undo needs to restore both the field values and the LRU order.
  geo-sankey already snapshots the whole `FlowGraph` per history entry,
  so adding a `userOrder: string[]` to that snapshot is straightforward.

## Phasing

1. **Prototype in-tree.** Build the `LinkedModel` class + `useLinkedModel`
   hook directly under `site/src/` with `geo-sankey`-shaped tests. Wire
   it into `FlowMapView` behind a feature flag. Keep `'auto'` working in
   parallel until we're sure.
2. **Validate UX.** Confirm the LRU rebalance feels right in real use.
   Likely needs the pin/unpin toggle and a clear visual indicator of
   `source`. Also check undo/redo interactions.
3. **Extract.** If it's earning its keep, lift to a standalone package
   (`@runsascoded/lru-linked`?) and DRY against mortgage-viz. Audit the
   mortgage-viz model.ts for anything generic that should move down.
4. **Cut over.** Replace `'auto'` resolver. Migrate examples. Drop the
   `weight: number | 'auto'` union.

## Out of scope (for now)

- Symbolic constraint inversion / generic solver.
- Multi-DOF constraints (a single `LinkedSet` always has 1 derivable
  field at any moment).
- Sharing constraints across documents / multi-user concurrency.
