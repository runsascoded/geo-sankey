import { r as ht, b as at, d as ct, a as yt, c as dt, e as Lt, f as ut, p as ft, l as nt, g as Z } from "./graph-Dd5qc5zb.js";
import { D as Tt, h as Nt, i as zt, j as Ct, k as Et, o as Gt, m as It, n as _t, q as jt, s as Bt, t as Rt, u as qt, v as Ht, w as Jt, x as Ut, y as $t, z as kt } from "./graph-Dd5qc5zb.js";
const { cos: lt, sin: ot, PI: rt } = Math;
function Y(s, a, y = 20) {
  const i = [];
  for (let n = 0; n <= y; n++) {
    const L = n / y;
    i.push([s[0] + (a[0] - s[0]) * L, s[1] + (a[1] - s[1]) * L]);
  }
  return i;
}
function Wt(s) {
  return s.type === "source" ? s.weight : s.children.reduce((a, y) => a + Wt(y), 0);
}
function mt(s) {
  return s.type === "source" ? [{ label: s.label, pos: s.pos }] : s.children.flatMap((a) => mt(a));
}
function j(s, a) {
  return s.type === "source" ? a(s.weight) : s.children.reduce((y, i) => y + j(i, a), 0);
}
function vt(s, a, y) {
  const i = [], { refLat: n, zoom: L, geoScale: E, color: B, key: o, pxPerWeight: tt, arrowWing: pt, arrowLen: Q, reverse: V } = a;
  function et(e, F, A, k, t) {
    const f = j(e, tt), M = Z(f, L, E, n);
    if (e.type === "source" && !e.label) return;
    const O = e.type === "merge" || e.type === "split";
    let w;
    O || e.type === "source" && e.bearing != null ? w = e.bearing : w = k;
    let b = e.pos;
    const G = [];
    if (O) {
      const h = Z(f, L, E, n) * 1.5, N = e.bearing * rt / 180, I = nt(n);
      b = [e.pos[0] + lt(N) * h, e.pos[1] + ot(N) * h * I], G.push(e.pos);
    }
    const T = A && e.type === "split";
    let p;
    if (T)
      p = Y(F, e.pos), V && (p = [...p].reverse());
    else {
      let v;
      k != null ? v = ct(b, F, w, k) : A && O ? v = ct(b, F, w) : A ? v = Y(e.pos, F) : v = Y(b, F), p = A && k == null ? [...v] : [...G, ...v, ...t ?? []], V && (p = [...p].reverse());
    }
    const R = A && !T ? yt(p, M, n, { arrowWingFactor: pt, arrowLenFactor: Q, widthPx: f }) : dt(p, M, n);
    if (R.length && i.push(ht(R, { color: B, width: f, key: o, opacity: 1 })), e.type === "merge" || e.type === "split") {
      const [v, h] = at(e.bearing), N = nt(n), I = e.bearing * rt / 180, c = lt(I), S = ot(I), u = M * 1.5, W = e.children.map((r, l) => l), g = W.map((r) => j(e.children[r], tt)), P = g.reduce((r, l) => r + l, 0);
      let d = 0;
      for (let r = 0; r < W.length; r++) {
        const l = g[r], x = -P / 2 + d + l / 2;
        d += l;
        const _ = ft(x, L, E, n), z = [
          e.pos[0] + v * _,
          e.pos[1] + h * _ * N
        ];
        if (e.type === "merge") {
          const m = [
            z[0] - c * u,
            z[1] - S * u * N
          ], J = Y(m, z, 5).slice(1);
          et(e.children[W[r]], m, !1, e.bearing, J);
        } else {
          const m = e.children[W[r]];
          let J = m.pos, X;
          if (y) {
            const st = y.get(gt(m.pos));
            st && (J = st.offset, X = st.bearing);
          }
          const U = [
            z[0] + c * u,
            z[1] + S * u * N
          ], D = j(m, tt), C = Z(D, L, E, n), K = X ?? (m.type === "source" && "bearing" in m && m.bearing != null ? m.bearing : e.bearing), q = ct(U, J, e.bearing, K);
          let $ = [z, ...q];
          V && ($ = [...$].reverse());
          const it = dt($, C, n);
          it.length && i.push(ht(it, { color: B, width: D, key: o, opacity: 1 })), m.type !== "source" && et(m, m.pos, !1);
        }
      }
    }
  }
  return et(s.root, s.destPos, !0), i;
}
function Pt(s, a, y) {
  const { refLat: i, zoom: n, geoScale: L, color: E, key: B, pxPerWeight: o, arrowWing: tt, arrowLen: pt, reverse: Q } = a;
  function V(t, f, M, O, w) {
    const b = j(t, o), G = Z(b, n, L, i);
    if (t.type === "source" && !t.label) return null;
    const T = t.type === "merge" || t.type === "split";
    let p;
    T || t.type === "source" && t.bearing != null ? p = t.bearing : p = O;
    let H = t.pos;
    const R = [];
    if (T) {
      const S = Z(b, n, L, i) * 1.5, u = t.bearing * rt / 180, W = nt(i);
      H = [t.pos[0] + lt(u) * S, t.pos[1] + ot(u) * S * W], R.push(t.pos);
    }
    const v = M && t.type === "split";
    let h;
    if (v)
      h = Y(f, t.pos), Q && (h = [...h].reverse());
    else {
      let c;
      O != null ? c = ct(H, f, p, O) : M && T ? c = ct(H, f, p) : M ? c = Y(t.pos, f) : c = Y(H, f), h = M && O == null && !T ? [...c] : [...R, ...c, ...w ?? []], Q && (h = [...h].reverse());
    }
    const N = { arrowWingFactor: tt, arrowLenFactor: pt, widthPx: b };
    if (t.type === "source") {
      if (M) {
        const S = Lt(h, G, i, N);
        return S.left.length === 0 ? null : { left: S.left, right: S.right, tip: S.tip };
      }
      const c = ut(h, G, i);
      return c.left.length === 0 ? null : { left: c.left, right: c.right };
    }
    let I;
    if (M && !v) {
      const c = Lt(h, G, i, N);
      if (c.left.length === 0) return null;
      I = { left: c.left, right: c.right, tip: c.tip };
    } else {
      const c = ut(h, G, i);
      if (c.left.length === 0) return null;
      I = { left: c.left, right: c.right };
    }
    return t.type === "merge" ? et(t, I) : e(t, I);
  }
  function et(t, f, M) {
    const [O, w] = at(t.bearing), b = nt(i), G = j(t, o), T = Z(G, n, L, i), p = t.bearing * rt / 180, H = lt(p), R = ot(p), v = T * 1.5, h = t.children.map((d, r) => r), N = h.map((d) => j(t.children[d], o)), I = N.reduce((d, r) => d + r, 0), c = [];
    let S = 0;
    for (let d = 0; d < h.length; d++) {
      const r = N[d], l = -I / 2 + S + r / 2;
      S += r;
      const x = ft(l, n, L, i), _ = [
        t.pos[0] + O * x,
        t.pos[1] + w * x * b
      ], z = [
        _[0] - H * v,
        _[1] - R * v * b
      ], m = Y(z, _, 5).slice(1);
      c.push(
        V(t.children[h[d]], z, !1, t.bearing, m)
      );
    }
    const u = c.filter((d) => d !== null);
    if (u.length === 0) return f;
    const W = [], g = [];
    W.push(...u[0].left, ...f.left), g.push(...u[u.length - 1].right, ...f.right);
    const P = [...W];
    f.tip && P.push(f.tip), P.push(...[...g].reverse());
    for (let d = u.length - 1; d >= 1; d--) {
      const r = u[d].left, l = u[d - 1].right, x = a.plugFraction ?? 0.3, _ = a.plugBearingDeg ?? 1, z = x > 0 ? (T * x) ** 2 : 0, m = _ > 0 ? Math.cos(_ * rt / 180) : 1;
      let J = r.length, X = l.length;
      for (let U = 0; U < Math.min(r.length, l.length); U++) {
        const D = r.length - 1 - U, C = l.length - 1 - U;
        let K = !1;
        if (x > 0) {
          const q = r[D][0] - l[C][0], $ = r[D][1] - l[C][1];
          q * q + $ * $ <= z && (K = !0);
        }
        if (!K && _ > 0 && D > 0 && C > 0) {
          const q = r[D][0] - r[D - 1][0], $ = r[D][1] - r[D - 1][1], it = l[C][0] - l[C - 1][0], st = l[C][1] - l[C - 1][1], wt = Math.sqrt(q * q + $ * $), bt = Math.sqrt(it * it + st * st);
          wt > 0 && bt > 0 && (q * it + $ * st) / (wt * bt) >= m && (K = !0);
        }
        if (!K) {
          J = D + 1, X = C + 1;
          break;
        }
      }
      if (P.push(...r.slice(0, J)), J < r.length) {
        const U = r[J], D = l[Math.min(X, l.length - 1)];
        P.push([(U[0] + D[0]) / 2, (U[1] + D[1]) / 2]);
      }
      P.push(...[...l.slice(0, Math.min(X, l.length))].reverse());
    }
    return P.push(P[0]), { left: P, right: [] };
  }
  function e(t, f, M) {
    const [O, w] = at(t.bearing), b = nt(i), G = j(t, o), T = Z(G, n, L, i), p = t.bearing * rt / 180, H = lt(p), R = ot(p), v = T * 1.5, h = t.children.map((g, P) => P), N = h.map((g) => j(t.children[g], o)), I = N.reduce((g, P) => g + P, 0), c = [];
    let S = 0;
    for (let g = 0; g < h.length; g++) {
      const P = N[g], d = -I / 2 + S + P / 2;
      S += P;
      const r = ft(d, n, L, i), l = [
        t.pos[0] + O * r,
        t.pos[1] + w * r * b
      ], x = t.children[h[g]];
      let _ = x.pos, z;
      if (y) {
        const q = y.get(gt(x.pos));
        q && (_ = q.offset, z = q.bearing);
      }
      const m = [
        l[0] + H * v,
        l[1] + R * v * b
      ], J = j(x, o), X = Z(J, n, L, i), U = z ?? (x.type === "source" && "bearing" in x && x.bearing != null ? x.bearing : t.bearing), D = ct(m, _, t.bearing, U);
      let C = [l, ...D];
      Q && (C = [...C].reverse());
      const K = ut(C, X, i);
      K.left.length > 0 ? c.push(K) : c.push(null);
    }
    const u = c.filter((g) => g !== null);
    if (u.length === 0) return f;
    const W = [];
    W.push(...f.left), W.push(...u[0].left), W.push(...[...u[0].right].reverse());
    for (let g = 1; g < u.length; g++)
      W.push(...u[g].left), W.push(...[...u[g].right].reverse());
    return W.push(...[...f.right].reverse()), W.push(W[0]), { left: W, right: [] };
  }
  const F = V(s.root, s.destPos, !0);
  if (!F)
    return ht([], { color: E, width: 0, key: B, opacity: 1 });
  let A;
  F.right.length === 0 ? A = F.left : (A = [...F.left], F.tip && A.push(F.tip), A.push(...[...F.right].reverse()), A.push(A[0]));
  const k = j(s.root, o);
  return ht(A, { color: E, width: k, key: B, opacity: 1 });
}
function gt(s) {
  return `${s[0].toFixed(6)},${s[1].toFixed(6)}`;
}
function Ft(s, a) {
  const { refLat: y, zoom: i, geoScale: n, pxPerWeight: L } = a, E = /* @__PURE__ */ new Map();
  function B(o) {
    if (o.type !== "merge") {
      o.type === "split" && o.children.forEach(B);
      return;
    }
    const [tt, pt] = at(o.bearing), Q = nt(y), V = j(o, L), et = Z(V, i, n, y), e = o.children.map((w, b) => b), F = e.map((w) => j(o.children[w], L)), A = F.reduce((w, b) => w + b, 0), k = o.bearing * rt / 180, t = lt(k), f = ot(k), M = et * 1.5;
    let O = 0;
    for (let w = 0; w < e.length; w++) {
      const b = F[w], G = -A / 2 + O + b / 2;
      O += b;
      const T = ft(G, i, n, y), p = [
        o.pos[0] + tt * T,
        o.pos[1] + pt * T * Q
      ], H = [
        p[0] - t * M,
        p[1] - f * M * Q
      ], R = o.children[e[w]];
      E.set(gt(R.pos), {
        offset: H,
        bearing: o.bearing
      }), B(R);
    }
  }
  for (const o of s) B(o.root);
  return E;
}
function Dt(s, a) {
  const y = Ft(s, a), i = [];
  for (const n of s)
    a.singlePoly ? i.push(Pt(n, a, y)) : i.push(...vt(n, a, y));
  return i.sort((n, L) => {
    var E, B;
    return (((E = L.properties) == null ? void 0 : E.width) ?? 0) - (((B = n.properties) == null ? void 0 : B.width) ?? 0);
  }), { type: "FeatureCollection", features: i };
}
function At(s = {}) {
  return {
    "fill-color": ["get", "color"],
    "fill-opacity": 1,
    "fill-antialias": !1,
    ...s
  };
}
export {
  Tt as DEFAULT_ANGLE,
  Nt as DEFAULT_WING,
  at as bearingPerpLeft,
  Ft as buildJunctionMap,
  zt as cubicBezier,
  Ct as degPerPxZ12,
  ct as directedBezier,
  At as flowFillPaint,
  mt as flowSources,
  Et as fwdAt,
  nt as lngScale,
  Wt as nodeWeight,
  j as nodeWidth,
  Gt as offsetPath,
  It as perpAt,
  ft as pxToDeg,
  Z as pxToHalfDeg,
  _t as renderEdgeCenterlines,
  jt as renderFlowGraph,
  Bt as renderFlowGraphDebug,
  Rt as renderFlowGraphSinglePoly,
  vt as renderFlowTree,
  Pt as renderFlowTreeSinglePoly,
  Dt as renderFlows,
  qt as renderNodes,
  Ht as resolveArrowDefaults,
  Jt as resolveEdgeWeights,
  dt as ribbon,
  yt as ribbonArrow,
  Lt as ribbonArrowEdges,
  ut as ribbonEdges,
  ht as ringFeature,
  Ut as sBezier,
  $t as smoothPath,
  kt as toGeoJSON
};
