const { cos: kt, pow: yt, sqrt: Gt, PI: Dt } = Math;
function O(t) {
  return 1 / kt(t * Dt / 180);
}
function bt(t) {
  return 156543.03 * kt(t * Dt / 180) / (yt(2, 12) * 111320);
}
function et(t, o, e, c) {
  return t / 2 * bt(c) * yt(2, (e - 1) * (o - 12));
}
function Mt(t, o, e, c) {
  return t * bt(c) * yt(2, (e - 1) * (o - 12));
}
function Vt(t) {
  return t.map(([o, e]) => [e, o]);
}
function to(t, o) {
  if (t.length < 2 || o === 0) return t;
  const [e, c] = t[0], [i, a] = t[t.length - 1], p = a - c, r = i - e, n = Gt(p * p + r * r);
  if (n === 0) return t;
  const d = -p / n, f = r / n, l = o * 4e-4;
  return t.map(([F, P]) => [F + d * l, P + f * l]);
}
const { sqrt: Y, max: Q, min: Rt, PI: ut, sin: tt, cos: ot } = Math;
function Et(t, o, e, c, i = 20) {
  const a = [];
  for (let p = 0; p <= i; p++) {
    const r = p / i, n = 1 - r;
    a.push([
      n * n * n * t[0] + 3 * n * n * r * o[0] + 3 * n * r * r * e[0] + r * r * r * c[0],
      n * n * n * t[1] + 3 * n * n * r * o[1] + 3 * n * r * r * e[1] + r * r * r * c[1]
    ]);
  }
  return a;
}
function oo(t, o = 12) {
  const e = t.length;
  if (e < 2) return { path: [...t], knots: t.map((a, p) => p) };
  const c = [], i = [];
  for (let a = 0; a < e - 1; a++) {
    const p = t[Q(a - 1, 0)], r = t[a], n = t[a + 1], d = t[Rt(a + 2, e - 1)];
    i.push(c.length);
    for (let f = 0; f < o; f++) {
      const l = f / o, F = l * l, P = F * l;
      c.push([
        0.5 * (2 * r[0] + (-p[0] + n[0]) * l + (2 * p[0] - 5 * r[0] + 4 * n[0] - d[0]) * F + (-p[0] + 3 * r[0] - 3 * n[0] + d[0]) * P),
        0.5 * (2 * r[1] + (-p[1] + n[1]) * l + (2 * p[1] - 5 * r[1] + 4 * n[1] - d[1]) * F + (-p[1] + 3 * r[1] - 3 * n[1] + d[1]) * P)
      ]);
    }
  }
  return i.push(c.length), c.push(t[e - 1]), { path: c, knots: i };
}
function no(t, o) {
  const e = o[1] - t[1], c = o[0] - t[0], i = Y(c * c + e * e), a = Q(Math.abs(e) * 0.5, i * 0.35), p = [t[0], t[1] + a], r = [o[0], o[1] - a];
  return Et(t, p, r, o);
}
function pt(t, o, e, c, i = 20, a = 1, p, r) {
  const n = a, d = [t[0] * n, t[1]], f = [o[0] * n, o[1]], l = f[0] - d[0], F = f[1] - d[1], P = Y(l * l + F * F), L = Math.atan2(F, l) * 180 / ut, b = (e ?? 90) * ut / 180, s = Math.abs((((e ?? 90) - L) % 360 + 540) % 360 - 180), u = p != null ? Q(p, 1e-3) : Q(P * (s < 90 ? 0.4 : 0.2), 1e-3), h = [d[0] + ot(b) * u, d[1] + tt(b) * u], w = (c ?? 90) * ut / 180, y = Math.abs((((c ?? 90) - L) % 360 + 540) % 360 - 180), M = r != null ? Q(r, 1e-3) : Q(P * (y < 90 ? 0.4 : 0.2), 1e-3), R = [f[0] - ot(w) * M, f[1] - tt(w) * M], m = Et(d, h, R, f, i);
  if (m.length >= 4) {
    const x = m[1][0] - m[0][0], E = m[1][1] - m[0][1], A = Y(x * x + E * E);
    m[1] = [d[0] + ot(b) * A, d[1] + tt(b) * A];
    const $ = m.length - 1, N = m[$][0] - m[$ - 1][0], k = m[$][1] - m[$ - 1][1], S = Y(N * N + k * k);
    m[$ - 1] = [f[0] - ot(w) * S, f[1] - tt(w) * S];
  }
  return m.map((x) => [x[0] / n, x[1]]);
}
function dt(t, o) {
  const e = t.length;
  let c = 0, i = 0;
  o < e - 1 && (c += t[o + 1][0] - t[o][0], i += t[o + 1][1] - t[o][1]), o > 0 && (c += t[o][0] - t[o - 1][0], i += t[o][1] - t[o - 1][1]);
  const a = Y(c * c + i * i);
  return a === 0 ? [0, 0] : [-i / a, c / a];
}
function gt(t, o) {
  const e = t.length, c = Rt(o + 1, e - 1), i = Q(o - 1, 0), a = t[c][0] - t[i][0], p = t[c][1] - t[i][1], r = Y(a * a + p * p);
  return r === 0 ? [0, 0] : [a / r, p / r];
}
function eo(t) {
  const o = t * ut / 180;
  return [tt(o), -ot(o)];
}
const { sqrt: lt, max: At, min: $t, ceil: zt, PI: Tt } = Math, _t = 0.65, Ht = 60;
function mt(t = {}) {
  const o = t.wing ?? _t, e = t.angle ?? Ht, c = 1 + 2 * o, i = c * Math.tan(e * Tt / 180) / 2;
  return { arrowWingFactor: c, arrowLenFactor: i };
}
function jt(t, o, e, c = {}) {
  const i = mt(), a = c.arrowWingFactor ?? i.arrowWingFactor, p = c.arrowLenFactor ?? i.arrowLenFactor, { widthPx: r } = c, n = t.length;
  if (n < 2) return [];
  const d = [0];
  for (let S = 1; S < n; S++) {
    const g = t[S][0] - t[S - 1][0], W = t[S][1] - t[S - 1][1];
    d.push(d[S - 1] + lt(g * g + W * W));
  }
  const f = d[n - 1], l = o * 2 * p, F = $t(l, f * (c.maxArrowFraction ?? 0.4)), P = l > 0 ? F / l : 1, L = r != null && r < 8 ? a + (8 - r) * 0.15 : a, b = o * (1 + (L - 1) * P), s = O(e), u = f - F, h = At(0, n - 1 - zt(n * 0.25));
  let w = t[n - 1][0] - t[h][0], y = t[n - 1][1] - t[h][1];
  const M = lt(w * w + y * y);
  M > 0 ? (w /= M, y /= M) : (w = gt(t, n - 1)[0], y = gt(t, n - 1)[1]);
  const R = -y, m = w, x = t[n - 1][0] - w * F, E = t[n - 1][1] - y * F, A = [], $ = [];
  for (let S = 0; S < n && !(d[S] > u); S++) {
    const [g, W] = dt(t, S);
    A.push([t[S][1] + W * o * s, t[S][0] + g * o]), $.push([t[S][1] - W * o * s, t[S][0] - g * o]);
  }
  A.push([E + m * o * s, x + R * o]), $.push([E - m * o * s, x - R * o]), A.push([E + m * b * s, x + R * b]), $.push([E - m * b * s, x - R * b]);
  const N = [t[n - 1][1], t[n - 1][0]], k = [...A, N, ...$.reverse()];
  return k.push(k[0]), k;
}
function wt(t, o, e) {
  const c = t.length;
  if (c < 2) return [];
  const i = O(e), a = [], p = [];
  for (let n = 0; n < c; n++) {
    const [d, f] = dt(t, n);
    a.push([t[n][1] + f * o * i, t[n][0] + d * o]), p.push([t[n][1] - f * o * i, t[n][0] - d * o]);
  }
  const r = [...a, ...p.reverse()];
  return r.push(r[0]), r;
}
function so(t, o, e) {
  const c = t.length;
  if (c < 2) return { left: [], right: [] };
  const i = O(e), a = [], p = [];
  for (let r = 0; r < c; r++) {
    const [n, d] = dt(t, r);
    a.push([t[r][1] + d * o * i, t[r][0] + n * o]), p.push([t[r][1] - d * o * i, t[r][0] - n * o]);
  }
  return { left: a, right: p };
}
function Ut(t, o, e, c = {}) {
  const i = mt(), a = c.arrowWingFactor ?? i.arrowWingFactor, p = c.arrowLenFactor ?? i.arrowLenFactor, { widthPx: r } = c, n = t.length;
  if (n < 2) return { left: [], right: [], tip: [0, 0] };
  const d = [0];
  for (let k = 1; k < n; k++) {
    const S = t[k][0] - t[k - 1][0], g = t[k][1] - t[k - 1][1];
    d.push(d[k - 1] + lt(S * S + g * g));
  }
  const f = d[n - 1], l = o * 2 * p, F = $t(l, f * (c.maxArrowFraction ?? 0.4)), P = l > 0 ? F / l : 1, L = r != null && r < 8 ? a + (8 - r) * 0.15 : a, b = o * (1 + (L - 1) * P), s = O(e), u = f - F, h = At(0, n - 1 - zt(n * 0.25));
  let w = t[n - 1][0] - t[h][0], y = t[n - 1][1] - t[h][1];
  const M = lt(w * w + y * y);
  M > 0 ? (w /= M, y /= M) : (w = gt(t, n - 1)[0], y = gt(t, n - 1)[1]);
  const R = -y, m = w, x = t[n - 1][0] - w * F, E = t[n - 1][1] - y * F, A = [], $ = [];
  for (let k = 0; k < n && !(d[k] > u); k++) {
    const [S, g] = dt(t, k);
    A.push([t[k][1] + g * o * s, t[k][0] + S * o]), $.push([t[k][1] - g * o * s, t[k][0] - S * o]);
  }
  A.push([E + m * o * s, x + R * o]), $.push([E - m * o * s, x - R * o]), A.push([E + m * b * s, x + R * b]), $.push([E - m * b * s, x - R * b]);
  const N = [t[n - 1][1], t[n - 1][0]];
  return { left: A, right: $, tip: N };
}
function nt(t, o) {
  return {
    type: "Feature",
    properties: o,
    geometry: { type: "Polygon", coordinates: [t] }
  };
}
const { cos: U, sin: I, PI: _, max: st } = Math;
function It(t, o = 1e-6) {
  if (t.length < 3) return t;
  const e = [t[0]];
  for (let c = 1; c < t.length - 1; c++) {
    const [i, a] = t[c - 1], [p, r] = t[c], [n, d] = t[c + 1], f = n - i, l = d - a, F = Math.sqrt(f * f + l * l);
    if (F === 0) continue;
    Math.abs((p - i) * l - (r - a) * f) / F > o && e.push(t[c]);
  }
  return e.push(t[t.length - 1]), e;
}
function Jt(t, o, e, c) {
  const i = o[0] - t[0], a = o[1] - t[1], p = c[0] - e[0], r = c[1] - e[1], n = i * r - a * p;
  if (Math.abs(n) < 1e-20) return null;
  const d = ((e[0] - t[0]) * r - (e[1] - t[1]) * p) / n, f = ((e[0] - t[0]) * a - (e[1] - t[1]) * i) / n;
  return d < 1e-3 || d > 0.999 || f < 1e-3 || f > 0.999 ? null : [t[0] + i * d, t[1] + a * d];
}
function Zt(t) {
  for (let e = t.length - 2; e >= 0; e--) {
    const c = t[e + 1][0] - t[e][0], i = t[e + 1][1] - t[e][1];
    c * c + i * i < 1e-18 && t.splice(e + 1, 1);
  }
  let o = !0;
  for (; o; ) {
    o = !1;
    for (let e = 0; e < t.length - 3 && !o; e++)
      for (let c = e + 2; c < t.length - 1 && !o; c++) {
        if (e === 0 && c === t.length - 2) continue;
        const i = Jt(t[e], t[e + 1], t[c], t[c + 1]);
        i && (t.splice(e + 1, c - e, i), o = !0);
      }
  }
  return t;
}
function Lt(t) {
  const { arrowWingFactor: o, arrowLenFactor: e } = mt(t);
  return {
    arrowWing: t.arrowWing ?? o,
    arrowLen: t.arrowLen ?? e
  };
}
function ft(t) {
  const o = t * _ / 180;
  return [U(o), I(o)];
}
function Kt(t) {
  const o = t * _ / 180;
  return [I(o), -U(o)];
}
function ct(t, o, e) {
  const c = t * _ / 180, i = U(c), a = I(c), p = Math.sqrt(i * i * e * e + a * a), r = -i * e / p, n = a / p;
  return [r * o * e, n * o];
}
function K(t, o) {
  return typeof t == "number" ? o * t : t(o);
}
const Qt = 111320;
function Ft(t) {
  if (t.mPerWeight == null) return t.pxPerWeight;
  const o = Math.pow(2, t.zoom - 12) / (bt(t.refLat) * Qt);
  return t.mPerWeight * o;
}
function X(t, o, e) {
  var c;
  return K(o, e.get(q(t)) ?? 0) * (((c = t.style) == null ? void 0 : c.widthScale) ?? 1);
}
function q(t) {
  return `${t.from}→${t.to}`;
}
function Xt(t) {
  var a, p;
  const o = /* @__PURE__ */ new Map(), e = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map();
  for (const r of t.nodes)
    e.set(r.id, []), c.set(r.id, []);
  for (const r of t.edges)
    (a = c.get(r.from)) == null || a.push(r), (p = e.get(r.to)) == null || p.push(r);
  let i = !0;
  for (; i && o.size < t.edges.length; ) {
    i = !1;
    for (const r of t.edges) {
      const n = q(r);
      if (o.has(n)) continue;
      if (typeof r.weight == "number") {
        o.set(n, r.weight), i = !0;
        continue;
      }
      const d = e.get(r.from) ?? [];
      if (!d.every((b) => o.has(q(b)))) continue;
      const f = d.reduce((b, s) => b + (o.get(q(s)) ?? 0), 0), l = c.get(r.from) ?? [], F = l.filter((b) => typeof b.weight == "number").reduce((b, s) => b + s.weight, 0), P = l.filter((b) => b.weight === "auto").length, L = P > 0 ? Math.max(0, f - F) / P : 0;
      o.set(n, L), i = !0;
    }
  }
  for (const r of t.edges)
    o.has(q(r)) || (console.warn(`[geo-sankey] could not resolve auto weight for ${q(r)}`), o.set(q(r), 0));
  return o;
}
function vt(t, o, e) {
  const c = t.length;
  if (c < 2) return { left: [], right: [] };
  const i = O(e), a = [], p = [], r = [];
  for (let n = 0; n < c - 1; n++) {
    const d = (t[n + 1][0] - t[n][0]) * i, f = t[n + 1][1] - t[n][1], l = Math.sqrt(f * f + d * d);
    l > 0 ? r.push({ pLon: -d / l, pLat: f / l }) : r.push({ pLon: 0, pLat: 0 });
  }
  for (let n = 0; n < c; n++) {
    let d, f;
    if (n === 0)
      d = r[0].pLon, f = r[0].pLat;
    else if (n === c - 1)
      d = r[c - 2].pLon, f = r[c - 2].pLat;
    else {
      const l = r[n - 1], F = r[n], P = l.pLon + F.pLon, L = l.pLat + F.pLat, b = Math.sqrt(P * P + L * L);
      if (b > 1e-3) {
        const s = P / b, u = L / b, h = s * l.pLon + u * l.pLat, w = Math.min(1 / Math.max(h, 0.01), 2);
        d = s * w, f = u * w;
      } else
        d = l.pLon, f = l.pLat;
    }
    a.push([t[n][1] + d * o * i, t[n][0] + f * o]), p.push([t[n][1] - d * o * i, t[n][0] - f * o]);
  }
  return { left: a, right: p };
}
function rt(t, o, e = 5) {
  const c = [];
  for (let i = 0; i <= e; i++) {
    const a = i / e;
    c.push([t[0] + (o[0] - t[0]) * a, t[1] + (o[1] - t[1]) * a]);
  }
  return c;
}
function Z(t, o, e, c) {
  const [i, a] = Kt(e), p = t[0] - o[0], r = (t[1] - o[1]) * c;
  return p * i + r * a;
}
function ht(t, o, e = !1) {
  const c = t.nodes.map((s) => ({ ...s, pos: [...s.pos] }));
  t = { ...t, nodes: c };
  const { refLat: i, zoom: a, geoScale: p = 1, nodeApproach: r = 0.5 } = o, n = Ft(o), { arrowLen: d } = Lt(o), f = Xt(t), l = new Map(t.nodes.map((s) => [s.id, s])), F = /* @__PURE__ */ new Map(), P = /* @__PURE__ */ new Map(), L = /* @__PURE__ */ new Map();
  for (const s of t.nodes)
    P.set(s.id, []), L.set(s.id, []);
  for (const s of t.edges)
    P.get(s.from).push(s), L.get(s.to).push(s);
  const b = O(i);
  for (const s of t.nodes) {
    if (s.bearing != null) continue;
    const u = L.get(s.id), h = P.get(s.id);
    if (h.length === 1) {
      const w = l.get(h[0].to), y = w.pos[0] - s.pos[0], M = (w.pos[1] - s.pos[1]) * O(i);
      s.bearing = Math.atan2(M, y) * 180 / _;
    } else if (h.length === 0 && u.length === 1) {
      const w = l.get(u[0].from), y = s.pos[0] - w.pos[0], M = (s.pos[1] - w.pos[1]) * O(i);
      s.bearing = Math.atan2(M, y) * 180 / _;
    } else
      s.bearing = 90;
  }
  for (const s of t.nodes) {
    const u = (k) => {
      var S;
      return (f.get(q(k)) ?? 0) * (((S = k.style) == null ? void 0 : S.widthScale) ?? 1);
    }, h = L.get(s.id).reduce((k, S) => k + u(S), 0), w = P.get(s.id).reduce((k, S) => k + u(S), 0), y = st(h, w), M = et(K(n, y), a, p, i), R = s.bearing * _ / 180, m = I(R), x = U(R) / b, [E, A] = ct(s.bearing, M, b), $ = P.get(s.id).length === 0 && h > 0, N = $ ? M * 2 * d : M * r;
    F.set(s.id, {
      node: s,
      inSlots: /* @__PURE__ */ new Map(),
      outSlots: /* @__PURE__ */ new Map(),
      inWeight: h,
      outWeight: w,
      throughWeight: y,
      halfW: M,
      approachLen: N,
      isSink: $,
      isSource: L.get(s.id).length === 0 && w > 0,
      // Face corners [lon, lat] — perpOffset matches offsetCurve width
      inFaceLeft: [s.pos[1] - m * N + E, s.pos[0] - x * N + A],
      inFaceRight: [s.pos[1] - m * N - E, s.pos[0] - x * N - A],
      outFaceLeft: [s.pos[1] + m * N + E, s.pos[0] + x * N + A],
      outFaceRight: [s.pos[1] + m * N - E, s.pos[0] + x * N - A]
    });
  }
  for (const s of t.edges) {
    const u = F.get(s.from), h = F.get(s.to), w = h.node.pos[0] - u.node.pos[0], y = (h.node.pos[1] - u.node.pos[1]) * b, M = Math.sqrt(w * w + y * y), R = u.approachLen + h.approachLen;
    if (R > M * 0.5 && M > 0) {
      const m = M * 0.5, x = u.approachLen / R;
      u.approachLen = st(u.halfW * 0.3, m * x), h.approachLen = st(h.halfW * 0.3, m * (1 - x));
    }
  }
  for (const s of t.nodes) {
    const u = F.get(s.id), h = s.bearing * _ / 180, w = I(h), y = U(h) / b, M = L.get(s.id);
    M.sort(
      (S, g) => Z(l.get(S.from).pos, s.pos, s.bearing, b) - Z(l.get(g.from).pos, s.pos, s.bearing, b)
    );
    const R = K(n, u.throughWeight), m = M.reduce((S, g) => S + X(g, n, f), 0), x = e ? R : m;
    let E = 0;
    for (const S of M) {
      const g = X(S, n, f), W = -x / 2 + E + g / 2;
      E += g;
      const v = Mt(W, a, p, i), [z, B] = ct(s.bearing, v, b);
      u.inSlots.set(q(S), {
        pos: [
          s.pos[0] - y * u.approachLen + B,
          s.pos[1] - w * u.approachLen + z
        ],
        halfW: et(g, a, p, i),
        bearing: s.bearing
      });
    }
    const A = P.get(s.id);
    A.sort(
      (S, g) => Z(l.get(S.to).pos, s.pos, s.bearing, b) - Z(l.get(g.to).pos, s.pos, s.bearing, b)
    );
    const $ = A.reduce((S, g) => S + X(g, n, f), 0), N = e ? R : $;
    let k = 0;
    for (const S of A) {
      const g = X(S, n, f), W = -N / 2 + k + g / 2;
      k += g;
      const v = Mt(W, a, p, i), [z, B] = ct(s.bearing, v, b);
      u.outSlots.set(q(S), {
        pos: [
          s.pos[0] + y * u.approachLen + B,
          s.pos[1] + w * u.approachLen + z
        ],
        halfW: et(g, a, p, i),
        bearing: s.bearing
      });
    }
  }
  return { layouts: F, weights: f };
}
function co(t, o) {
  const { bezierN: e = 20 } = o, { layouts: c, weights: i } = ht(t, o, !0), a = [], p = O(o.refLat);
  for (const f of t.edges) {
    const l = q(f), F = c.get(f.from), P = c.get(f.to), L = F.outSlots.get(l), b = P.inSlots.get(l), s = pt(L.pos, b.pos, L.bearing, b.bearing, e, p, F.node.velocity, P.node.velocity);
    a.push({
      type: "Feature",
      properties: { kind: "bezier", edge: l, weight: i.get(l) ?? 0 },
      geometry: {
        type: "LineString",
        coordinates: s.map((u) => [u[1], u[0]])
      }
    });
    for (let u = 0; u < s.length; u++)
      a.push({
        type: "Feature",
        properties: { kind: "bezier-pt", edge: l, idx: u },
        geometry: { type: "Point", coordinates: [s[u][1], s[u][0]] }
      });
  }
  const { arrowWing: r, arrowLen: n } = Lt(o), { nodeApproach: d = 0.5 } = o;
  for (const [, f] of c)
    f.inWeight === 0 || f.outWeight === 0 || a.push({
      type: "Feature",
      properties: { kind: "approach", node: f.node.id },
      geometry: {
        type: "Polygon",
        coordinates: [[
          f.inFaceLeft,
          f.outFaceLeft,
          f.outFaceRight,
          f.inFaceRight,
          f.inFaceLeft
          // close
        ]]
      }
    });
  for (const [, f] of c) {
    if (!f.isSink) continue;
    const l = f.node, F = l.bearing * _ / 180, P = [I(F), U(F) / p], L = [-U(F), I(F) / p], b = f.halfW * 2 * n, s = f.halfW, u = s * r, h = l.pos[1] - P[0] * f.approachLen, w = l.pos[0] - P[1] * f.approachLen, y = l.pos[1] - P[0] * b, M = l.pos[0] - P[1] * b, R = [h + L[0] * s, w + L[1] * s], m = [h - L[0] * s, w - L[1] * s], x = [y + L[0] * s, M + L[1] * s], E = [y - L[0] * s, M - L[1] * s], A = [y + L[0] * u, M + L[1] * u], $ = [y - L[0] * u, M - L[1] * u], N = [l.pos[1], l.pos[0]];
    a.push({
      type: "Feature",
      properties: { kind: "arrowhead", node: l.id },
      geometry: {
        type: "Polygon",
        coordinates: [[R, x, A, N, $, E, m, R]]
      }
    });
  }
  return { type: "FeatureCollection", features: a };
}
function ro(t, o) {
  const { refLat: e, bezierN: c = 20 } = o, { layouts: i } = ht(t, o), a = O(e), p = [];
  for (const r of t.edges) {
    const n = q(r), d = i.get(r.from), f = i.get(r.to), l = d.outSlots.get(n), F = f.inSlots.get(n), P = pt(l.pos, F.pos, l.bearing, F.bearing, c, a, d.node.velocity, f.node.velocity);
    p.push({
      type: "Feature",
      properties: { id: n, from: r.from, to: r.to },
      geometry: { type: "LineString", coordinates: P.map((L) => [L[1], L[0]]) }
    });
  }
  return { type: "FeatureCollection", features: p };
}
function io(t, o) {
  var b, s;
  const {
    refLat: e,
    zoom: c,
    geoScale: i = 1,
    color: a,
    minArrowWingPx: p = 0,
    bezierN: r = 20
  } = o, n = Ft(o), { arrowWing: d, arrowLen: f } = Lt(o), { layouts: l, weights: F } = ht(t, o), P = [], L = O(e);
  for (const u of t.edges) {
    const h = q(u), w = l.get(u.from), y = l.get(u.to), M = w.outSlots.get(h), R = y.inSlots.get(h), m = X(u, n, F), x = et(m, c, i, e), E = pt(M.pos, R.pos, M.bearing, R.bearing, r, L, w.node.velocity, y.node.velocity), A = wt(E, x, e);
    A.length && P.push(nt(A, {
      color: ((b = u.style) == null ? void 0 : b.color) ?? a,
      width: m,
      key: h,
      opacity: ((s = u.style) == null ? void 0 : s.opacity) ?? 1,
      from: u.from,
      to: u.to
    }));
  }
  for (const [, u] of l) {
    if (u.inWeight === 0 || u.outWeight === 0) continue;
    const h = u.node, w = O(e), [y, M] = ft(h.bearing), R = [
      h.pos[0] - y * u.approachLen,
      h.pos[1] - M * u.approachLen * w
    ], m = [
      h.pos[0] + y * u.approachLen,
      h.pos[1] + M * u.approachLen * w
    ], x = rt(R, m), E = wt(x, u.halfW, e);
    E.length && P.push(nt(E, {
      color: a,
      width: K(n, u.throughWeight),
      key: h.id,
      opacity: 1
    }));
  }
  for (const [, u] of l) {
    if (!u.isSink) continue;
    const h = u.node, w = O(e), [y, M] = ft(h.bearing), R = [
      h.pos[0] - y * u.halfW * 10,
      h.pos[1] - M * u.halfW * 10 * w
    ], m = rt(R, h.pos, 10), x = K(n, u.throughWeight), E = (x + p * 2) / x, $ = {
      arrowWingFactor: st(d, E),
      arrowLenFactor: f,
      widthPx: x
    }, N = jt(m, u.halfW, e, $);
    N.length && P.push(nt(N, {
      color: a,
      width: x,
      key: `${h.id}-arrow`,
      opacity: 1
    }));
  }
  for (const [, u] of l) {
    if (!u.isSource) continue;
    const h = u.node, w = O(e), [y, M] = ft(h.bearing), R = [
      h.pos[0] + y * u.approachLen,
      h.pos[1] + M * u.approachLen * w
    ], m = rt(h.pos, R), x = wt(m, u.halfW, e);
    x.length && P.push(nt(x, {
      color: a,
      width: K(n, u.outWeight),
      key: `${h.id}-trunk`,
      opacity: 1
    }));
  }
  return P.sort((u, h) => {
    var w, y;
    return (((w = h.properties) == null ? void 0 : w.width) ?? 0) - (((y = u.properties) == null ? void 0 : y.width) ?? 0);
  }), { type: "FeatureCollection", features: P };
}
function Yt(t, o, e, c) {
  const i = Ut(t, o, e, c);
  return { left: i.left, right: i.right, tip: i.tip };
}
function ao(t, o) {
  const {
    refLat: e,
    zoom: c,
    geoScale: i = 1,
    color: a,
    minArrowWingPx: p = 0,
    plugBearingDeg: r = 1,
    plugFraction: n = 0.3,
    creaseSkip: d = 1,
    bezierN: f = 20
  } = o, l = Ft(o), { arrowWing: F, arrowLen: P } = Lt(o), { layouts: L, weights: b } = ht(t, o, !0), s = new Map(t.nodes.map((g) => [g.id, g])), u = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map();
  for (const g of t.nodes)
    u.set(g.id, []), h.set(g.id, []);
  for (const g of t.edges)
    u.get(g.from).push(g), h.get(g.to).push(g);
  const w = O(e), y = /* @__PURE__ */ new Map();
  for (const g of t.edges) {
    const W = q(g), v = L.get(g.from), z = L.get(g.to), B = v.outSlots.get(W), H = z.inSlots.get(W), J = X(g, l, b), j = et(J, c, i, e), D = pt(B.pos, H.pos, B.bearing, H.bearing, f, w, v.node.velocity, z.node.velocity);
    y.set(W, vt(D, j, e));
  }
  const M = /* @__PURE__ */ new Map();
  for (const [g, W] of L)
    W.inWeight === 0 || W.outWeight === 0 || M.set(g, {
      left: [W.inFaceLeft, W.outFaceLeft],
      right: [W.inFaceRight, W.outFaceRight]
    });
  const R = /* @__PURE__ */ new Map();
  for (const [g, W] of L) {
    if (!W.isSink) continue;
    const v = W.node, z = O(e), [B, H] = ft(v.bearing), J = [v.pos[0] - B * W.halfW * 10, v.pos[1] - H * W.halfW * 10 * z], j = K(l, W.throughWeight), D = (j + p * 2) / j, C = st(F, D);
    R.set(g, Yt(
      rt(J, v.pos, 10),
      W.halfW,
      e,
      { arrowWingFactor: C, arrowLenFactor: P, widthPx: j }
    ));
  }
  const m = /* @__PURE__ */ new Map();
  for (const [g, W] of L) {
    if (!W.isSource) continue;
    const v = W.node, z = v.bearing * _ / 180, B = [
      v.pos[0] + U(z) / w * W.approachLen,
      v.pos[1] + I(z) * W.approachLen
    ];
    m.set(g, vt(rt(v.pos, B, f), W.halfW, e));
  }
  const x = O(e);
  function E(g) {
    return [...u.get(g)].sort(
      (W, v) => Z(s.get(W.to).pos, L.get(g).node.pos, L.get(g).node.bearing, x) - Z(s.get(v.to).pos, L.get(g).node.pos, L.get(g).node.bearing, x)
    );
  }
  function A(g) {
    return [...h.get(g)].sort(
      (W, v) => Z(s.get(W.from).pos, L.get(g).node.pos, L.get(g).node.bearing, x) - Z(s.get(v.from).pos, L.get(g).node.pos, L.get(g).node.bearing, x)
    );
  }
  const $ = /* @__PURE__ */ new Set();
  function N(g, W, v) {
    const z = L.get(g);
    if (z.isSource) {
      $.add(g);
      const D = m.get(g);
      D && v.push(...D.left);
    }
    const B = E(g);
    if (z.isSink) {
      const D = z.node, C = D.bearing * _ / 180, T = I(C), V = U(C) / x, it = z.halfW * 2 * P, G = D.pos[1] - T * it, at = D.pos[0] - V * it, [St, xt] = ct(D.bearing, z.halfW, x), Nt = [G + St, at + xt], qt = [G - St, at - xt], [Pt, Wt] = ct(D.bearing, z.halfW * F, x), Ct = [G + Pt, at + Wt], Ot = [G - Pt, at - Wt], Bt = [D.pos[1], D.pos[0]];
      v.push(Nt, Ct, Bt, Ot, qt);
      return;
    }
    const H = A(g), J = W ? H.findIndex((D) => q(D) === W) : -1;
    if (J >= 0)
      for (let D = J + 1; D < H.length; D++) {
        const C = H[D], T = y.get(q(C)), V = [...T.right].reverse();
        if (v.push(...V), L.get(C.from).isSource) {
          $.add(C.from);
          const G = m.get(C.from);
          G && (v.push(...[...G.right].reverse()), v.push(...G.left));
        }
        v.push(...T.left);
      }
    const j = [];
    for (let D = B.length - 1; D >= 0; D--) j.push(B[D]);
    for (let D = 0; D < j.length; D++) {
      const C = j[D], T = y.get(q(C));
      v.push(...T.left), N(C.to, q(C), v), v.push(...[...T.right].reverse());
    }
    if (J >= 0)
      for (let D = J - 1; D >= 0; D--) {
        const C = H[D], T = y.get(q(C)), V = [...T.right].reverse();
        if (v.push(...V), L.get(C.from).isSource) {
          $.add(C.from);
          const G = m.get(C.from);
          G && (v.push(...[...G.right].reverse()), v.push(...G.left));
        }
        v.push(...T.left);
      }
    if (z.isSource) {
      const D = m.get(g);
      D && v.push(...[...D.right].reverse());
    }
  }
  const k = [], S = [...L.entries()].filter(([, g]) => g.isSource).sort((g, W) => W[1].throughWeight - g[1].throughWeight);
  for (const [g] of S) {
    if ($.has(g)) continue;
    const W = E(g);
    if (W.length === 0) continue;
    const v = A(W[0].to);
    if (v.length > 0 && q(v[0]) !== q(W[0])) continue;
    let z = [];
    if (N(g, null, z), z.length > 0) {
      d > 0 && (z = Zt(z), z = It(z)), z.push(z[0]);
      const B = K(l, L.get(g).throughWeight);
      k.push(nt(z, { color: a, width: B, key: `sp-${g}`, opacity: 1 }));
    }
  }
  return { type: "FeatureCollection", features: k };
}
function uo(t, o) {
  var r;
  const e = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map();
  for (const n of t.nodes)
    e.set(n.id, 0), c.set(n.id, 0);
  for (const n of t.edges)
    e.set(n.to, (e.get(n.to) ?? 0) + 1), c.set(n.from, (c.get(n.from) ?? 0) + 1);
  function i(n) {
    const d = e.get(n) ?? 0, f = c.get(n) ?? 0;
    return d === 0 ? "source" : f === 0 ? "sink" : f > 1 ? "split" : d > 1 ? "merge" : "through";
  }
  const a = o === "endpoints" ? /* @__PURE__ */ new Set(["source", "sink"]) : Array.isArray(o) ? new Set(o) : null, p = [];
  for (const n of t.nodes) {
    const d = i(n.id);
    if (a && !a.has(d) || (r = n.style) != null && r.hidden) continue;
    const f = {
      id: n.id,
      label: n.label ?? n.id,
      role: d,
      bearing: n.bearing,
      ...n.style
    };
    p.push({
      type: "Feature",
      properties: f,
      geometry: { type: "Point", coordinates: [n.pos[1], n.pos[0]] }
    });
  }
  return { type: "FeatureCollection", features: p };
}
export {
  Ht as D,
  jt as a,
  eo as b,
  wt as c,
  pt as d,
  Ut as e,
  so as f,
  et as g,
  _t as h,
  Et as i,
  bt as j,
  gt as k,
  O as l,
  dt as m,
  ro as n,
  to as o,
  Mt as p,
  io as q,
  nt as r,
  co as s,
  ao as t,
  uo as u,
  mt as v,
  Xt as w,
  no as x,
  oo as y,
  Vt as z
};
