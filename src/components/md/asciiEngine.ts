/* Halftone ASCII renderer for real PDB structures.
 * 3Dmol.js draws the structure into a small hidden WebGL canvas; each frame is
 * sampled and mapped to glyphs " ·:+▪■". Colour channels are used as data and
 * never shown: chain classes go to R / G / R+G and the ligand to B, so lighting
 * gives brightness and the channel ratio gives the class. The output colours
 * come from the --md-glyph-* tokens of the element it is mounted in.
 */

export type AsciiFocus = "whole" | "pocket";

export interface AsciiOptions {
  pdbUrl: string;
  ligandResn?: string;
  focus?: AsciiFocus;
  zoom?: number;
  cols?: number;
  rows?: number;
  cell?: number;
  autoSpin?: boolean;
  label?: string;
  onReady?: () => void;
  onFallback?: () => void;
}

export interface AsciiHandle {
  destroy(): void;
  refreshTheme(): void;
  setAutoSpin(on: boolean): void;
}

const GLYPHS = [" ", "·", ":", "+", "▪", "■"];
const CHAIN_KEYS = ["#ff0000", "#00ff00", "#ffff00", "#ff0000"];
const pdbCache = new Map<string, Promise<string>>();

function fetchPdb(url: string) {
  if (!pdbCache.has(url)) {
    pdbCache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error("PDB " + r.status);
      return r.text();
    }));
  }
  return pdbCache.get(url)!;
}

export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function classify(r: number, g: number, b: number): [number, number] {
  const m = Math.max(r, g, b);
  if (m < 10) return [0, -1];
  if (b > r && b > g) return [m / 255, 3]; // ligand
  if (r > g * 1.6) return [m / 255, 0]; // chain class A
  if (g > r * 1.6) return [m / 255, 1]; // chain class B
  return [m / 255, 2]; // chain class C / pocket residues
}

