import { useReducer as he, useCallback as b, useState as I, useMemo as K, useRef as te, useEffect as Y } from "react";
import { w as ye, l as re } from "../graph-Dd5qc5zb.js";
import { jsxs as z, Fragment as F, jsx as p } from "react/jsx-runtime";
function me(e, t) {
  switch (t.type) {
    case "set": {
      const o = typeof t.next == "function" ? t.next(e.graph) : t.next;
      return t.history ? o === e.graph ? e : { graph: o, past: [...e.past, e.graph], future: [] } : { ...e, graph: o };
    }
    case "pushHistory":
      return e.past[e.past.length - 1] === t.snapshot ? e : { ...e, past: [...e.past, t.snapshot], future: [] };
    case "undo":
      return e.past.length === 0 ? e : { graph: e.past[e.past.length - 1], past: e.past.slice(0, -1), future: [...e.future, e.graph] };
    case "redo":
      return e.future.length === 0 ? e : { graph: e.future[e.future.length - 1], past: [...e.past, e.graph], future: e.future.slice(0, -1) };
  }
}
function Ne(e) {
  const [t, o] = he(me, null, () => ({
    graph: typeof e == "function" ? e() : e,
    past: [],
    future: []
  })), n = b((m) => {
    o({ type: "set", next: m, history: !1 });
  }, []), f = b((m) => {
    o({ type: "set", next: m, history: !0 });
  }, []), h = b((m) => {
    o({ type: "pushHistory", snapshot: m });
  }, []), x = b(() => o({ type: "undo" }), []), O = b(() => o({ type: "redo" }), []);
  return {
    graph: t.graph,
    setGraph: n,
    pushGraph: f,
    pushHistory: h,
    undo: x,
    redo: O,
    canUndo: t.past.length > 0,
    canRedo: t.future.length > 0,
    pastLen: t.past.length,
    futureLen: t.future.length,
    dispatch: o
  };
}
function ie(e, t) {
  return e.type !== t.type ? !1 : e.type === "node" && t.type === "node" ? e.id === t.id : e.type === "edge" && t.type === "edge" ? e.from === t.from && e.to === t.to : !1;
}
function Me(e, t) {
  const o = (t == null ? void 0 : t.persist) ?? "sessionStorage", [n, f] = I(() => {
    if (o === "none") return [];
    try {
      const s = sessionStorage.getItem("geo-sankey-sel");
      if (!s) return [];
      const d = JSON.parse(s);
      return Array.isArray(d) ? d : d ? [d] : [];
    } catch {
      return [];
    }
  }), h = b((s) => {
    f((d) => {
      const c = typeof s == "function" ? s(d) : s;
      return o === "sessionStorage" && sessionStorage.setItem("geo-sankey-sel", JSON.stringify(c)), c;
    });
  }, [o]), x = n[0] ?? null, O = b((s, d) => {
    h(d ? (c) => c.some((r) => ie(r, s)) ? c.filter((r) => !ie(r, s)) : [...c, s] : [s]);
  }, [h]), m = K(
    () => n.filter((s) => s.type === "node").map((s) => s.id),
    [n]
  ), C = K(
    () => n.filter((s) => s.type === "edge").map((s) => `${s.from}->${s.to}`),
    [n]
  ), L = K(() => n.filter((d) => d.type === "node").map((d) => e.nodes.find((c) => c.id === d.id)).filter(Boolean), [n, e.nodes]), v = K(() => n.filter((d) => d.type === "edge").map((d) => e.edges.find((c) => c.from === d.from && c.to === d.to)).filter(Boolean), [n, e.edges]), w = K(() => ye(e), [e]), $ = b((s) => {
    let d = 0, c = 0;
    for (const r of e.edges)
      r.to === s && d++, r.from === s && c++;
    return d === 0 && c === 0 ? "isolated" : d === 0 ? "source" : c === 0 ? "sink" : c > 1 ? "split" : d > 1 ? "merge" : "through";
  }, [e.edges]), l = b((s, d) => {
    if (!v.length) return;
    const c = d ? (i) => {
      var u;
      return (u = i.style) == null ? void 0 : u[s];
    } : (i) => i[s], r = c(v[0]);
    return v.every((i) => c(i) === r) ? r : void 0;
  }, [v]);
  return {
    selections: n,
    setSelections: h,
    selection: x,
    toggleOrReplace: O,
    selectedNodes: L,
    selectedEdges: v,
    selectedNodeIds: m,
    selectedEdgeIds: C,
    resolvedWeights: w,
    nodeRoleOf: $,
    aggEdge: l
  };
}
function Be(e, t) {
  const { pushGraph: o } = e, { setSelections: n, selectedEdges: f } = t, h = b((r, i) => {
    !i || i === r || (o((u) => u.nodes.some((a) => a.id === i) ? u : {
      nodes: u.nodes.map((a) => a.id === r ? { ...a, id: i } : a),
      edges: u.edges.map((a) => ({
        ...a,
        from: a.from === r ? i : a.from,
        to: a.to === r ? i : a.to
      }))
    }), n((u) => u.map(
      (a) => a.type === "node" && a.id === r ? { type: "node", id: i } : a.type === "edge" && (a.from === r || a.to === r) ? {
        type: "edge",
        from: a.from === r ? i : a.from,
        to: a.to === r ? i : a.to
      } : a
    )));
  }, [o, n]), x = b((r) => {
    if (r.length === 0) return;
    const i = new Set(r), u = 1e-3, a = Date.now().toString(36), y = new Map(r.map((g, k) => [g, `${g}-copy${a}-${k}`]));
    o((g) => {
      const k = g.nodes.filter((A) => i.has(A.id)).map((A) => ({
        ...A,
        id: y.get(A.id),
        pos: [A.pos[0] + u, A.pos[1] + u]
      })), j = g.edges.filter((A) => i.has(A.from) && i.has(A.to)).map((A) => ({ ...A, from: y.get(A.from), to: y.get(A.to) }));
      return { nodes: [...g.nodes, ...k], edges: [...g.edges, ...j] };
    }), n([...y.values()].map((g) => ({ type: "node", id: g })));
  }, [o, n]), O = b((r, i) => {
    o((u) => ({
      ...u,
      nodes: u.nodes.map((a) => a.id === r ? { ...a, ...i } : a)
    }));
  }, [o]), m = b((r) => {
    const i = `n${Date.now()}`;
    o((u) => ({ ...u, nodes: [...u.nodes, { id: i, pos: r }] })), n([{ type: "node", id: i }]);
  }, [o, n]), C = b((r) => {
    o((i) => ({
      nodes: i.nodes.filter((u) => u.id !== r),
      edges: i.edges.filter((u) => u.from !== r && u.to !== r)
    })), n((i) => i.filter((u) => !(u.type === "node" && u.id === r)));
  }, [o, n]), L = b((r, i) => {
    r !== i && (o((u) => {
      const y = u.edges.some((g) => g.to === r) ? "auto" : 10;
      return { ...u, edges: [...u.edges, { from: r, to: i, weight: y }] };
    }), n([{ type: "edge", from: r, to: i }]));
  }, [o, n]), v = b((r, i, u) => {
    o((a) => ({
      ...a,
      edges: a.edges.map((y) => y.from === r && y.to === i ? { ...y, ...u } : y)
    }));
  }, [o]), w = b((r, i, u) => {
    o((a) => ({
      ...a,
      edges: a.edges.map((y) => y.from === r && y.to === i ? { ...y, style: { ...y.style, ...u } } : y)
    }));
  }, [o]), $ = b((r, i) => {
    o((u) => ({ ...u, edges: u.edges.filter((a) => !(a.from === r && a.to === i)) })), n((u) => u.filter((a) => !(a.type === "edge" && a.from === r && a.to === i)));
  }, [o, n]), l = b((r, i) => {
    o((u) => u.edges.some((a) => a.from === i && a.to === r) ? u : {
      ...u,
      edges: u.edges.map((a) => a.from === r && a.to === i ? { ...a, from: i, to: r } : a)
    }), n([{ type: "edge", from: i, to: r }]);
  }, [o, n]), s = b((r, i, u) => {
    const a = `n${Date.now()}`;
    o((y) => {
      const g = y.edges.find((T) => T.from === r && T.to === i);
      if (!g) return y;
      const k = g.style, j = { id: a, pos: u }, A = { from: r, to: a, weight: g.weight, ...k ? { style: k } : {} }, M = { from: a, to: i, weight: "auto", ...k ? { style: k } : {} };
      return {
        nodes: [...y.nodes, j],
        edges: y.edges.flatMap((T) => T === g ? [A, M] : [T])
      };
    }), n([{ type: "node", id: a }]);
  }, [o, n]), d = b((r) => {
    for (const i of f) w(i.from, i.to, r);
  }, [f, w]), c = b((r) => {
    for (const i of f) v(i.from, i.to, { weight: r });
  }, [f, v]);
  return {
    renameNode: h,
    duplicateNodes: x,
    updateNode: O,
    addNode: m,
    deleteNode: C,
    addEdge: L,
    updateEdge: v,
    updateEdgeStyle: w,
    deleteEdge: $,
    reverseEdge: l,
    splitEdgeAt: s,
    applyEdgeStyle: d,
    applyEdgeWeight: c
  };
}
function He(e, t, o) {
  const [n, f] = I(null), h = te(t.graph);
  h.current = t.graph;
  const x = b((O) => {
    var C;
    const m = (C = O.features) == null ? void 0 : C.filter((L) => {
      var v;
      return ((v = L.layer) == null ? void 0 : v.id) === "node-circles";
    });
    m != null && m.length && f(m[0].properties.id);
  }, []);
  return Y(() => {
    if (!n || !e.current) return;
    const O = e.current.getMap(), m = O.getCanvas();
    m.style.cursor = "grabbing";
    const C = h.current, L = o.selections.filter((c) => c.type === "node").map((c) => c.id), v = L.includes(n) && L.length > 1 ? L : [n], w = /* @__PURE__ */ new Map();
    for (const c of v) {
      const r = C.nodes.find((i) => i.id === c);
      r && w.set(c, [r.pos[0], r.pos[1]]);
    }
    const $ = w.get(n);
    let l = !1;
    const s = (c) => {
      const r = m.getBoundingClientRect(), { lng: i, lat: u } = O.unproject([c.clientX - r.left, c.clientY - r.top]), a = u - $[0], y = i - $[1];
      l || (t.pushHistory(C), l = !0), t.setGraph((g) => ({
        ...g,
        nodes: g.nodes.map((k) => {
          const j = w.get(k.id);
          return j ? { ...k, pos: [j[0] + a, j[1] + y] } : k;
        })
      }));
    }, d = () => {
      f(null), m.style.cursor = "";
    };
    return document.addEventListener("mousemove", s), document.addEventListener("mouseup", d), () => {
      document.removeEventListener("mousemove", s), document.removeEventListener("mouseup", d), m.style.cursor = "";
    };
  }, [n, o.selections, t.setGraph, t.pushHistory, e]), { onDragStart: x, dragging: n, dragPan: !n };
}
function We(e, t, o, n) {
  const [f, h] = I(null), [x, O] = I(null), [m, C] = I(null), L = b((l) => {
    var i, u, a, y;
    const s = (i = l.originalEvent) == null ? void 0 : i.shiftKey, d = (u = l.features) == null ? void 0 : u.filter((g) => {
      var k;
      return ((k = g.layer) == null ? void 0 : k.id) === "node-circles";
    }), c = (a = l.features) == null ? void 0 : a.filter((g) => {
      var k;
      return ((k = g.layer) == null ? void 0 : k.id) === "edge-centerlines-hit";
    }), r = (y = l.features) == null ? void 0 : y.filter((g) => {
      var k;
      return ((k = g.layer) == null ? void 0 : k.id) === "flows-fill";
    });
    if (d != null && d.length) {
      const g = d[0].properties.id;
      if (f) {
        o.addEdge(f, g), h(null);
        return;
      }
      t.toggleOrReplace({ type: "node", id: g }, !!s);
      return;
    }
    if (c != null && c.length) {
      const g = c[0].properties;
      if (g.from && g.to) {
        t.toggleOrReplace({ type: "edge", from: g.from, to: g.to }, !!s);
        return;
      }
    }
    if (r != null && r.length) {
      const g = r[0].properties;
      if (g.from && g.to) {
        t.toggleOrReplace({ type: "edge", from: g.from, to: g.to }, !!s);
        return;
      }
    }
    f && h(null), s || t.setSelections([]);
  }, [f, o.addEdge, t.toggleOrReplace, t.setSelections]), v = b((l) => {
    var d;
    l.preventDefault();
    const s = (d = e.current) == null ? void 0 : d.getMap();
    if (s) {
      const c = s.queryRenderedFeatures([l.point.x, l.point.y], { layers: ["edge-centerlines-hit"] });
      if (c != null && c.length) {
        const r = c[0].properties;
        if (r.from && r.to) {
          o.splitEdgeAt(r.from, r.to, [l.lngLat.lat, l.lngLat.lng]);
          return;
        }
      }
    }
    o.addNode([l.lngLat.lat, l.lngLat.lng]);
  }, [e, o.splitEdgeAt, o.addNode]), w = b((l) => {
    var s, d;
    if (O({ x: l.point.x, y: l.point.y }), (s = l.features) != null && s.length) {
      const c = l.features[0], r = c.properties;
      ((d = c.geometry) == null ? void 0 : d.type) === "Point" ? C(null) : r.bearing != null && C({ x: l.point.x, y: l.point.y, text: `edge #${r.idx} bearing:${r.bearing}°
${r.from} → ${r.to}` });
    } else
      C(null);
  }, []), $ = [
    "node-circles",
    "flows-fill",
    "edge-centerlines-hit",
    ...(n == null ? void 0 : n.extraInteractiveLayers) ?? []
  ];
  return { onClick: L, onDblClick: v, onHover: w, tooltip: m, cursor: x, edgeSource: f, setEdgeSource: h, interactiveLayerIds: $ };
}
const be = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function ue(e) {
  return be.test(e) ? e : JSON.stringify(e);
}
function ve(e) {
  return e.includes("'") && !e.includes('"') ? JSON.stringify(e) : `'${e.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
function Z(e, t) {
  if (e === null) return "null";
  if (typeof e > "u") return "undefined";
  if (typeof e == "string") return ve(e);
  if (typeof e == "number" || typeof e == "boolean") return String(e);
  if (Array.isArray(e)) {
    if (e.length === 0) return "[]";
    if (e.every((n) => n === null || typeof n == "string" || typeof n == "number" || typeof n == "boolean"))
      return `[${e.map((n) => Z(n, t)).join(", ")}]`;
    const o = t + "  ";
    return `[
${e.map((n) => o + Z(n, o)).join(`,
`)},
${t}]`;
  }
  return typeof e == "object" ? xe(e) : JSON.stringify(e);
}
function xe(e) {
  const t = Object.entries(e).filter(([, n]) => n !== void 0);
  return t.length === 0 ? "{}" : `{ ${t.map(([n, f]) => `${ue(n)}: ${Z(f, "")}`).join(", ")} }`;
}
function fe(e, t) {
  const o = Object.entries(e).filter(([, h]) => h !== void 0);
  if (o.length === 0) return "{}";
  const n = t + "  ";
  return `{
${o.map(([h, x]) => `${n}${ue(h)}: ${Z(x, n)},`).join(`
`)}
${t}}`;
}
function Se(e) {
  const t = { id: e.id, pos: e.pos };
  return e.bearing != null && (t.bearing = e.bearing), e.velocity != null && (t.velocity = e.velocity), e.label != null && (t.label = e.label), e.style && (t.style = e.style), t;
}
function we(e) {
  const t = { from: e.from, to: e.to, weight: e.weight };
  return e.style && (t.style = e.style), t;
}
function ne(e) {
  const t = [...e.nodes].sort((n, f) => n.id.localeCompare(f.id)).map(Se), o = [...e.edges].sort((n, f) => {
    const h = n.from.localeCompare(f.from);
    return h !== 0 ? h : n.to.localeCompare(f.to);
  }).map(we);
  return { nodes: t, edges: o };
}
function se(e) {
  const t = { graph: ne(e.graph) };
  if (e.opts) {
    const o = Object.fromEntries(Object.entries(e.opts).filter(([, n]) => n !== void 0));
    Object.keys(o).length && (t.opts = o);
  }
  return e.view && (t.view = e.view), fe(t, "");
}
function Ce(e) {
  return fe(ne(e), "");
}
function ke(e) {
  const t = { graph: ne(e.graph) };
  if (e.opts) {
    const o = Object.fromEntries(Object.entries(e.opts).filter(([, n]) => n !== void 0));
    Object.keys(o).length && (t.opts = o);
  }
  return e.view && (t.view = e.view), JSON.stringify(t, null, 2);
}
function le(e) {
  const o = e.trim().replace(/^(?:export\s+default\s+|export\s+const\s+\w+(?::\s*[\w<>[\],\s|]+)?\s*=\s*|const\s+\w+(?::\s*[\w<>[\],\s|]+)?\s*=\s*)/, "").replace(/;\s*$/, "");
  let n;
  try {
    n = JSON.parse(o);
  } catch {
    n = new Function(`return (${o})`)();
  }
  if (!n || typeof n != "object")
    throw new Error("Parsed value is not an object");
  if (Array.isArray(n.nodes) && Array.isArray(n.edges))
    return { graph: n };
  if (!n.graph || !Array.isArray(n.graph.nodes) || !Array.isArray(n.graph.edges))
    throw new Error("Parsed value is not a Scene (missing graph.nodes / graph.edges)");
  return n;
}
function Fe({
  graph: e,
  opts: t,
  view: o,
  title: n,
  pushGraph: f,
  applyOpts: h,
  setView: x,
  mapRef: O
}) {
  const m = te(null), [C, L] = I(null), [v, w] = I(!1), [$, l] = I(""), [s, d] = I(null), c = b(() => ({
    version: 1,
    graph: e,
    opts: t,
    view: o
  }), [e, t, o]), r = b((S) => {
    L(S), setTimeout(() => L(null), 1800);
  }, []), i = b((S, R, E) => {
    const B = new Blob([S], { type: E }), P = URL.createObjectURL(B), N = document.createElement("a");
    N.href = P, N.download = R, N.click(), URL.revokeObjectURL(P);
  }, []), u = n.toLowerCase().replace(/\s+/g, "-"), a = b(() => {
    i(ke(c()), `${u}.json`, "application/json");
  }, [c, u, i]), y = b(() => {
    const S = `// geo-sankey scene
export default ${se(c())}
`;
    i(S, `${u}.ts`, "text/typescript");
  }, [c, u, i]), g = b(async (S, R) => {
    try {
      await navigator.clipboard.writeText(S), r(R);
    } catch (E) {
      r(`Copy failed: ${E}`);
    }
  }, [r]), k = b(async () => {
    await g(se(c()), "Copied scene as TS literal");
  }, [c, g]), j = b(async () => {
    await g(Ce(e), "Copied graph (paste into source)");
  }, [e, g]), A = b((S) => {
    var J, oe;
    if (!S.nodes.length) return;
    const R = (oe = (J = O.current) == null ? void 0 : J.getMap) == null ? void 0 : oe.call(J);
    if (!R) return;
    let E = 1 / 0, B = -1 / 0, P = 1 / 0, N = -1 / 0;
    for (const H of S.nodes)
      H.pos[0] < E && (E = H.pos[0]), H.pos[0] > B && (B = H.pos[0]), H.pos[1] < P && (P = H.pos[1]), H.pos[1] > N && (N = H.pos[1]);
    if (E === B && P === N) {
      R.easeTo({ center: [P, E], zoom: 13, duration: 400 });
      return;
    }
    R.fitBounds([[P, E], [N, B]], { padding: 80, duration: 400 });
  }, [O]), M = b((S) => {
    f(S.graph), S.opts && h(S.opts), S.view ? x(S.view) : setTimeout(() => A(S.graph), 50);
  }, [f, h, x, A]), T = b((S) => {
    const R = new FileReader();
    R.onload = () => {
      try {
        const E = le(R.result);
        M(E), r(`Loaded ${S.name}`);
      } catch (E) {
        r(`Import failed: ${E instanceof Error ? E.message : E}`);
      }
    }, R.readAsText(S);
  }, [M, r]), G = b(() => {
    d(null);
    let S;
    try {
      S = le($);
    } catch (R) {
      d(R instanceof Error ? R.message : String(R));
      return;
    }
    M(S), w(!1), l(""), r("Pasted scene applied");
  }, [$, M, r]), U = b(() => {
    var S;
    return (S = m.current) == null ? void 0 : S.click();
  }, []), _ = b(() => w(!0), []);
  return { exportSceneJSON: a, exportSceneTS: y, copySceneAsTS: k, copyGraphAsTS: j, openImport: U, openPaste: _, ui: /* @__PURE__ */ z(F, { children: [
    /* @__PURE__ */ p(
      "input",
      {
        ref: m,
        type: "file",
        accept: ".json,.ts",
        style: { display: "none" },
        onChange: (S) => {
          var R;
          (R = S.target.files) != null && R[0] && T(S.target.files[0]), S.target.value = "";
        }
      }
    ),
    C && /* @__PURE__ */ p("div", { style: {
      position: "fixed",
      bottom: 16,
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.85)",
      color: "#fff",
      padding: "8px 14px",
      borderRadius: 6,
      fontSize: 12,
      zIndex: 50
    }, children: C }),
    v && /* @__PURE__ */ p("div", { style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      zIndex: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }, onClick: () => w(!1), children: /* @__PURE__ */ z("div", { onClick: (S) => S.stopPropagation(), style: {
      background: "var(--bg-surface, #1e1e2e)",
      color: "var(--fg, #cdd6f4)",
      border: "1px solid var(--border, #45475a)",
      borderRadius: 8,
      padding: 16,
      width: "min(720px, 90vw)",
      maxHeight: "80vh",
      display: "flex",
      flexDirection: "column",
      gap: 10
    }, children: [
      /* @__PURE__ */ p("div", { style: { fontWeight: 600, fontSize: 14 }, children: "Paste scene (full scene or bare graph)" }),
      /* @__PURE__ */ z("div", { style: { fontSize: 11, opacity: 0.6 }, children: [
        "Accepts JSON or TS literal. Bare ",
        /* @__PURE__ */ p("code", { children: "{ nodes, edges }" }),
        " is wrapped into a scene automatically."
      ] }),
      /* @__PURE__ */ p(
        "textarea",
        {
          autoFocus: !0,
          value: $,
          onChange: (S) => l(S.target.value),
          placeholder: `{ nodes: [...], edges: [...] }

or a full scene:
{ graph: { ... }, opts: { ... }, view: { ... } }`,
          style: {
            flex: 1,
            minHeight: 320,
            fontFamily: "monospace",
            fontSize: 12,
            background: "var(--bg, #11111b)",
            color: "var(--fg, #cdd6f4)",
            border: "1px solid var(--border, #45475a)",
            borderRadius: 4,
            padding: 8,
            resize: "vertical"
          }
        }
      ),
      s && /* @__PURE__ */ p("div", { style: { color: "#ef4444", fontSize: 11 }, children: s }),
      /* @__PURE__ */ z("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" }, children: [
        /* @__PURE__ */ p(
          "button",
          {
            onClick: () => {
              w(!1), l(""), d(null);
            },
            style: { fontSize: 12, padding: "4px 10px" },
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ p(
          "button",
          {
            onClick: G,
            style: { fontSize: 12, padding: "4px 10px", background: "#14B8A6", color: "#000", fontWeight: 600 },
            children: "Load"
          }
        )
      ] })
    ] }) })
  ] }) };
}
const ge = "geo-sankey-drawer";
function ze() {
  try {
    const e = sessionStorage.getItem(ge);
    return e ? JSON.parse(e) : null;
  } catch {
    return null;
  }
}
function ae(e, t) {
  sessionStorage.setItem(ge, JSON.stringify({ collapsed: e, openIds: [...t] }));
}
function Je({ sections: e, side: t = "right", defaultCollapsed: o = !1 }) {
  const n = ze(), [f, h] = I((n == null ? void 0 : n.collapsed) ?? o), [x, O] = I(
    () => n != null && n.openIds ? new Set(n.openIds) : new Set(e.filter((s) => s.defaultOpen !== !1).map((s) => s.id))
  ), m = (s) => {
    h((d) => {
      const c = typeof s == "function" ? s(d) : s;
      return ae(c, x), c;
    });
  }, C = (s) => {
    O((d) => {
      const c = s(d);
      return ae(f, c), c;
    });
  }, [L, v] = I(() => new Set(e.map((s) => s.id)));
  Y(() => {
    const s = e.filter((d) => !L.has(d.id));
    s.length !== 0 && (v((d) => {
      const c = new Set(d);
      for (const r of e) c.add(r.id);
      return c;
    }), C((d) => {
      const c = new Set(d);
      for (const r of s) r.defaultOpen !== !1 && c.add(r.id);
      return c;
    }));
  }, [e, L]);
  const w = (s) => C((d) => {
    const c = new Set(d);
    return c.has(s) ? c.delete(s) : c.add(s), c;
  }), $ = t === "right" ? { right: 8 } : { left: 8 };
  return /* @__PURE__ */ z(F, { children: [
    /* @__PURE__ */ p(
      "button",
      {
        onClick: () => m((s) => !s),
        style: {
          position: "absolute",
          top: 8,
          ...t === "right" ? { right: f ? 8 : 290 } : { left: f ? 8 : 290 },
          zIndex: 22,
          background: "var(--bg-surface, #1e1e2e)",
          color: "var(--fg, #cdd6f4)",
          border: "1px solid var(--border, #45475a)",
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 11,
          cursor: "pointer",
          minWidth: 20
        },
        title: f ? "Show drawer" : "Hide drawer",
        children: f ? t === "right" ? "◀" : "▶" : t === "right" ? "▶" : "◀"
      }
    ),
    !f && /* @__PURE__ */ p(
      "div",
      {
        style: {
          position: "absolute",
          top: 8,
          bottom: 8,
          ...$,
          width: 280,
          background: "var(--bg-surface, #1e1e2e)",
          color: "var(--fg, #cdd6f4)",
          border: "1px solid var(--border, #45475a)",
          borderRadius: 6,
          fontSize: 12,
          zIndex: 20,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column"
        },
        onMouseDown: (s) => s.stopPropagation(),
        onClick: (s) => s.stopPropagation(),
        children: e.map((s) => {
          const d = x.has(s.id);
          return /* @__PURE__ */ z("div", { style: { borderBottom: "1px solid var(--border, #45475a)" }, children: [
            /* @__PURE__ */ z(
              "div",
              {
                onClick: () => w(s.id),
                style: {
                  padding: "6px 10px",
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  cursor: "pointer",
                  userSelect: "none",
                  background: "var(--bg, #11111b)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                },
                children: [
                  /* @__PURE__ */ p("span", { children: s.title }),
                  /* @__PURE__ */ p("span", { style: { opacity: 0.5, fontSize: 10 }, children: d ? "▼" : "▶" })
                ]
              }
            ),
            d && /* @__PURE__ */ p("div", { style: { padding: "8px 10px" }, children: s.children })
          ] }, s.id);
        })
      }
    )
  ] });
}
function D({ label: e, children: t, align: o = "center" }) {
  return /* @__PURE__ */ z("div", { style: {
    display: "flex",
    alignItems: o === "center" ? "center" : "flex-start",
    gap: 6,
    marginBottom: 4
  }, children: [
    /* @__PURE__ */ p("span", { style: { fontSize: 11, opacity: 0.7, minWidth: 60 }, children: e }),
    /* @__PURE__ */ p("div", { style: { flex: 1 }, children: t })
  ] });
}
function $e({
  value: e,
  onChange: t,
  min: o,
  max: n,
  step: f,
  fmt: h
}) {
  return /* @__PURE__ */ z("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
    /* @__PURE__ */ p(
      "input",
      {
        type: "range",
        min: o,
        max: n,
        step: f,
        value: e,
        onChange: (x) => t(parseFloat(x.target.value)),
        style: { flex: 1, minWidth: 0 }
      }
    ),
    /* @__PURE__ */ p("span", { style: { fontSize: 11, minWidth: 30, textAlign: "right" }, children: h ? h(e) : e })
  ] });
}
function Ge({ label: e, checked: t, onChange: o }) {
  return /* @__PURE__ */ z("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", marginBottom: 2 }, children: [
    /* @__PURE__ */ p("input", { type: "checkbox", checked: t, onChange: (n) => o(n.target.checked) }),
    e
  ] });
}
const { round: Oe } = Math;
function q({ value: e, onCommit: t, step: o, style: n, placeholder: f, allowEmpty: h }) {
  const [x, O] = I(e == null ? "" : String(e)), [m, C] = I(!1);
  Y(() => {
    m || O(e == null ? "" : String(e));
  }, [e, m]);
  const L = () => {
    if (x === "") {
      h && t(void 0);
      return;
    }
    const v = parseFloat(x);
    !Number.isNaN(v) && v !== e && t(v);
  };
  return /* @__PURE__ */ p(
    "input",
    {
      style: n,
      type: "number",
      step: o,
      placeholder: f,
      value: x,
      onFocus: () => C(!0),
      onBlur: () => {
        C(!1), L();
      },
      onChange: (v) => O(v.target.value),
      onKeyDown: (v) => {
        v.key === "Enter" ? v.target.blur() : v.key === "Escape" && (O(e == null ? "" : String(e)), v.target.blur());
      }
    }
  );
}
const W = {
  width: "100%",
  fontSize: 12,
  background: "var(--bg, #11111b)",
  color: "var(--fg, #cdd6f4)",
  border: "1px solid var(--border, #45475a)",
  borderRadius: 4,
  padding: "2px 6px"
}, ce = {
  fontSize: 11,
  background: "var(--bg, #11111b)",
  color: "var(--fg, #cdd6f4)",
  border: "1px solid var(--border, #45475a)",
  borderRadius: 4,
  padding: "2px 4px",
  maxWidth: 120
};
function Ue({
  graph: e,
  selectedNodes: t,
  selectedEdges: o,
  resolvedWeights: n,
  singlePoly: f,
  nodeRoleOf: h,
  aggEdge: x,
  updateNode: O,
  renameNode: m,
  deleteNode: C,
  addEdge: L,
  deleteEdge: v,
  reverseEdge: w,
  setEdgeSource: $,
  setSelections: l,
  applyEdgeStyle: s,
  applyEdgeWeight: d
}) {
  const c = t.length === 1 && o.length === 0 ? t[0] : null, r = t.length === 2 && o.length === 0 ? [t[0], t[1]] : null, i = (y, g) => e.edges.some((k) => k.from === y && k.to === g), u = x("color", !0), a = x("opacity", !0);
  return /* @__PURE__ */ z(F, { children: [
    /* @__PURE__ */ z("div", { style: { fontSize: 10, opacity: 0.6, marginBottom: 6 }, children: [
      t.length > 0 && /* @__PURE__ */ z("span", { children: [
        t.length,
        " node",
        t.length === 1 ? "" : "s"
      ] }),
      t.length > 0 && o.length > 0 && /* @__PURE__ */ p("span", { children: " · " }),
      o.length > 0 && /* @__PURE__ */ z("span", { children: [
        o.length,
        " edge",
        o.length === 1 ? "" : "s"
      ] })
    ] }),
    c && /* @__PURE__ */ p(
      Le,
      {
        graph: e,
        node: c,
        nodeRoleOf: h,
        updateNode: O,
        renameNode: m,
        deleteNode: C,
        addEdge: L,
        setEdgeSource: $,
        setSelections: l
      }
    ),
    r && /* @__PURE__ */ p(
      Ae,
      {
        a: r[0],
        b: r[1],
        edgeExists: i,
        addEdge: L
      }
    ),
    o.length > 0 && /* @__PURE__ */ p(
      Re,
      {
        graph: e,
        selectedEdges: o,
        selectedNodesLen: t.length,
        resolvedWeights: n,
        singlePoly: f,
        color: u,
        opacityVal: a,
        addSpacer: !!c,
        applyEdgeStyle: s,
        applyEdgeWeight: d,
        reverseEdge: w,
        deleteEdge: v
      }
    )
  ] });
}
function Le({
  graph: e,
  node: t,
  nodeRoleOf: o,
  updateNode: n,
  renameNode: f,
  deleteNode: h,
  addEdge: x,
  setEdgeSource: O,
  setSelections: m
}) {
  const C = e.nodes.filter((l) => l.id !== t.id).map((l) => l.id), L = new Set(e.edges.filter((l) => l.from === t.id).map((l) => l.to)), v = new Set(e.edges.filter((l) => l.to === t.id).map((l) => l.from)), w = C.filter((l) => !L.has(l)), $ = C.filter((l) => !v.has(l));
  return /* @__PURE__ */ z(F, { children: [
    /* @__PURE__ */ p(D, { label: "Role", children: /* @__PURE__ */ p("span", { style: { fontSize: 11, opacity: 0.7, fontFamily: "monospace" }, children: o(t.id) }) }),
    /* @__PURE__ */ p(D, { label: "ID", children: /* @__PURE__ */ p(
      "input",
      {
        style: W,
        defaultValue: t.id,
        onBlur: (l) => {
          const s = l.target.value.trim();
          s && s !== t.id && f(t.id, s);
        },
        onKeyDown: (l) => {
          l.key === "Enter" && l.target.blur();
        }
      },
      t.id
    ) }),
    /* @__PURE__ */ p(D, { label: "Label", children: /* @__PURE__ */ p(
      "input",
      {
        style: W,
        value: t.label ?? "",
        onChange: (l) => n(t.id, { label: l.target.value || void 0 })
      }
    ) }),
    /* @__PURE__ */ p(D, { label: "Lat", children: /* @__PURE__ */ p(
      q,
      {
        style: W,
        step: "0.0001",
        value: t.pos[0],
        onCommit: (l) => {
          l != null && n(t.id, { pos: [l, t.pos[1]] });
        }
      }
    ) }),
    /* @__PURE__ */ p(D, { label: "Lon", children: /* @__PURE__ */ p(
      q,
      {
        style: W,
        step: "0.0001",
        value: t.pos[1],
        onCommit: (l) => {
          l != null && n(t.id, { pos: [t.pos[0], l] });
        }
      }
    ) }),
    /* @__PURE__ */ p(D, { label: "Bearing", children: /* @__PURE__ */ p(
      q,
      {
        style: W,
        step: "1",
        value: Oe(t.bearing ?? 90),
        onCommit: (l) => {
          l != null && n(t.id, { bearing: l });
        }
      }
    ) }),
    /* @__PURE__ */ p(D, { label: "Velocity", children: /* @__PURE__ */ z("div", { style: { display: "flex", gap: 4, width: "100%" }, children: [
      /* @__PURE__ */ p(
        q,
        {
          style: { ...W, flex: 1 },
          step: "0.0001",
          placeholder: "auto",
          allowEmpty: !0,
          value: t.velocity,
          onCommit: (l) => n(t.id, { velocity: l })
        }
      ),
      /* @__PURE__ */ p(
        "button",
        {
          onClick: () => n(t.id, { velocity: void 0 }),
          title: "Reset to auto",
          style: { fontSize: 10, padding: "0 6px" },
          children: "×"
        }
      )
    ] }) }),
    /* @__PURE__ */ p(D, { label: "Out →", children: /* @__PURE__ */ z("div", { style: { display: "flex", gap: 4, width: "100%" }, children: [
      /* @__PURE__ */ z(
        "select",
        {
          value: "",
          onChange: (l) => {
            l.target.value && x(t.id, l.target.value);
          },
          disabled: w.length === 0,
          style: ce,
          children: [
            /* @__PURE__ */ p("option", { value: "", children: w.length === 0 ? "no targets" : "Pick…" }),
            w.map((l) => /* @__PURE__ */ p("option", { value: l, children: l }, l))
          ]
        }
      ),
      /* @__PURE__ */ p("button", { onClick: () => {
        O(t.id), m([]);
      }, title: "Pick on map", style: { fontSize: 11 }, children: "map" })
    ] }) }),
    /* @__PURE__ */ p(D, { label: "← In", children: /* @__PURE__ */ p("div", { style: { display: "flex", gap: 4, width: "100%" }, children: /* @__PURE__ */ z(
      "select",
      {
        value: "",
        onChange: (l) => {
          l.target.value && x(l.target.value, t.id);
        },
        disabled: $.length === 0,
        style: ce,
        children: [
          /* @__PURE__ */ p("option", { value: "", children: $.length === 0 ? "no sources" : "Pick…" }),
          $.map((l) => /* @__PURE__ */ p("option", { value: l, children: l }, l))
        ]
      }
    ) }) }),
    /* @__PURE__ */ p("div", { style: { display: "flex", gap: 4, marginTop: 6 }, children: /* @__PURE__ */ p("button", { onClick: () => h(t.id), style: { fontSize: 11, color: "#ef4444" }, children: "Delete" }) })
  ] });
}
function Ae({
  a: e,
  b: t,
  edgeExists: o,
  addEdge: n
}) {
  const f = o(e.id, t.id), h = o(t.id, e.id);
  return /* @__PURE__ */ z(F, { children: [
    /* @__PURE__ */ p(D, { label: "A", children: /* @__PURE__ */ z("span", { style: { fontSize: 11, opacity: 0.7 }, children: [
      e.id,
      e.label ? ` (${e.label})` : ""
    ] }) }),
    /* @__PURE__ */ p(D, { label: "B", children: /* @__PURE__ */ z("span", { style: { fontSize: 11, opacity: 0.7 }, children: [
      t.id,
      t.label ? ` (${t.label})` : ""
    ] }) }),
    /* @__PURE__ */ z("div", { style: { display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ z(
        "button",
        {
          disabled: f,
          title: f ? "Edge already exists" : "",
          onClick: () => n(e.id, t.id),
          style: { fontSize: 11, opacity: f ? 0.4 : 1 },
          children: [
            e.id,
            " → ",
            t.id
          ]
        }
      ),
      /* @__PURE__ */ z(
        "button",
        {
          disabled: h,
          title: h ? "Edge already exists" : "",
          onClick: () => n(t.id, e.id),
          style: { fontSize: 11, opacity: h ? 0.4 : 1 },
          children: [
            t.id,
            " → ",
            e.id
          ]
        }
      )
    ] })
  ] });
}
function Re({
  graph: e,
  selectedEdges: t,
  selectedNodesLen: o,
  resolvedWeights: n,
  singlePoly: f,
  color: h,
  opacityVal: x,
  addSpacer: O,
  applyEdgeStyle: m,
  applyEdgeWeight: C,
  reverseEdge: L,
  deleteEdge: v
}) {
  const w = t.every((i) => i.weight === "auto"), $ = t.filter((i) => typeof i.weight == "number").map((i) => i.weight), l = $.length === t.length && $.every((i) => i === $[0]) ? $[0] : void 0, s = w && t.length === 1 ? +(n.get(`${t[0].from}→${t[0].to}`) ?? 0).toFixed(2) : void 0, d = l ?? s ?? "", c = l === void 0 && s === void 0 ? w ? "auto" : "Mixed" : "", r = {
    ...W,
    flex: 1,
    ...s !== void 0 ? { color: "#a78bfa", fontStyle: "italic" } : {}
  };
  return /* @__PURE__ */ z(F, { children: [
    O && /* @__PURE__ */ p("div", { style: { height: 8 } }),
    /* @__PURE__ */ p(D, { label: "Weight", children: /* @__PURE__ */ z("div", { style: { display: "flex", gap: 4, width: "100%" }, children: [
      /* @__PURE__ */ p(
        "input",
        {
          type: "number",
          value: d,
          placeholder: c,
          onChange: (i) => C(i.target.value === "" ? "auto" : parseFloat(i.target.value) || 0),
          style: r,
          title: s !== void 0 ? "derived from upstream — type to override" : ""
        }
      ),
      /* @__PURE__ */ p(
        "button",
        {
          onClick: () => C("auto"),
          title: "Auto = sum of inputs",
          style: { fontSize: 10, padding: "0 6px", opacity: w ? 0.4 : 1 },
          children: "auto"
        }
      )
    ] }) }),
    !f && /* @__PURE__ */ z(F, { children: [
      /* @__PURE__ */ p(D, { label: "Color", children: /* @__PURE__ */ z("div", { style: { display: "flex", gap: 4 }, children: [
        /* @__PURE__ */ p(
          "input",
          {
            type: "color",
            value: h ?? "#888888",
            onChange: (i) => m({ color: i.target.value }),
            style: { width: 32, height: 24, padding: 0, border: "1px solid var(--border, #45475a)", borderRadius: 4, background: "transparent" }
          }
        ),
        /* @__PURE__ */ p(
          "input",
          {
            type: "text",
            value: h ?? "",
            placeholder: h === void 0 ? "Mixed" : "",
            onChange: (i) => m({ color: i.target.value }),
            style: { ...W, flex: 1, fontSize: 11 }
          }
        ),
        /* @__PURE__ */ p(
          "button",
          {
            onClick: () => m({ color: void 0 }),
            title: "Clear (use page default)",
            style: { fontSize: 10, padding: "0 6px" },
            children: "×"
          }
        )
      ] }) }),
      /* @__PURE__ */ p(D, { label: "Opacity", children: /* @__PURE__ */ p(
        $e,
        {
          value: x ?? 1,
          onChange: (i) => m({ opacity: i }),
          min: 0,
          max: 1,
          step: 0.05,
          fmt: (i) => x === void 0 ? "Mix" : i.toFixed(2)
        }
      ) })
    ] }),
    f && /* @__PURE__ */ z("div", { style: { fontSize: 10, opacity: 0.5, marginTop: 4 }, children: [
      "Per-edge color & opacity require ",
      /* @__PURE__ */ p("strong", { children: "single-poly off" }),
      "."
    ] }),
    t.length === 1 && o === 0 && (() => {
      const i = t[0], u = e.edges.some((a) => a.from === i.to && a.to === i.from);
      return /* @__PURE__ */ z("div", { style: { display: "flex", gap: 4, marginTop: 8 }, children: [
        /* @__PURE__ */ p(
          "button",
          {
            onClick: () => L(i.from, i.to),
            disabled: u,
            title: u ? `${i.to}→${i.from} already exists` : `Flip to ${i.to}→${i.from}`,
            style: { fontSize: 11, opacity: u ? 0.4 : 1 },
            children: "↔ Reverse"
          }
        ),
        /* @__PURE__ */ p("button", { onClick: () => v(i.from, i.to), style: { fontSize: 11, color: "#ef4444" }, children: "Delete" })
      ] });
    })()
  ] });
}
const { atan2: Ee, cos: Q, sin: ee, PI: V, round: de, sqrt: Ie, max: je } = Math, pe = 60;
function _e({ bearing: e, pos: t, velocity: o, refLat: n, mapRef: f, onBeginDrag: h, onDragTransient: x, onResetVelocity: O }) {
  var u;
  const [m, C] = I(null), [L, v] = I(!1), w = b(() => {
    var g;
    const a = (g = f.current) == null ? void 0 : g.getMap();
    if (!a) return null;
    const y = a.project([t[1], t[0]]);
    return { x: y.x, y: y.y };
  }, [f, t]);
  Y(() => {
    var g;
    const a = (g = f.current) == null ? void 0 : g.getMap();
    if (!a) {
      const k = setTimeout(() => C(w()), 500);
      return () => clearTimeout(k);
    }
    const y = () => C(w());
    return y(), a.on("move", y), a.on("zoom", y), () => {
      a.off("move", y), a.off("zoom", y);
    };
  }, [w, f]);
  const $ = te({ onBeginDrag: h, onDragTransient: x, project: w });
  if ($.current = { onBeginDrag: h, onDragTransient: x, project: w }, Y(() => {
    var M;
    if (!L) return;
    const a = (M = f.current) == null ? void 0 : M.getMap();
    if (!a) return;
    const y = a.getCanvas(), g = re(n);
    let k = !1;
    const j = (T) => {
      const G = y.getBoundingClientRect(), U = $.current.project();
      if (!U) return;
      const _ = T.clientX - G.left - U.x, X = T.clientY - G.top - U.y;
      if (Ie(_ * _ + X * X) < 2) return;
      let R = (Ee(_, -X) * 180 / V + 360) % 360;
      T.shiftKey && (R = Math.round(R / 15) * 15 % 360);
      const E = a.unproject([T.clientX - G.left, T.clientY - G.top]), B = R * V / 180, P = (E.lat - t[0]) * g, N = E.lng - t[1], J = je(P * Q(B) + N * ee(B), 0);
      k || ($.current.onBeginDrag(), k = !0), $.current.onDragTransient(de(R), J > 0 ? J : void 0);
    }, A = () => v(!1);
    return document.addEventListener("mousemove", j), document.addEventListener("mouseup", A), () => {
      document.removeEventListener("mousemove", j), document.removeEventListener("mouseup", A);
    };
  }, [L, f, n, t]), !m) return null;
  const l = (e - 90) * V / 180;
  let s = m.x + pe * Q(l), d = m.y + pe * ee(l), c = !1;
  if (o != null && o > 0) {
    const a = re(n), y = e * V / 180, g = t[0] + Q(y) * o / a, k = t[1] + ee(y) * o, j = (u = f.current) == null ? void 0 : u.getMap();
    if (j) {
      const A = j.project([k, g]);
      s = A.x, d = A.y, c = !0;
    }
  }
  const r = 2 * m.x - s, i = 2 * m.y - d;
  return /* @__PURE__ */ z(F, { children: [
    /* @__PURE__ */ p("svg", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 25 }, children: /* @__PURE__ */ p(
      "line",
      {
        x1: r,
        y1: i,
        x2: s,
        y2: d,
        stroke: c ? "#14B8A6" : "#14B8A688",
        strokeWidth: 1.5,
        strokeDasharray: "4 2"
      }
    ) }),
    /* @__PURE__ */ p(
      "div",
      {
        style: {
          position: "absolute",
          left: s - 7,
          top: d - 7,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#14B8A6",
          border: "1.5px solid #fff",
          cursor: "grab",
          zIndex: 26
        },
        onMouseDown: (a) => {
          a.stopPropagation(), a.preventDefault(), v(!0);
        },
        onDoubleClick: (a) => {
          a.stopPropagation(), O();
        },
        title: "Drag to set bearing + curve tightness (Shift: snap 15°, dbl-click: reset velocity)"
      }
    ),
    /* @__PURE__ */ p(
      "div",
      {
        style: {
          position: "absolute",
          left: r - 5,
          top: i - 5,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "transparent",
          border: "1.5px solid #14B8A6",
          opacity: 0.5,
          zIndex: 26,
          pointerEvents: "none"
        }
      }
    ),
    /* @__PURE__ */ z("div", { style: { position: "absolute", left: s + 10, top: d - 6, fontSize: 10, color: "#14B8A6", pointerEvents: "none", zIndex: 26 }, children: [
      de(e),
      "°"
    ] })
  ] });
}
export {
  Ge as Check,
  Je as Drawer,
  _e as NodeOverlay,
  D as Row,
  Ue as SelectionSection,
  $e as Slider,
  Ce as graphToTS,
  le as parseScene,
  ke as sceneToJSON,
  se as sceneToTS,
  ie as selRefEq,
  Be as useGraphMutations,
  Me as useGraphSelection,
  Ne as useGraphState,
  We as useMapInteraction,
  He as useNodeDrag,
  Fe as useSceneIO
};
