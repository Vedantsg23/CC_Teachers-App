/**
 * Minimal HarfBuzz wrapper (shaping + glyph outlines) for Marathi PDF output.
 *
 * Browsers shape Devanagari with HarfBuzz; we use the very same engine
 * (compiled to WebAssembly, MIT licensed — https://github.com/harfbuzz/harfbuzzjs)
 * so conjuncts, reph, matra re-ordering and Marathi letter forms (locl)
 * come out exactly as on screen. The wasm file is loaded lazily the first
 * time a PDF is made, and the service worker precaches it for offline use.
 */
import wasmUrl from 'harfbuzzjs/dist/harfbuzz.wasm?url';

// Emscripten module surface we rely on.
interface HbModule {
  wasmExports: Record<string, (...args: number[]) => number>;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAP32: Int32Array;
  addFunction: (fn: (...args: number[]) => void, sig: string) => number;
}

export interface ShapedGlyph {
  gid: number;
  cluster: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}

export type PathCmd =
  | { t: 'M' | 'L'; x: number; y: number }
  | { t: 'Q'; cx: number; cy: number; x: number; y: number }
  | { t: 'C'; c1x: number; c1y: number; c2x: number; c2y: number; x: number; y: number }
  | { t: 'Z' };

export interface HbFont {
  key: string;
  upem: number;
  shape(text: string, lang?: string): ShapedGlyph[];
  glyphPath(gid: number): PathCmd[];
  /** Advance width of a run in font units. */
  measure(text: string, lang?: string): number;
}

let modPromise: Promise<HbModule> | null = null;

async function loadModule(): Promise<HbModule> {
  const { default: createHarfBuzz } = await import('hb-emscripten');
  const mod = (await createHarfBuzz({
    locateFile: () => new URL(wasmUrl, document.baseURI).href,
  })) as unknown as HbModule;
  return mod;
}

function getModule(): Promise<HbModule> {
  if (!modPromise) {
    modPromise = loadModule().catch((e) => {
      modPromise = null;
      throw e;
    });
  }
  return modPromise;
}

// Draw-callback plumbing: one shared set of callbacks writing into `sink`.
let sink: PathCmd[] = [];
let drawFuncsPtr = 0;

function ensureDrawFuncs(m: HbModule) {
  if (drawFuncsPtr) return drawFuncsPtr;
  const e = m.wasmExports;
  const ptr = e.hb_draw_funcs_create();
  const moveTo = m.addFunction((_df, _dd, _ds, x, y) => {
    sink.push({ t: 'M', x, y });
  }, 'viiiffi');
  const lineTo = m.addFunction((_df, _dd, _ds, x, y) => {
    sink.push({ t: 'L', x, y });
  }, 'viiiffi');
  const quadTo = m.addFunction((_df, _dd, _ds, cx, cy, x, y) => {
    sink.push({ t: 'Q', cx, cy, x, y });
  }, 'viiiffffi');
  const cubicTo = m.addFunction((_df, _dd, _ds, c1x, c1y, c2x, c2y, x, y) => {
    sink.push({ t: 'C', c1x, c1y, c2x, c2y, x, y });
  }, 'viiiffffffi');
  const close = m.addFunction(() => {
    sink.push({ t: 'Z' });
  }, 'viiii');
  e.hb_draw_funcs_set_move_to_func(ptr, moveTo, 0, 0);
  e.hb_draw_funcs_set_line_to_func(ptr, lineTo, 0, 0);
  e.hb_draw_funcs_set_quadratic_to_func(ptr, quadTo, 0, 0);
  e.hb_draw_funcs_set_cubic_to_func(ptr, cubicTo, 0, 0);
  e.hb_draw_funcs_set_close_path_func(ptr, close, 0, 0);
  drawFuncsPtr = ptr;
  return ptr;
}

function asciiPtr(m: HbModule, s: string) {
  const e = m.wasmExports;
  const ptr = e.malloc(s.length + 1);
  for (let i = 0; i < s.length; i++) m.HEAPU8[ptr + i] = s.charCodeAt(i) & 0x7f;
  m.HEAPU8[ptr + s.length] = 0;
  return ptr;
}