export function mountAscii(el: HTMLElement, opts: AsciiOptions): AsciiHandle {
  const o = { focus: "whole" as AsciiFocus, zoom: 1, cols: 140, rows: 140, cell: 4, autoSpin: true, ...opts };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = o.cols * o.cell;
  const H = o.rows * o.cell;
  let destroyed = false;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:absolute;left:0;top:0;width:${o.cols}px;height:${o.rows}px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden`;
  const out = document.createElement("canvas");
  out.width = W * dpr;
  out.height = H * dpr;
  out.className = "md-ascii-canvas";
  out.tabIndex = 0;
  out.setAttribute("role", "img");
  out.setAttribute("aria-label", `${o.label || "Molecular structure"}. Drag or use arrow keys to rotate, plus and minus to zoom.`);
  el.appendChild(out);
  el.appendChild(host);
  const octx = out.getContext("2d")!;
  const sample = document.createElement("canvas");
  sample.width = o.cols;
  sample.height = o.rows;
  const sctx = sample.getContext("2d", { willReadFrequently: true })!;

  const cellPx = o.cell * dpr;
  let atlas: HTMLCanvasElement;
  let gamma = 0.6;
  let minGlyph = 1;
  let fadeAlpha: number[] = GLYPHS.map(() => 1);
  function buildAtlas() {
    const cs = getComputedStyle(el);
    const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    // tone rows: pocket / chain A / chain B / ligand
    const tones = [v("--md-glyph-lo", "#84cc16"), v("--md-glyph-mid", "#65a30d"), v("--md-glyph-hi", "#3f6212"), v("--md-glyph-lig", "#1d4ed8")];
    gamma = parseFloat(v("--md-glyph-gamma", "0.6")) || 0.6;
    const fade = parseFloat(v("--md-glyph-fade", "0")) || 0;
    minGlyph = Math.min(5, Math.max(1, parseInt(v("--md-glyph-min", "1"), 10) || 1));
    atlas = document.createElement("canvas");
    atlas.width = cellPx * GLYPHS.length;
    atlas.height = cellPx * tones.length;
    const a = atlas.getContext("2d")!;
    a.textAlign = "center";
    a.textBaseline = "middle";
    const scale = parseFloat(v("--md-glyph-scale", "1.05")) || 1.05;
    a.font = `${v("--md-glyph-weight", "400")} ${Math.round(cellPx * scale)}px 'IBM Plex Mono', ui-monospace, monospace`;
    tones.forEach((t, ti) => {
      a.fillStyle = t;
      GLYPHS.forEach((g, gi) => {
        if (gi) a.fillText(g, gi * cellPx + cellPx / 2, ti * cellPx + cellPx * 0.55);
      });
    });
    // dimmer shaded cells give the far side depth
    fadeAlpha = GLYPHS.map((_, gi) => 1 - fade * (1 - Math.max(0, gi - 1) / (GLYPHS.length - 2)));
  }
  buildAtlas();

   
  let viewer: any = null;
  let visible = false;
  let raf = 0;
  let last = 0;
  let dirty = true;
  let revealT0 = 0;
  let pointer: { x: number; y: number } | null = null;
  let drag: { x: number; y: number } | null = null;
  let pinch: number | null = null;
  const pointers: Record<number, { x: number; y: number }> = {};
  let data: Uint8ClampedArray | null = null;

  function draw(k: number) {
    if (!data) return;
    octx.clearRect(0, 0, out.width, out.height);
    const px = pointer ? pointer.x : -1e9;
    const py = pointer ? pointer.y : -1e9;
    const R = 22;
    for (let y = 0; y < o.rows; y++) {
      for (let x = 0; x < o.cols; x++) {
        const i = (y * o.cols + x) * 4;
        let [v, cls] = classify(data[i], data[i + 1], data[i + 2]);
        if (k < 1 && Math.random() > k && Math.random() < 0.35) {
          v = Math.random();
          cls = (Math.random() * 3) | 0; // resolve from noise
        }
        if (cls < 0) continue;
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) v += 0.45 * (1 - Math.sqrt(d2) / R);
        const tone = cls === 3 ? 3 : cls === 0 ? 1 : cls === 1 ? 2 : 0;
        if (cls === 3) v = Math.max(v, 0.85);
        const t = Math.pow(Math.min(v, 1), gamma);
        const gi = Math.min(5, Math.max(minGlyph, Math.round(t * 5)));
        // fade by shading, not glyph size, so a raised minimum keeps the depth cue
        const fi = Math.min(5, Math.max(1, Math.round(t * 5)));
        octx.globalAlpha = fadeAlpha[fi];
        octx.drawImage(atlas, gi * cellPx, tone * cellPx, cellPx, cellPx, x * cellPx, y * cellPx, cellPx, cellPx);
      }
    }
    octx.globalAlpha = 1;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!visible || !viewer) return;
    if (now - last < 33) return; // ~30 fps cap
    last = now;
    if (o.autoSpin && !reduce.matches && !drag && pinch === null) {
      viewer.rotate(0.35, "y");
      dirty = true;
    }
    const revealing = revealT0 > 0 && now - revealT0 < 700 && !reduce.matches;
    if (!dirty && !revealing && !pointer) return;
    if (dirty) {
      viewer.render();
      sctx.clearRect(0, 0, o.cols, o.rows);
      sctx.drawImage(viewer.getCanvas(), 0, 0, o.cols, o.rows);
      data = sctx.getImageData(0, 0, o.cols, o.rows).data;
      dirty = false;
    }
    draw(revealing ? (now - revealT0) / 700 : 1);
  }

  async function start() {
    if (viewer || destroyed) return;
    if (!hasWebGL()) return o.onFallback?.();
    try {
      const [mod, pdb] = await Promise.all([import("3dmol"), fetchPdb(o.pdbUrl)]);
      if (destroyed) return;
       
      const $3Dmol: any = (mod as any).createViewer ? mod : (mod as any).default;
      viewer = $3Dmol.createViewer(host, { backgroundColor: "black", antialias: true });
      const m = viewer.addModel(pdb, "pdb");
      const chains = Array.from(
         
        new Set(m.selectedAtoms({}).filter((a: any) => !a.hetflag).map((a: any) => a.chain)),
      ) as string[];
      chains.forEach((ch, i) => {
        viewer.setStyle({ chain: ch, hetflag: false }, { cartoon: { color: CHAIN_KEYS[i % 4], thickness: 0.6 } });
      });
      // hide waters, ions and other hetero groups; only the ligand(s) are drawn
      viewer.setStyle({ hetflag: true }, {});
      // "TES+NAP" highlights several ligands
      const ligs = (o.ligandResn || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
      if (ligs.length) {
        const lig = { resn: ligs.length > 1 ? ligs : ligs[0] };
        viewer.setStyle(lig, { stick: { color: "#0000ff", radius: 0.32 }, sphere: { color: "#0000ff", scale: 0.36 } });
        if (o.focus === "pocket") {
          viewer.setStyle(
            { within: { distance: 4.5, sel: lig }, byres: true, hetflag: false },
            { cartoon: { color: "#ffff00" }, stick: { color: "#ffff00", radius: 0.16 } },
          );
          viewer.zoomTo(lig);
        } else viewer.zoomTo();
      } else viewer.zoomTo();
      viewer.zoom(o.zoom);
      viewer.render();
      dirty = true;
      revealT0 = performance.now();
      o.onReady?.();
    } catch {
      o.onFallback?.();
    }
  }

  const io = new IntersectionObserver(
    (es) => {
      visible = es[0].isIntersecting;
      if (visible) {
        start();
        if (viewer) revealT0 = performance.now();
        dirty = true;
      }
    },
    { rootMargin: "100px" },
  );
  io.observe(el);
  raf = requestAnimationFrame(frame);

  const toCell = (e: PointerEvent) => {
    const r = out.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * o.cols, y: ((e.clientY - r.top) / r.height) * o.rows };
  };
  const onMove = (e: PointerEvent) => {
    pointer = reduce.matches ? null : toCell(e);
    if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ids = Object.keys(pointers);
    if (pinch !== null && ids.length === 2 && viewer) {
      const a = pointers[+ids[0]];
      const b = pointers[+ids[1]];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      viewer.zoom(Math.max(0.8, Math.min(1.25, d / pinch)));
      pinch = d;
      dirty = true;
    } else if (drag && viewer) {
      viewer.rotate((e.clientX - drag.x) * 0.5, "y");
      viewer.rotate((e.clientY - drag.y) * 0.5, "x");
      drag = { x: e.clientX, y: e.clientY };
      dirty = true;
    }
  };
  const onDown = (e: PointerEvent) => {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ids = Object.keys(pointers);
    if (ids.length === 2) {
      const a = pointers[+ids[0]];
      const b = pointers[+ids[1]];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
      drag = null;
    } else {
      drag = { x: e.clientX, y: e.clientY };
      out.dataset.dragging = "true";
    }
    out.setPointerCapture(e.pointerId);
  };
  const onUp = (e: PointerEvent) => {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    if (!Object.keys(pointers).length) {
      drag = null;
      delete out.dataset.dragging;
    }
  };
  const onLeave = () => {
    pointer = null;
    dirty = true;
  };
  // Zoom only with Ctrl/⌘ held so the page keeps scrolling over the molecule.
  const onWheel = (e: WheelEvent) => {
    if (!viewer || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    viewer.zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08);
    dirty = true;
  };
  const onKey = (e: KeyboardEvent) => {
    if (!viewer) return;
    const map: Record<string, [number, string]> = {
      ArrowLeft: [-10, "y"], ArrowRight: [10, "y"], ArrowUp: [-10, "x"], ArrowDown: [10, "x"],
    };
    if (map[e.key]) viewer.rotate(map[e.key][0], map[e.key][1]);
    else if (e.key === "+" || e.key === "=") viewer.zoom(1.15);
    else if (e.key === "-") viewer.zoom(1 / 1.15);
    else return;
    e.preventDefault();
    dirty = true;
  };
  out.addEventListener("pointermove", onMove);
  out.addEventListener("pointerdown", onDown);
  out.addEventListener("pointerup", onUp);
  out.addEventListener("pointercancel", onUp);
  out.addEventListener("pointerleave", onLeave);
  out.addEventListener("wheel", onWheel, { passive: false });
  out.addEventListener("keydown", onKey);

  return {
    setAutoSpin(on) {
      o.autoSpin = on;
    },
    refreshTheme() {
      buildAtlas();
      dirty = true;
      if (data && reduce.matches) draw(1);
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      try {
        viewer?.clear?.();
        viewer?.getCanvas?.()?.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        /* ignore */
      }
      out.remove();
      host.remove();
    },
  };
}
