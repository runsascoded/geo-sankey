/** MapLibre/Mapbox paint-prop helpers for rendering geo-sankey output.
 *
 *  Pure data — no runtime dependency on any map library. The returned
 *  object is a spec-compliant paint expression that MapLibre and Mapbox
 *  both accept.
 */
/** Default paint props for a flow-ribbon fill layer.
 *
 *  The only non-obvious default is `fill-antialias: false`. MapLibre's
 *  default (`true`) runs a second pass after the fills that draws each
 *  feature's boundary as an AA line, *in draw order*. When flows overlap
 *  with translucent opacity, the earlier-drawn (underneath) polygon's
 *  edge ends up stroked on top of the polygon that was supposed to cover
 *  it — a "ghost outline" artifact that reads like a rendering bug. At
 *  the pixel sizes ribbons render at, edges are visually indistinguishable
 *  with AA on vs off, so disabling is safe for the common case.
 *
 *  Callers can override any prop (e.g. `fill-opacity`):
 *
 *    <Layer id="flows-fill" type="fill"
 *           paint={flowFillPaint({ 'fill-opacity': 0.85 })} />
 */
export declare function flowFillPaint(overrides?: Record<string, unknown>): Record<string, unknown>;
