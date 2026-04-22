const { cos: Gt, pow: Ct, sqrt: Yt, PI: It } = Math;
function G(t) {
  return 1 / Gt(t * It / 180);
}
function qt(t) {
  return 156543.03 * Gt(t * It / 180) / (Ct(2, 12) * 111320);
}
function Y(t, o, c, s) {
  return t / 2 * qt(s) * Ct(2, (c - 1) * (o - 12));
}
function mt(t, o, c, s) {
  return t * qt(s) * Ct(2, (c - 1) * (o - 12));
}
function po(t) {
  return t.map(([o, c]) => [c, o]);
}
function go(t, o) {
  if (t.length < 2 || o === 0) return t;
  const [c, s] = t[0], [r, u] = t[t.length - 1], g = u - s, n = r - c, e = Yt(g * g + n * n);
  if (e === 0) return t;
  const y = -g / e, p = n / e, d = o * 4e-4;
  return t.map(([$, R]) => [$ + y * d, R + p * d]);
}
const { sqrt: wt, max: ht, min: Jt, PI: vt, sin: St, cos: Wt } = Math;
function Kt(t, o, c, s, r = 20) {
  const u = [];
  for (let g = 0; g <= r; g++) {
    const n = g / r, e = 1 - n;
    u.push([
      e * e * e * t[0] + 3 * e * e * n * o[0] + 3 * e * n * n * c[0] + n * n * n * s[0],
      e * e * e * t[1] + 3 * e * e * n * o[1] + 3 * e * n * n * c[1] + n * n * n * s[1]
    ]);
  }
  return u;
}
function ho(t, o = 12) {
  const c = t.length;
  if (c < 2) return { path: [...t], knots: t.map((u, g) => g) };
  const s = [], r = [];
  for (let u = 0; u < c - 1; u++) {
    const g = t[ht(u - 1, 0)], n = t[u], e = t[u + 1], y = t[Jt(u + 2, c - 1)];
    r.push(s.length);
    for (let p = 0; p < o; p++) {
      const d = p / o, $ = d * d, R = $ * d;
      s.push([
        0.5 * (2 * n[0] + (-g[0] + e[0]) * d + (2 * g[0] - 5 * n[0] + 4 * e[0] - y[0]) * $ + (-g[0] + 3 * n[0] - 3 * e[0] + y[0]) * R),
        0.5 * (2 * n[1] + (-g[1] + e[1]) * d + (2 * g[1] - 5 * n[1] + 4 * e[1] - y[1]) * $ + (-g[1] + 3 * n[1] - 3 * e[1] + y[1]) * R)
      ]);
    }
  }
  return r.push(s.length), s.push(t[c - 1]), { path: s, knots: r };
}
function Lo(t, o) {
  const c = o[1] - t[1], s = o[0] - t[0], r = wt(s * s + c * c), u = ht(Math.abs(c) * 0.5, r * 0.35), g = [t[0], t[1] + u], n = [o[0], o[1] - u];
  return Kt(t, g, n, o);
}
function ct(t, o, c, s, r = 20, u = 1, g, n) {
  const e = u, y = [t[0] * e, t[1]], p = [o[0] * e, o[1]], d = p[0] - y[0], $ = p[1] - y[1], R = wt(d * d + $ * $), f = Math.atan2($, d) * 180 / vt, b = (c ?? 90) * vt / 180, i = Math.abs((((c ?? 90) - f) % 360 + 540) % 360 - 180), a = g != null ? ht(g, 1e-3) : ht(R * (i < 90 ? 0.4 : 0.2), 1e-3), l = [y[0] + Wt(b) * a, y[1] + St(b) * a], L = (s ?? 90) * vt / 180, W = Math.abs((((s ?? 90) - f) % 360 + 540) % 360 - 180), S = n != null ? ht(n, 1e-3) : ht(R * (W < 90 ? 0.4 : 0.2), 1e-3), v = [p[0] - Wt(L) * S, p[1] - St(L) * S], w = Kt(y, l, v, p, r);
  if (w.length >= 4) {
    const P = w[1][0] - w[0][0], O = w[1][1] - w[0][1], k = wt(P * P + O * O);
    w[1] = [y[0] + Wt(b) * k, y[1] + St(b) * k];
    const q = w.length - 1, D = w[q][0] - w[q - 1][0], x = w[q][1] - w[q - 1][1], F = wt(D * D + x * x);
    w[q - 1] = [p[0] - Wt(L) * F, p[1] - St(L) * F];
  }
  return w.map((P) => [P[0] / e, P[1]]);
}
function $t(t, o) {
  const c = t.length;
  let s = 0, r = 0;
  o < c - 1 && (s += t[o + 1][0] - t[o][0], r += t[o + 1][1] - t[o][1]), o > 0 && (s += t[o][0] - t[o - 1][0], r += t[o][1] - t[o - 1][1]);
  const u = wt(s * s + r * r);
  return u === 0 ? [0, 0] : [-r / u, s / u];
}
function Rt(t, o) {
  const c = t.length, s = Jt(o + 1, c - 1), r = ht(o - 1, 0), u = t[s][0] - t[r][0], g = t[s][1] - t[r][1], n = wt(u * u + g * g);
  return n === 0 ? [0, 0] : [u / n, g / n];
}
function kt(t) {
  const o = t * vt / 180;
  return [St(o), -Wt(o)];
}
const { sqrt: At, max: Zt, min: Qt, ceil: Ut } = Math;
function Xt(t, o, c, s) {
  const { arrowWingFactor: r, arrowLenFactor: u, widthPx: g } = s, n = t.length;
  if (n < 2) return [];
  const e = [0];
  for (let x = 1; x < n; x++) {
    const F = t[x][0] - t[x - 1][0], h = t[x][1] - t[x - 1][1];
    e.push(e[x - 1] + At(F * F + h * h));
  }
  const y = e[n - 1], p = o * 2 * u, d = Qt(p, y * (s.maxArrowFraction ?? 0.4)), $ = p > 0 ? d / p : 1, R = g != null && g < 8 ? r + (8 - g) * 0.15 : r, f = o * (1 + (R - 1) * $), b = G(c), i = y - d, a = Zt(0, n - 1 - Ut(n * 0.25));
  let l = t[n - 1][0] - t[a][0], L = t[n - 1][1] - t[a][1];
  const W = At(l * l + L * L);
  W > 0 ? (l /= W, L /= W) : (l = Rt(t, n - 1)[0], L = Rt(t, n - 1)[1]);
  const S = -L, v = l, w = t[n - 1][0] - l * d, P = t[n - 1][1] - L * d, O = [], k = [];
  for (let x = 0; x < n && !(e[x] > i); x++) {
    const [F, h] = $t(t, x);
    O.push([t[x][1] + h * o * b, t[x][0] + F * o]), k.push([t[x][1] - h * o * b, t[x][0] - F * o]);
  }
  O.push([P + v * o * b, w + S * o]), k.push([P - v * o * b, w - S * o]), O.push([P + v * f * b, w + S * f]), k.push([P - v * f * b, w - S * f]);
  const q = [t[n - 1][1], t[n - 1][0]], D = [...O, q, ...k.reverse()];
  return D.push(D[0]), D;
}
function Pt(t, o, c) {
  const s = t.length;
  if (s < 2) return [];
  const r = G(c), u = [], g = [];
  for (let e = 0; e < s; e++) {
    const [y, p] = $t(t, e);
    u.push([t[e][1] + p * o * r, t[e][0] + y * o]), g.push([t[e][1] - p * o * r, t[e][0] - y * o]);
  }
  const n = [...u, ...g.reverse()];
  return n.push(n[0]), n;
}
function zt(t, o, c) {
  const s = t.length;
  if (s < 2) return { left: [], right: [] };
  const r = G(c), u = [], g = [];
  for (let n = 0; n < s; n++) {
    const [e, y] = $t(t, n);
    u.push([t[n][1] + y * o * r, t[n][0] + e * o]), g.push([t[n][1] - y * o * r, t[n][0] - e * o]);
  }
  return { left: u, right: g };
}
function Nt(t, o, c, s) {
  const { arrowWingFactor: r, arrowLenFactor: u, widthPx: g } = s, n = t.length;
  if (n < 2) return { left: [], right: [], tip: [0, 0] };
  const e = [0];
  for (let D = 1; D < n; D++) {
    const x = t[D][0] - t[D - 1][0], F = t[D][1] - t[D - 1][1];
    e.push(e[D - 1] + At(x * x + F * F));
  }
  const y = e[n - 1], p = o * 2 * u, d = Qt(p, y * (s.maxArrowFraction ?? 0.4)), $ = p > 0 ? d / p : 1, R = g != null && g < 8 ? r + (8 - g) * 0.15 : r, f = o * (1 + (R - 1) * $), b = G(c), i = y - d, a = Zt(0, n - 1 - Ut(n * 0.25));
  let l = t[n - 1][0] - t[a][0], L = t[n - 1][1] - t[a][1];
  const W = At(l * l + L * L);
  W > 0 ? (l /= W, L /= W) : (l = Rt(t, n - 1)[0], L = Rt(t, n - 1)[1]);
  const S = -L, v = l, w = t[n - 1][0] - l * d, P = t[n - 1][1] - L * d, O = [], k = [];
  for (let D = 0; D < n && !(e[D] > i); D++) {
    const [x, F] = $t(t, D);
    O.push([t[D][1] + F * o * b, t[D][0] + x * o]), k.push([t[D][1] - F * o * b, t[D][0] - x * o]);
  }
  O.push([P + v * o * b, w + S * o]), k.push([P - v * o * b, w - S * o]), O.push([P + v * f * b, w + S * f]), k.push([P - v * f * b, w - S * f]);
  const q = [t[n - 1][1], t[n - 1][0]];
  return { left: O, right: k, tip: q };
}
function rt(t, o) {
  return {
    type: "Feature",
    properties: o,
    geometry: { type: "Polygon", coordinates: [t] }
  };
}
const { cos: yt, sin: bt, PI: dt } = Math;
function ut(t, o, c = 20) {
  const s = [];
  for (let r = 0; r <= c; r++) {
    const u = r / c;
    s.push([t[0] + (o[0] - t[0]) * u, t[1] + (o[1] - t[1]) * u]);
  }
  return s;
}
function Vt(t) {
  return t.type === "source" ? t.weight : t.children.reduce((o, c) => o + Vt(c), 0);
}
function to(t) {
  return t.type === "source" ? [{ label: t.label, pos: t.pos }] : t.children.flatMap((o) => to(o));
}
function tt(t, o) {
  return t.type === "source" ? o(t.weight) : t.children.reduce((c, s) => c + tt(s, o), 0);
}
function oo(t, o, c) {
  const s = [], { refLat: r, zoom: u, geoScale: g, color: n, key: e, pxPerWeight: y, arrowWing: p, arrowLen: d, reverse: $ } = o;
  function R(f, b, i, a, l) {
    const L = tt(f, y), W = Y(L, u, g, r);
    if (f.type === "source" && !f.label) return;
    const S = f.type === "merge" || f.type === "split";
    let v;
    S || f.type === "source" && f.bearing != null ? v = f.bearing : v = a;
    let w = f.pos;
    const P = [];
    if (S) {
      const F = Y(L, u, g, r) * 1.5, h = f.bearing * dt / 180, A = G(r);
      w = [f.pos[0] + yt(h) * F, f.pos[1] + bt(h) * F * A], P.push(f.pos);
    }
    const O = i && f.type === "split";
    let k;
    if (O)
      k = ut(b, f.pos), $ && (k = [...k].reverse());
    else {
      let x;
      a != null ? x = ct(w, b, v, a) : i && S ? x = ct(w, b, v) : i ? x = ut(f.pos, b) : x = ut(w, b), k = i && a == null ? [...x] : [...P, ...x, ...l ?? []], $ && (k = [...k].reverse());
    }
    const D = i && !O ? Xt(k, W, r, { arrowWingFactor: p, arrowLenFactor: d, widthPx: L }) : Pt(k, W, r);
    if (D.length && s.push(rt(D, { color: n, width: L, key: e, opacity: 1 })), f.type === "merge" || f.type === "split") {
      const [x, F] = kt(f.bearing), h = G(r), A = f.bearing * dt / 180, m = yt(A), z = bt(A), N = W * 1.5, B = f.children.map((E, C) => C), T = B.map((E) => tt(f.children[E], y)), _ = T.reduce((E, C) => E + C, 0);
      let M = 0;
      for (let E = 0; E < B.length; E++) {
        const C = T[E], I = -_ / 2 + M + C / 2;
        M += C;
        const K = mt(I, u, g, r), H = [
          f.pos[0] + x * K,
          f.pos[1] + F * K * h
        ];
        if (f.type === "merge") {
          const j = [
            H[0] - m * N,
            H[1] - z * N * h
          ], U = ut(j, H, 5).slice(1);
          R(f.children[B[E]], j, !1, f.bearing, U);
        } else {
          const j = f.children[B[E]];
          let U = j.pos, nt;
          if (c) {
            const gt = c.get(Tt(j.pos));
            gt && (U = gt.offset, nt = gt.bearing);
          }
          const V = [
            H[0] + m * N,
            H[1] + z * N * h
          ], Z = tt(j, y), Q = Y(Z, u, g, r), ot = nt ?? (j.type === "source" && "bearing" in j && j.bearing != null ? j.bearing : f.bearing), X = ct(V, U, f.bearing, ot);
          let et = [H, ...X];
          $ && (et = [...et].reverse());
          const ft = Pt(et, Q, r);
          ft.length && s.push(rt(ft, { color: n, width: Z, key: e, opacity: 1 })), j.type !== "source" && R(j, j.pos, !1);
        }
      }
    }
  }
  return R(t.root, t.destPos, !0), s;
}
function eo(t, o, c) {
  const { refLat: s, zoom: r, geoScale: u, color: g, key: n, pxPerWeight: e, arrowWing: y, arrowLen: p, reverse: d } = o;
  function $(l, L, W, S, v) {
    const w = tt(l, e), P = Y(w, r, u, s);
    if (l.type === "source" && !l.label) return null;
    const O = l.type === "merge" || l.type === "split";
    let k;
    O || l.type === "source" && l.bearing != null ? k = l.bearing : k = S;
    let q = l.pos;
    const D = [];
    if (O) {
      const z = Y(w, r, u, s) * 1.5, N = l.bearing * dt / 180, B = G(s);
      q = [l.pos[0] + yt(N) * z, l.pos[1] + bt(N) * z * B], D.push(l.pos);
    }
    const x = W && l.type === "split";
    let F;
    if (x)
      F = ut(L, l.pos), d && (F = [...F].reverse());
    else {
      let m;
      S != null ? m = ct(q, L, k, S) : W && O ? m = ct(q, L, k) : W ? m = ut(l.pos, L) : m = ut(q, L), F = W && S == null && !O ? [...m] : [...D, ...m, ...v ?? []], d && (F = [...F].reverse());
    }
    const h = { arrowWingFactor: y, arrowLenFactor: p, widthPx: w };
    if (l.type === "source") {
      if (W) {
        const z = Nt(F, P, s, h);
        return z.left.length === 0 ? null : { left: z.left, right: z.right, tip: z.tip };
      }
      const m = zt(F, P, s);
      return m.left.length === 0 ? null : { left: m.left, right: m.right };
    }
    let A;
    if (W && !x) {
      const m = Nt(F, P, s, h);
      if (m.left.length === 0) return null;
      A = { left: m.left, right: m.right, tip: m.tip };
    } else {
      const m = zt(F, P, s);
      if (m.left.length === 0) return null;
      A = { left: m.left, right: m.right };
    }
    return l.type === "merge" ? R(l, A) : f(l, A);
  }
  function R(l, L, W) {
    const [S, v] = kt(l.bearing), w = G(s), P = tt(l, e), O = Y(P, r, u, s), k = l.bearing * dt / 180, q = yt(k), D = bt(k), x = O * 1.5, F = l.children.map((M, E) => E), h = F.map((M) => tt(l.children[M], e)), A = h.reduce((M, E) => M + E, 0), m = [];
    let z = 0;
    for (let M = 0; M < F.length; M++) {
      const E = h[M], C = -A / 2 + z + E / 2;
      z += E;
      const I = mt(C, r, u, s), K = [
        l.pos[0] + S * I,
        l.pos[1] + v * I * w
      ], H = [
        K[0] - q * x,
        K[1] - D * x * w
      ], j = ut(H, K, 5).slice(1);
      m.push(
        $(l.children[F[M]], H, !1, l.bearing, j)
      );
    }
    const N = m.filter((M) => M !== null);
    if (N.length === 0) return L;
    const B = [], T = [];
    B.push(...N[0].left, ...L.left), T.push(...N[N.length - 1].right, ...L.right);
    const _ = [...B];
    L.tip && _.push(L.tip), _.push(...[...T].reverse());
    for (let M = N.length - 1; M >= 1; M--) {
      const E = N[M].left, C = N[M - 1].right, I = o.plugFraction ?? 0.3, K = o.plugBearingDeg ?? 1, H = I > 0 ? (O * I) ** 2 : 0, j = K > 0 ? Math.cos(K * dt / 180) : 1;
      let U = E.length, nt = C.length;
      for (let V = 0; V < Math.min(E.length, C.length); V++) {
        const Z = E.length - 1 - V, Q = C.length - 1 - V;
        let ot = !1;
        if (I > 0) {
          const X = E[Z][0] - C[Q][0], et = E[Z][1] - C[Q][1];
          X * X + et * et <= H && (ot = !0);
        }
        if (!ot && K > 0 && Z > 0 && Q > 0) {
          const X = E[Z][0] - E[Z - 1][0], et = E[Z][1] - E[Z - 1][1], ft = C[Q][0] - C[Q - 1][0], gt = C[Q][1] - C[Q - 1][1], _t = Math.sqrt(X * X + et * et), Ht = Math.sqrt(ft * ft + gt * gt);
          _t > 0 && Ht > 0 && (X * ft + et * gt) / (_t * Ht) >= j && (ot = !0);
        }
        if (!ot) {
          U = Z + 1, nt = Q + 1;
          break;
        }
      }
      if (_.push(...E.slice(0, U)), U < E.length) {
        const V = E[U], Z = C[Math.min(nt, C.length - 1)];
        _.push([(V[0] + Z[0]) / 2, (V[1] + Z[1]) / 2]);
      }
      _.push(...[...C.slice(0, Math.min(nt, C.length))].reverse());
    }
    return _.push(_[0]), { left: _, right: [] };
  }
  function f(l, L, W) {
    const [S, v] = kt(l.bearing), w = G(s), P = tt(l, e), O = Y(P, r, u, s), k = l.bearing * dt / 180, q = yt(k), D = bt(k), x = O * 1.5, F = l.children.map((T, _) => _), h = F.map((T) => tt(l.children[T], e)), A = h.reduce((T, _) => T + _, 0), m = [];
    let z = 0;
    for (let T = 0; T < F.length; T++) {
      const _ = h[T], M = -A / 2 + z + _ / 2;
      z += _;
      const E = mt(M, r, u, s), C = [
        l.pos[0] + S * E,
        l.pos[1] + v * E * w
      ], I = l.children[F[T]];
      let K = I.pos, H;
      if (c) {
        const X = c.get(Tt(I.pos));
        X && (K = X.offset, H = X.bearing);
      }
      const j = [
        C[0] + q * x,
        C[1] + D * x * w
      ], U = tt(I, e), nt = Y(U, r, u, s), V = H ?? (I.type === "source" && "bearing" in I && I.bearing != null ? I.bearing : l.bearing), Z = ct(j, K, l.bearing, V);
      let Q = [C, ...Z];
      d && (Q = [...Q].reverse());
      const ot = zt(Q, nt, s);
      ot.left.length > 0 ? m.push(ot) : m.push(null);
    }
    const N = m.filter((T) => T !== null);
    if (N.length === 0) return L;
    const B = [];
    B.push(...L.left), B.push(...N[0].left), B.push(...[...N[0].right].reverse());
    for (let T = 1; T < N.length; T++)
      B.push(...N[T].left), B.push(...[...N[T].right].reverse());
    return B.push(...[...L.right].reverse()), B.push(B[0]), { left: B, right: [] };
  }
  const b = $(t.root, t.destPos, !0);
  if (!b)
    return rt([], { color: g, width: 0, key: n, opacity: 1 });
  let i;
  b.right.length === 0 ? i = b.left : (i = [...b.left], b.tip && i.push(b.tip), i.push(...[...b.right].reverse()), i.push(i[0]));
  const a = tt(t.root, e);
  return rt(i, { color: g, width: a, key: n, opacity: 1 });
}
function Tt(t) {
  return `${t[0].toFixed(6)},${t[1].toFixed(6)}`;
}
function no(t, o) {
  const { refLat: c, zoom: s, geoScale: r, pxPerWeight: u } = o, g = /* @__PURE__ */ new Map();
  function n(e) {
    if (e.type !== "merge") {
      e.type === "split" && e.children.forEach(n);
      return;
    }
    const [y, p] = kt(e.bearing), d = G(c), $ = tt(e, u), R = Y($, s, r, c), f = e.children.map((v, w) => w), b = f.map((v) => tt(e.children[v], u)), i = b.reduce((v, w) => v + w, 0), a = e.bearing * dt / 180, l = yt(a), L = bt(a), W = R * 1.5;
    let S = 0;
    for (let v = 0; v < f.length; v++) {
      const w = b[v], P = -i / 2 + S + w / 2;
      S += w;
      const O = mt(P, s, r, c), k = [
        e.pos[0] + y * O,
        e.pos[1] + p * O * d
      ], q = [
        k[0] - l * W,
        k[1] - L * W * d
      ], D = e.children[f[v]];
      g.set(Tt(D.pos), {
        offset: q,
        bearing: e.bearing
      }), n(D);
    }
  }
  for (const e of t) n(e.root);
  return g;
}
function wo(t, o) {
  const c = no(t, o), s = [];
  for (const r of t)
    o.singlePoly ? s.push(eo(r, o, c)) : s.push(...oo(r, o, c));
  return s.sort((r, u) => {
    var g, n;
    return (((g = u.properties) == null ? void 0 : g.width) ?? 0) - (((n = r.properties) == null ? void 0 : n.width) ?? 0);
  }), { type: "FeatureCollection", features: s };
}
const { cos: it, sin: lt, PI: st, max: Ft } = Math;
function so(t, o = 1e-6) {
  if (t.length < 3) return t;
  const c = [t[0]];
  for (let s = 1; s < t.length - 1; s++) {
    const [r, u] = t[s - 1], [g, n] = t[s], [e, y] = t[s + 1], p = e - r, d = y - u, $ = Math.sqrt(p * p + d * d);
    if ($ === 0) continue;
    Math.abs((g - r) * d - (n - u) * p) / $ > o && c.push(t[s]);
  }
  return c.push(t[t.length - 1]), c;
}
function co(t, o, c, s) {
  const r = o[0] - t[0], u = o[1] - t[1], g = s[0] - c[0], n = s[1] - c[1], e = r * n - u * g;
  if (Math.abs(e) < 1e-20) return null;
  const y = ((c[0] - t[0]) * n - (c[1] - t[1]) * g) / e, p = ((c[0] - t[0]) * u - (c[1] - t[1]) * r) / e;
  return y < 1e-3 || y > 0.999 || p < 1e-3 || p > 0.999 ? null : [t[0] + r * y, t[1] + u * y];
}
function ro(t) {
  for (let c = t.length - 2; c >= 0; c--) {
    const s = t[c + 1][0] - t[c][0], r = t[c + 1][1] - t[c][1];
    s * s + r * r < 1e-18 && t.splice(c + 1, 1);
  }
  let o = !0;
  for (; o; ) {
    o = !1;
    for (let c = 0; c < t.length - 3 && !o; c++)
      for (let s = c + 2; s < t.length - 1 && !o; s++) {
        if (c === 0 && s === t.length - 2) continue;
        const r = co(t[c], t[c + 1], t[s], t[s + 1]);
        r && (t.splice(c + 1, s - c, r), o = !0);
      }
  }
  return t;
}
function Et(t) {
  const o = t.wing ?? 0.4, c = t.angle ?? 45, s = t.arrowWing ?? 1 + 2 * o, r = t.arrowLen ?? s * Math.tan(c * st / 180) / 2;
  return { arrowWing: s, arrowLen: r };
}
function Dt(t) {
  const o = t * st / 180;
  return [it(o), lt(o)];
}
function io(t) {
  const o = t * st / 180;
  return [lt(o), -it(o)];
}
function xt(t, o, c) {
  const s = t * st / 180, r = it(s), u = lt(s), g = Math.sqrt(r * r * c * c + u * u), n = -r * c / g, e = u / g;
  return [n * o * c, e * o];
}
function pt(t, o) {
  return typeof t == "number" ? o * t : t(o);
}
const lo = 111320;
function Bt(t) {
  if (t.mPerWeight == null) return t.pxPerWeight;
  const o = Math.pow(2, t.zoom - 12) / (qt(t.refLat) * lo);
  return t.mPerWeight * o;
}
function Lt(t, o, c) {
  var s;
  return pt(o, c.get(J(t)) ?? 0) * (((s = t.style) == null ? void 0 : s.widthScale) ?? 1);
}
function J(t) {
  return `${t.from}→${t.to}`;
}
function fo(t) {
  var u, g;
  const o = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
  for (const n of t.nodes)
    c.set(n.id, []), s.set(n.id, []);
  for (const n of t.edges)
    (u = s.get(n.from)) == null || u.push(n), (g = c.get(n.to)) == null || g.push(n);
  let r = !0;
  for (; r && o.size < t.edges.length; ) {
    r = !1;
    for (const n of t.edges) {
      const e = J(n);
      if (o.has(e)) continue;
      if (typeof n.weight == "number") {
        o.set(e, n.weight), r = !0;
        continue;
      }
      const y = c.get(n.from) ?? [];
      if (!y.every((b) => o.has(J(b)))) continue;
      const p = y.reduce((b, i) => b + (o.get(J(i)) ?? 0), 0), d = s.get(n.from) ?? [], $ = d.filter((b) => typeof b.weight == "number").reduce((b, i) => b + i.weight, 0), R = d.filter((b) => b.weight === "auto").length, f = R > 0 ? Math.max(0, p - $) / R : 0;
      o.set(e, f), r = !0;
    }
  }
  for (const n of t.edges)
    o.has(J(n)) || (console.warn(`[geo-sankey] could not resolve auto weight for ${J(n)}`), o.set(J(n), 0));
  return o;
}
function jt(t, o, c) {
  const s = t.length;
  if (s < 2) return { left: [], right: [] };
  const r = G(c), u = [], g = [], n = [];
  for (let e = 0; e < s - 1; e++) {
    const y = (t[e + 1][0] - t[e][0]) * r, p = t[e + 1][1] - t[e][1], d = Math.sqrt(p * p + y * y);
    d > 0 ? n.push({ pLon: -y / d, pLat: p / d }) : n.push({ pLon: 0, pLat: 0 });
  }
  for (let e = 0; e < s; e++) {
    let y, p;
    if (e === 0)
      y = n[0].pLon, p = n[0].pLat;
    else if (e === s - 1)
      y = n[s - 2].pLon, p = n[s - 2].pLat;
    else {
      const d = n[e - 1], $ = n[e], R = d.pLon + $.pLon, f = d.pLat + $.pLat, b = Math.sqrt(R * R + f * f);
      if (b > 1e-3) {
        const i = R / b, a = f / b, l = i * d.pLon + a * d.pLat, L = Math.min(1 / Math.max(l, 0.01), 2);
        y = i * L, p = a * L;
      } else
        y = d.pLon, p = d.pLat;
    }
    u.push([t[e][1] + y * o * r, t[e][0] + p * o]), g.push([t[e][1] - y * o * r, t[e][0] - p * o]);
  }
  return { left: u, right: g };
}
function Mt(t, o, c = 5) {
  const s = [];
  for (let r = 0; r <= c; r++) {
    const u = r / c;
    s.push([t[0] + (o[0] - t[0]) * u, t[1] + (o[1] - t[1]) * u]);
  }
  return s;
}
function at(t, o, c, s) {
  const [r, u] = io(c), g = t[0] - o[0], n = (t[1] - o[1]) * s;
  return g * r + n * u;
}
function Ot(t, o, c = !1) {
  const s = t.nodes.map((i) => ({ ...i, pos: [...i.pos] }));
  t = { ...t, nodes: s };
  const { refLat: r, zoom: u, geoScale: g = 1, nodeApproach: n = 0.5 } = o, e = Bt(o), { arrowLen: y } = Et(o), p = fo(t), d = new Map(t.nodes.map((i) => [i.id, i])), $ = /* @__PURE__ */ new Map(), R = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map();
  for (const i of t.nodes)
    R.set(i.id, []), f.set(i.id, []);
  for (const i of t.edges)
    R.get(i.from).push(i), f.get(i.to).push(i);
  const b = G(r);
  for (const i of t.nodes) {
    if (i.bearing != null) continue;
    const a = f.get(i.id), l = R.get(i.id);
    if (l.length === 1) {
      const L = d.get(l[0].to), W = L.pos[0] - i.pos[0], S = (L.pos[1] - i.pos[1]) * G(r);
      i.bearing = Math.atan2(S, W) * 180 / st;
    } else if (l.length === 0 && a.length === 1) {
      const L = d.get(a[0].from), W = i.pos[0] - L.pos[0], S = (i.pos[1] - L.pos[1]) * G(r);
      i.bearing = Math.atan2(S, W) * 180 / st;
    } else
      i.bearing = 90;
  }
  for (const i of t.nodes) {
    const a = (x) => {
      var F;
      return (p.get(J(x)) ?? 0) * (((F = x.style) == null ? void 0 : F.widthScale) ?? 1);
    }, l = f.get(i.id).reduce((x, F) => x + a(F), 0), L = R.get(i.id).reduce((x, F) => x + a(F), 0), W = Ft(l, L), S = Y(pt(e, W), u, g, r), v = i.bearing * st / 180, w = lt(v), P = it(v) / b, [O, k] = xt(i.bearing, S, b), q = R.get(i.id).length === 0 && l > 0, D = q ? S * 2 * y : S * n;
    $.set(i.id, {
      node: i,
      inSlots: /* @__PURE__ */ new Map(),
      outSlots: /* @__PURE__ */ new Map(),
      inWeight: l,
      outWeight: L,
      throughWeight: W,
      halfW: S,
      approachLen: D,
      isSink: q,
      isSource: f.get(i.id).length === 0 && L > 0,
      // Face corners [lon, lat] — perpOffset matches offsetCurve width
      inFaceLeft: [i.pos[1] - w * D + O, i.pos[0] - P * D + k],
      inFaceRight: [i.pos[1] - w * D - O, i.pos[0] - P * D - k],
      outFaceLeft: [i.pos[1] + w * D + O, i.pos[0] + P * D + k],
      outFaceRight: [i.pos[1] + w * D - O, i.pos[0] + P * D - k]
    });
  }
  for (const i of t.edges) {
    const a = $.get(i.from), l = $.get(i.to), L = l.node.pos[0] - a.node.pos[0], W = (l.node.pos[1] - a.node.pos[1]) * b, S = Math.sqrt(L * L + W * W), v = a.approachLen + l.approachLen;
    if (v > S * 0.5 && S > 0) {
      const w = S * 0.5, P = a.approachLen / v;
      a.approachLen = Ft(a.halfW * 0.3, w * P), l.approachLen = Ft(l.halfW * 0.3, w * (1 - P));
    }
  }
  for (const i of t.nodes) {
    const a = $.get(i.id), l = i.bearing * st / 180, L = lt(l), W = it(l) / b, S = f.get(i.id);
    S.sort(
      (F, h) => at(d.get(F.from).pos, i.pos, i.bearing, b) - at(d.get(h.from).pos, i.pos, i.bearing, b)
    );
    const v = pt(e, a.throughWeight), w = S.reduce((F, h) => F + Lt(h, e, p), 0), P = c ? v : w;
    let O = 0;
    for (const F of S) {
      const h = Lt(F, e, p), A = -P / 2 + O + h / 2;
      O += h;
      const m = mt(A, u, g, r), [z, N] = xt(i.bearing, m, b);
      a.inSlots.set(J(F), {
        pos: [
          i.pos[0] - W * a.approachLen + N,
          i.pos[1] - L * a.approachLen + z
        ],
        halfW: Y(h, u, g, r),
        bearing: i.bearing
      });
    }
    const k = R.get(i.id);
    k.sort(
      (F, h) => at(d.get(F.to).pos, i.pos, i.bearing, b) - at(d.get(h.to).pos, i.pos, i.bearing, b)
    );
    const q = k.reduce((F, h) => F + Lt(h, e, p), 0), D = c ? v : q;
    let x = 0;
    for (const F of k) {
      const h = Lt(F, e, p), A = -D / 2 + x + h / 2;
      x += h;
      const m = mt(A, u, g, r), [z, N] = xt(i.bearing, m, b);
      a.outSlots.set(J(F), {
        pos: [
          i.pos[0] + W * a.approachLen + N,
          i.pos[1] + L * a.approachLen + z
        ],
        halfW: Y(h, u, g, r),
        bearing: i.bearing
      });
    }
  }
  return { layouts: $, weights: p };
}
function yo(t, o) {
  const { bezierN: c = 20 } = o, { layouts: s, weights: r } = Ot(t, o, !0), u = [], g = G(o.refLat);
  for (const p of t.edges) {
    const d = J(p), $ = s.get(p.from), R = s.get(p.to), f = $.outSlots.get(d), b = R.inSlots.get(d), i = ct(f.pos, b.pos, f.bearing, b.bearing, c, g, $.node.velocity, R.node.velocity);
    u.push({
      type: "Feature",
      properties: { kind: "bezier", edge: d, weight: r.get(d) ?? 0 },
      geometry: {
        type: "LineString",
        coordinates: i.map((a) => [a[1], a[0]])
      }
    });
    for (let a = 0; a < i.length; a++)
      u.push({
        type: "Feature",
        properties: { kind: "bezier-pt", edge: d, idx: a },
        geometry: { type: "Point", coordinates: [i[a][1], i[a][0]] }
      });
  }
  const { arrowWing: n, arrowLen: e } = Et(o), { nodeApproach: y = 0.5 } = o;
  for (const [, p] of s)
    p.inWeight === 0 || p.outWeight === 0 || u.push({
      type: "Feature",
      properties: { kind: "approach", node: p.node.id },
      geometry: {
        type: "Polygon",
        coordinates: [[
          p.inFaceLeft,
          p.outFaceLeft,
          p.outFaceRight,
          p.inFaceRight,
          p.inFaceLeft
          // close
        ]]
      }
    });
  for (const [, p] of s) {
    if (!p.isSink) continue;
    const d = p.node, $ = d.bearing * st / 180, R = [lt($), it($) / g], f = [-it($), lt($) / g], b = p.halfW * 2 * e, i = p.halfW, a = i * n, l = d.pos[1] - R[0] * p.approachLen, L = d.pos[0] - R[1] * p.approachLen, W = d.pos[1] - R[0] * b, S = d.pos[0] - R[1] * b, v = [l + f[0] * i, L + f[1] * i], w = [l - f[0] * i, L - f[1] * i], P = [W + f[0] * i, S + f[1] * i], O = [W - f[0] * i, S - f[1] * i], k = [W + f[0] * a, S + f[1] * a], q = [W - f[0] * a, S - f[1] * a], D = [d.pos[1], d.pos[0]];
    u.push({
      type: "Feature",
      properties: { kind: "arrowhead", node: d.id },
      geometry: {
        type: "Polygon",
        coordinates: [[v, P, k, D, q, O, w, v]]
      }
    });
  }
  return { type: "FeatureCollection", features: u };
}
function bo(t, o) {
  const { refLat: c, bezierN: s = 20 } = o, { layouts: r } = Ot(t, o), u = G(c), g = [];
  for (const n of t.edges) {
    const e = J(n), y = r.get(n.from), p = r.get(n.to), d = y.outSlots.get(e), $ = p.inSlots.get(e), R = ct(d.pos, $.pos, d.bearing, $.bearing, s, u, y.node.velocity, p.node.velocity);
    g.push({
      type: "Feature",
      properties: { id: e, from: n.from, to: n.to },
      geometry: { type: "LineString", coordinates: R.map((f) => [f[1], f[0]]) }
    });
  }
  return { type: "FeatureCollection", features: g };
}
function mo(t, o) {
  var b, i;
  const {
    refLat: c,
    zoom: s,
    geoScale: r = 1,
    color: u,
    minArrowWingPx: g = 0,
    bezierN: n = 20
  } = o, e = Bt(o), { arrowWing: y, arrowLen: p } = Et(o), { layouts: d, weights: $ } = Ot(t, o), R = [], f = G(c);
  for (const a of t.edges) {
    const l = J(a), L = d.get(a.from), W = d.get(a.to), S = L.outSlots.get(l), v = W.inSlots.get(l), w = Lt(a, e, $), P = Y(w, s, r, c), O = ct(S.pos, v.pos, S.bearing, v.bearing, n, f, L.node.velocity, W.node.velocity), k = Pt(O, P, c);
    k.length && R.push(rt(k, {
      color: ((b = a.style) == null ? void 0 : b.color) ?? u,
      width: w,
      key: l,
      opacity: ((i = a.style) == null ? void 0 : i.opacity) ?? 1,
      from: a.from,
      to: a.to
    }));
  }
  for (const [, a] of d) {
    if (a.inWeight === 0 || a.outWeight === 0) continue;
    const l = a.node, L = G(c), [W, S] = Dt(l.bearing), v = [
      l.pos[0] - W * a.approachLen,
      l.pos[1] - S * a.approachLen * L
    ], w = [
      l.pos[0] + W * a.approachLen,
      l.pos[1] + S * a.approachLen * L
    ], P = Mt(v, w), O = Pt(P, a.halfW, c);
    O.length && R.push(rt(O, {
      color: u,
      width: pt(e, a.throughWeight),
      key: l.id,
      opacity: 1
    }));
  }
  for (const [, a] of d) {
    if (!a.isSink) continue;
    const l = a.node, L = G(c), [W, S] = Dt(l.bearing), v = [
      l.pos[0] - W * a.halfW * 10,
      l.pos[1] - S * a.halfW * 10 * L
    ], w = Mt(v, l.pos, 10), P = pt(e, a.throughWeight), O = (P + g * 2) / P, q = {
      arrowWingFactor: Ft(y, O),
      arrowLenFactor: p,
      widthPx: P
    }, D = Xt(w, a.halfW, c, q);
    D.length && R.push(rt(D, {
      color: u,
      width: P,
      key: `${l.id}-arrow`,
      opacity: 1
    }));
  }
  for (const [, a] of d) {
    if (!a.isSource) continue;
    const l = a.node, L = G(c), [W, S] = Dt(l.bearing), v = [
      l.pos[0] + W * a.approachLen,
      l.pos[1] + S * a.approachLen * L
    ], w = Mt(l.pos, v), P = Pt(w, a.halfW, c);
    P.length && R.push(rt(P, {
      color: u,
      width: pt(e, a.outWeight),
      key: `${l.id}-trunk`,
      opacity: 1
    }));
  }
  return R.sort((a, l) => {
    var L, W;
    return (((L = l.properties) == null ? void 0 : L.width) ?? 0) - (((W = a.properties) == null ? void 0 : W.width) ?? 0);
  }), { type: "FeatureCollection", features: R };
}
function uo(t, o, c, s) {
  const r = Nt(t, o, c, s);
  return { left: r.left, right: r.right, tip: r.tip };
}
function So(t, o) {
  const {
    refLat: c,
    zoom: s,
    geoScale: r = 1,
    color: u,
    minArrowWingPx: g = 0,
    plugBearingDeg: n = 1,
    plugFraction: e = 0.3,
    creaseSkip: y = 1,
    bezierN: p = 20
  } = o, d = Bt(o), { arrowWing: $, arrowLen: R } = Et(o), { layouts: f, weights: b } = Ot(t, o, !0), i = new Map(t.nodes.map((h) => [h.id, h])), a = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map();
  for (const h of t.nodes)
    a.set(h.id, []), l.set(h.id, []);
  for (const h of t.edges)
    a.get(h.from).push(h), l.get(h.to).push(h);
  const L = G(c), W = /* @__PURE__ */ new Map();
  for (const h of t.edges) {
    const A = J(h), m = f.get(h.from), z = f.get(h.to), N = m.outSlots.get(A), B = z.inSlots.get(A), T = Lt(h, d, b), _ = Y(T, s, r, c), M = ct(N.pos, B.pos, N.bearing, B.bearing, p, L, m.node.velocity, z.node.velocity);
    W.set(A, jt(M, _, c));
  }
  const S = /* @__PURE__ */ new Map();
  for (const [h, A] of f)
    A.inWeight === 0 || A.outWeight === 0 || S.set(h, {
      left: [A.inFaceLeft, A.outFaceLeft],
      right: [A.inFaceRight, A.outFaceRight]
    });
  const v = /* @__PURE__ */ new Map();
  for (const [h, A] of f) {
    if (!A.isSink) continue;
    const m = A.node, z = G(c), [N, B] = Dt(m.bearing), T = [m.pos[0] - N * A.halfW * 10, m.pos[1] - B * A.halfW * 10 * z], _ = pt(d, A.throughWeight), M = (_ + g * 2) / _, E = Ft($, M);
    v.set(h, uo(
      Mt(T, m.pos, 10),
      A.halfW,
      c,
      { arrowWingFactor: E, arrowLenFactor: R, widthPx: _ }
    ));
  }
  const w = /* @__PURE__ */ new Map();
  for (const [h, A] of f) {
    if (!A.isSource) continue;
    const m = A.node, z = m.bearing * st / 180, N = [
      m.pos[0] + it(z) / L * A.approachLen,
      m.pos[1] + lt(z) * A.approachLen
    ];
    w.set(h, jt(Mt(m.pos, N, p), A.halfW, c));
  }
  const P = G(c);
  function O(h) {
    return [...a.get(h)].sort(
      (A, m) => at(i.get(A.to).pos, f.get(h).node.pos, f.get(h).node.bearing, P) - at(i.get(m.to).pos, f.get(h).node.pos, f.get(h).node.bearing, P)
    );
  }
  function k(h) {
    return [...l.get(h)].sort(
      (A, m) => at(i.get(A.from).pos, f.get(h).node.pos, f.get(h).node.bearing, P) - at(i.get(m.from).pos, f.get(h).node.pos, f.get(h).node.bearing, P)
    );
  }
  const q = /* @__PURE__ */ new Set();
  function D(h, A, m) {
    const z = f.get(h);
    if (z.isSource) {
      q.add(h);
      const M = w.get(h);
      M && m.push(...M.left);
    }
    const N = O(h);
    if (z.isSink) {
      const M = z.node, E = M.bearing * st / 180, C = lt(E), I = it(E) / P, K = z.halfW * 2 * R, H = M.pos[1] - C * K, j = M.pos[0] - I * K, [U, nt] = xt(M.bearing, z.halfW, P), V = [H + U, j + nt], Z = [H - U, j - nt], [Q, ot] = xt(M.bearing, z.halfW * $, P), X = [H + Q, j + ot], et = [H - Q, j - ot], ft = [M.pos[1], M.pos[0]];
      m.push(V, X, ft, et, Z);
      return;
    }
    const B = k(h), T = A ? B.findIndex((M) => J(M) === A) : -1;
    if (T >= 0)
      for (let M = T + 1; M < B.length; M++) {
        const E = B[M], C = W.get(J(E)), I = [...C.right].reverse();
        if (m.push(...I), f.get(E.from).isSource) {
          q.add(E.from);
          const H = w.get(E.from);
          H && (m.push(...[...H.right].reverse()), m.push(...H.left));
        }
        m.push(...C.left);
      }
    const _ = [];
    for (let M = N.length - 1; M >= 0; M--) _.push(N[M]);
    for (let M = 0; M < _.length; M++) {
      const E = _[M], C = W.get(J(E));
      m.push(...C.left), D(E.to, J(E), m), m.push(...[...C.right].reverse());
    }
    if (T >= 0)
      for (let M = T - 1; M >= 0; M--) {
        const E = B[M], C = W.get(J(E)), I = [...C.right].reverse();
        if (m.push(...I), f.get(E.from).isSource) {
          q.add(E.from);
          const H = w.get(E.from);
          H && (m.push(...[...H.right].reverse()), m.push(...H.left));
        }
        m.push(...C.left);
      }
    if (z.isSource) {
      const M = w.get(h);
      M && m.push(...[...M.right].reverse());
    }
  }
  const x = [], F = [...f.entries()].filter(([, h]) => h.isSource).sort((h, A) => A[1].throughWeight - h[1].throughWeight);
  for (const [h] of F) {
    if (q.has(h)) continue;
    const A = O(h);
    if (A.length === 0) continue;
    const m = k(A[0].to);
    if (m.length > 0 && J(m[0]) !== J(A[0])) continue;
    let z = [];
    if (D(h, null, z), z.length > 0) {
      y > 0 && (z = ro(z), z = so(z)), z.push(z[0]);
      const N = pt(d, f.get(h).throughWeight);
      x.push(rt(z, { color: u, width: N, key: `sp-${h}`, opacity: 1 }));
    }
  }
  return { type: "FeatureCollection", features: x };
}
function Wo(t, o) {
  var n;
  const c = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
  for (const e of t.nodes)
    c.set(e.id, 0), s.set(e.id, 0);
  for (const e of t.edges)
    c.set(e.to, (c.get(e.to) ?? 0) + 1), s.set(e.from, (s.get(e.from) ?? 0) + 1);
  function r(e) {
    const y = c.get(e) ?? 0, p = s.get(e) ?? 0;
    return y === 0 ? "source" : p === 0 ? "sink" : p > 1 ? "split" : y > 1 ? "merge" : "through";
  }
  const u = o === "endpoints" ? /* @__PURE__ */ new Set(["source", "sink"]) : Array.isArray(o) ? new Set(o) : null, g = [];
  for (const e of t.nodes) {
    const y = r(e.id);
    if (u && !u.has(y) || (n = e.style) != null && n.hidden) continue;
    const p = {
      id: e.id,
      label: e.label ?? e.id,
      role: y,
      bearing: e.bearing,
      ...e.style
    };
    g.push({
      type: "Feature",
      properties: p,
      geometry: { type: "Point", coordinates: [e.pos[1], e.pos[0]] }
    });
  }
  return { type: "FeatureCollection", features: g };
}
function Po(t = {}) {
  return {
    "fill-color": ["get", "color"],
    "fill-opacity": 1,
    "fill-antialias": !1,
    ...t
  };
}
export {
  kt as bearingPerpLeft,
  no as buildJunctionMap,
  Kt as cubicBezier,
  qt as degPerPxZ12,
  ct as directedBezier,
  Po as flowFillPaint,
  to as flowSources,
  Rt as fwdAt,
  G as lngScale,
  Vt as nodeWeight,
  tt as nodeWidth,
  go as offsetPath,
  $t as perpAt,
  mt as pxToDeg,
  Y as pxToHalfDeg,
  bo as renderEdgeCenterlines,
  mo as renderFlowGraph,
  yo as renderFlowGraphDebug,
  So as renderFlowGraphSinglePoly,
  oo as renderFlowTree,
  eo as renderFlowTreeSinglePoly,
  wo as renderFlows,
  Wo as renderNodes,
  fo as resolveEdgeWeights,
  Pt as ribbon,
  Xt as ribbonArrow,
  Nt as ribbonArrowEdges,
  zt as ribbonEdges,
  rt as ringFeature,
  Lo as sBezier,
  ho as smoothPath,
  po as toGeoJSON
};