const langCache = new Map<string, number>();
function language(m: HbModule, lang: string) {
  let l = langCache.get(lang);
  if (l === undefined) {
    const p = asciiPtr(m, lang);
    l = m.wasmExports.hb_language_from_string(p, -1);
    m.wasmExports.free(p);
    langCache.set(lang, l);
  }
  return l;
}

function makeFont(m: HbModule, key: string, bytes: ArrayBuffer): HbFont {
  const e = m.wasmExports;
  const data = new Uint8Array(bytes);
  const dataPtr = e.malloc(data.byteLength);
  m.HEAPU8.set(data, dataPtr);
  // HB_MEMORY_MODE_WRITABLE = 2; memory is owned by us for the app lifetime.
  const blob = e.hb_blob_create(dataPtr, data.byteLength, 2, 0, 0);
  const face = e.hb_face_create(blob, 0);
  const upem = e.hb_face_get_upem(face);
  const font = e.hb_font_create(face);
  const buffer = e.hb_buffer_create();
  const shapeCache = new Map<string, ShapedGlyph[]>();
  const pathCache = new Map<number, PathCmd[]>();

  function shape(text: string, lang = 'mr'): ShapedGlyph[] {
    const ck = lang + '\u0000' + text;
    const hit = shapeCache.get(ck);
    if (hit) return hit;
    e.hb_buffer_clear_contents(buffer);
    const len = text.length;
    const strPtr = e.malloc(len * 2 + 2);
    const u16 = m.HEAPU16.subarray(strPtr / 2, strPtr / 2 + len);
    for (let i = 0; i < len; i++) u16[i] = text.charCodeAt(i);
    e.hb_buffer_add_utf16(buffer, strPtr, len, 0, len);
    e.free(strPtr);
    e.hb_buffer_guess_segment_properties(buffer);
    e.hb_buffer_set_language(buffer, language(m, lang));
    e.hb_shape(font, buffer, 0, 0);
    const n = e.hb_buffer_get_length(buffer);
    const infos = e.hb_buffer_get_glyph_infos(buffer, 0) / 4;
    const poss = e.hb_buffer_get_glyph_positions(buffer, 0) / 4;
    const out: ShapedGlyph[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        gid: m.HEAPU32[infos + i * 5],
        cluster: m.HEAPU32[infos + i * 5 + 2],
        xAdvance: m.HEAP32[poss + i * 5],
        yAdvance: m.HEAP32[poss + i * 5 + 1],
        xOffset: m.HEAP32[poss + i * 5 + 2],
        yOffset: m.HEAP32[poss + i * 5 + 3],
      });
    }
    if (shapeCache.size > 5000) shapeCache.clear();
    shapeCache.set(ck, out);
    return out;
  }

  function glyphPath(gid: number): PathCmd[] {
    const hit = pathCache.get(gid);
    if (hit) return hit;
    sink = [];
    e.hb_font_draw_glyph(font, gid, ensureDrawFuncs(m), 0);
    const cmds = sink;
    sink = [];
    pathCache.set(gid, cmds);
    return cmds;
  }

  function measure(text: string, lang = 'mr') {
    let w = 0;
    for (const g of shape(text, lang)) w += g.xAdvance;
    return w;
  }

  return { key, upem, shape, glyphPath, measure };
}

export interface FontSources {
  [key: string]: string; // key -> font file URL
}

let fontsPromise: Promise<Record<string, HbFont>> | null = null;

/** Load HarfBuzz and the given fonts once (cached for the app lifetime). */
export function loadHbFonts(sources: FontSources): Promise<Record<string, HbFont>> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const m = await getModule();
      const entries = await Promise.all(
        Object.entries(sources).map(async ([key, url]) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`font ${key}: HTTP ${res.status}`);
          return [key, makeFont(m, key, await res.arrayBuffer())] as const;
        }),
      );
      return Object.fromEntries(entries);
    })().catch((e) => {
      fontsPromise = null;
      throw e;
    });
  }
  return fontsPromise;
}
