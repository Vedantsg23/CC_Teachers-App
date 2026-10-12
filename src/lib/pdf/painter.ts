/**
 * DOM → PDF painter.
 *
 * Reports are ordinary React/HTML pages sized exactly A4 (portrait or
 * landscape). To make a PDF we read the browser's finished layout of each
 * page — boxes, borders, backgrounds, images and the position of every word —
 * and redraw it as vector graphics. Words are shaped with HarfBuzz using the
 * same Noto Sans Devanagari font the browser used, so conjuncts, matras and
 * Marathi letter forms are correct, and the PDF looks like the preview.
 */
import { loadHbFonts, type HbFont } from './hb';
import { FONT_ASCENT, FONT_DESCENT, FONT_URLS } from './fonts';
import { PdfDocument, type JpegImage, type RGB } from './writer';

const PX_TO_PT = 0.75;

export interface PaintOptions {
  title?: string;
  author?: string;
  onProgress?: (done: number, total: number) => void;
}

interface Rgba extends RGB {
  a: number;
}

function parseColor(v: string): Rgba | null {
  if (!v || v === 'transparent') return null;
  let m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (Number.isNaN(a)) a = 1;
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(v);
  if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: m[4] === undefined ? 1 : +m[4] };
  return { r: 0, g: 0, b: 0, a: 1 };
}

/** Blend a translucent colour over white paper. */
function onWhite(c: Rgba): RGB {
  return { r: c.r * c.a + 255 * (1 - c.a), g: c.g * c.a + 255 * (1 - c.a), b: c.b * c.a + 255 * (1 - c.a) };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<JpegImage> {
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
  if (!blob) throw new Error('jpeg');
  return { data: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

/** Rasterize an <img> (respecting object-fit) or inline <svg> to a JPEG of its displayed box. */
async function rasterize(el: Element, cssW: number, cssH: number): Promise<JpegImage | null> {
  const k = 3; // render at 3× CSS size (≈ 288 dpi)
  const w = Math.max(1, Math.round(cssW * k));
  const h = Math.max(1, Math.round(cssH * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  let img: HTMLImageElement;
  let fit = 'fill';
  if (el instanceof HTMLImageElement) {
    if (!el.complete || !el.naturalWidth) {
      try {
        await el.decode();
      } catch {
        return null;
      }
    }
    img = el;
    fit = getComputedStyle(el).objectFit || 'fill';
  } else {
    const clone = el.cloneNode(true) as SVGElement;
    const color = getComputedStyle(el).color;
    clone.setAttribute('width', String(cssW));
    clone.setAttribute('height', String(cssH));
    let xml = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, color);
    if (!/xmlns=/.test(xml)) xml = xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    try {
      img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
    } catch {
      return null;
    }
  }
  const iw = img.naturalWidth || w;
  const ih = img.naturalHeight || h;
  if (fit === 'cover' || fit === 'contain') {
    const s = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else ctx.drawImage(img, 0, 0, w, h);
  return canvasToJpeg(canvas);
}

class PagePainter {
  private range = document.createRange();
  private pageLeft = 0;
  private pageTop = 0;
  private scale = 1;
  private pageHpt = 0;
  private doc: PdfDocument;
  private fonts: Record<string, HbFont>;
  private images: Map<Element, JpegImage | null>;

  constructor(doc: PdfDocument, fonts: Record<string, HbFont>, images: Map<Element, JpegImage | null>) {
    this.doc = doc;
    this.fonts = fonts;
    this.images = images;
  }

  paint(page: HTMLElement) {
    const r = page.getBoundingClientRect();
    this.scale = r.width / page.offsetWidth || 1;
    this.pageLeft = r.left;
    this.pageTop = r.top;
    const wPt = page.offsetWidth * PX_TO_PT;
    this.pageHpt = page.offsetHeight * PX_TO_PT;
    this.doc.beginPage({ width: wPt, height: this.pageHpt });
    this.walk(page);
    this.doc.endPage();
  }

  /** client px → PDF pt */
  private x(clientX: number) {
    return ((clientX - this.pageLeft) / this.scale) * PX_TO_PT;
  }
  private y(clientY: number) {
    return this.pageHpt - ((clientY - this.pageTop) / this.scale) * PX_TO_PT;
  }

  private font(weight: string): HbFont {
    const w = parseInt(weight, 10) || 400;
    return w >= 650 ? this.fonts.B : w >= 550 ? this.fonts.S : this.fonts.R;
  }

  private walk(el: Element) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || el.hasAttribute('data-pdf-skip')) return;
    const visible = cs.visibility !== 'hidden';
    const r = el.getBoundingClientRect();
    if (visible) this.box(cs, r);
    if (el instanceof HTMLImageElement || el instanceof SVGSVGElement) {
      const img = this.images.get(el);
      if (img && visible) this.doc.drawJpeg(img, this.x(r.left), this.y(r.bottom), (r.width / this.scale) * PX_TO_PT, (r.height / this.scale) * PX_TO_PT);
      return;
    }
    if (el.hasAttribute('data-vt')) {
      if (visible) this.vertical(el, cs, r);
      return;
    }
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (visible) this.text(child as Text, cs);
      } else if (child.nodeType === Node.ELEMENT_NODE) this.walk(child as Element);
    }
  }

  private box(cs: CSSStyleDeclaration, r: DOMRect) {
    if (r.width <= 0 || r.height <= 0) return;
    const bg = parseColor(cs.backgroundColor);
    const left = this.x(r.left);
    const right = this.x(r.right);
    const top = this.y(r.top);
    const bottom = this.y(r.bottom);
    if (bg && bg.a > 0.01) this.doc.fillRect(left, bottom, right - left, top - bottom, onWhite(bg));
    const sides = [
      ['Top', 'h', top, -1],
      ['Bottom', 'h', bottom, 1],
      ['Left', 'v', left, 1],
      ['Right', 'v', right, -1],
    ] as const;
    for (const [side, dir, pos, inward] of sides) {
      const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`);
      if (!style || style === 'none' || style === 'hidden') continue;
      const wPx = parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`));
      if (!(wPx > 0)) continue;
      const c = parseColor(cs.getPropertyValue(`border-${side.toLowerCase()}-color`));
      if (!c || c.a <= 0.01) continue;
      const wPt = wPx * PX_TO_PT;
      const dash = style === 'dashed' ? [wPt * 3, wPt * 2] : style === 'dotted' ? [wPt, wPt * 1.5] : undefined;
      const off = (wPt / 2) * inward;
      if (dir === 'h') this.doc.line(left, pos + off, right, pos + off, wPt, onWhite(c), dash);
      else this.doc.line(pos + off, bottom, pos + off, top, wPt, onWhite(c), dash);
    }
  }

  private text(node: Text, cs: CSSStyleDeclaration) {
    const data = node.data;
    if (!data.trim()) return;
    const c = parseColor(cs.color);
    if (!c || c.a <= 0.01) return;
    const color = onWhite(c);
    const fsPx = parseFloat(cs.fontSize);
    if (!(fsPx > 0)) return;
    const font = this.font(cs.fontWeight);
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(data))) {
      this.range.setStart(node, m.index);
      this.range.setEnd(node, m.index + m[0].length);
      const rects = this.range.getClientRects();
      if (!rects.length) continue;
      if (rects.length === 1) this.word(m[0], rects[0], font, fsPx, color);
      else this.brokenWord(node, m.index, m[0], font, fsPx, color);
    }
  }

  /** A word that the browser broke across lines: place each line piece. */
  private brokenWord(node: Text, start: number, word: string, font: HbFont, fsPx: number, color: RGB) {
    const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('mr', { granularity: 'grapheme' }) : null;
    const parts = seg ? [...seg.segment(word)].map((s) => ({ i: s.index, t: s.segment })) : [...word].map((t, i) => ({ i, t }));
    let piece = '';
    let pieceRect: DOMRect | null = null;
    for (const p of parts) {
      this.range.setStart(node, start + p.i);
      this.range.setEnd(node, start + p.i + p.t.length);
      const r = this.range.getClientRects()[0];
      if (!r) continue;
      if (pieceRect && Math.abs(r.top - pieceRect.top) > 2) {
        this.word(piece, pieceRect, font, fsPx, color);
        piece = '';
        pieceRect = null;
      }
      if (!pieceRect) pieceRect = r;
      piece += p.t;
    }
    if (piece && pieceRect) this.word(piece, pieceRect, font, fsPx, color);
  }

  private word(word: string, rect: DOMRect, font: HbFont, fsPx: number, color: RGB) {
    const hCss = rect.height / this.scale;
    const content = (FONT_ASCENT + FONT_DESCENT) * fsPx;
    const baselineCss = (rect.top - this.pageTop) / this.scale + (hCss - content) / 2 + FONT_ASCENT * fsPx;
    const x = this.x(rect.left);
    const y = this.pageHpt - baselineCss * PX_TO_PT;
    this.doc.drawRun(font, word, x, y, fsPx * PX_TO_PT, color);
  }

  /** Vertical (bottom-to-top) header text, e.g. tool names in register headers. */
  private vertical(el: Element, cs: CSSStyleDeclaration, r: DOMRect) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const c = parseColor(cs.color);
    if (!c) return;
    const font = this.font(cs.fontWeight);
    const size = parseFloat(cs.fontSize) * PX_TO_PT;
    const runW = (font.measure(text) / font.upem) * size;
    const left = this.x(r.left);
    const right = this.x(r.right);
    const top = this.y(r.top);
    const bottom = this.y(r.bottom);
    const cx = (left + right) / 2;
    const xBase = cx + ((FONT_ASCENT - FONT_DESCENT) / 2) * size;
    const yStart = bottom + (top - bottom - runW) / 2;
    this.doc.drawRun(font, text, xBase, yStart, size, onWhite(c), true);
  }
}

/** Convert rendered report pages (elements with exact A4 size) into a PDF. */
export async function pagesToPdf(pages: HTMLElement[], opts: PaintOptions = {}): Promise<Uint8Array> {
  if (document.fonts?.ready) await document.fonts.ready;
  const fonts = await loadHbFonts(FONT_URLS);
  const images = new Map<Element, JpegImage | null>();
  for (const page of pages) {
    const scale = page.getBoundingClientRect().width / page.offsetWidth || 1;
    for (const el of page.querySelectorAll('img, svg')) {
      if (el.parentElement?.closest('svg')) continue; // nested inside another svg
      if (el.closest('[data-pdf-skip]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      try {
        images.set(el, await rasterize(el, r.width / scale, r.height / scale));
      } catch {
        images.set(el, null);
      }
    }
  }
  const doc = new PdfDocument();
  const painter = new PagePainter(doc, fonts, images);
  for (let i = 0; i < pages.length; i++) {
    painter.paint(pages[i]);
    opts.onProgress?.(i + 1, pages.length);
    // let the UI breathe between pages
    await new Promise((r) => setTimeout(r, 0));
  }
  const bytes = doc.save({ title: opts.title, author: opts.author });
  lastPdfStats = { pages: pages.length, glyphs: doc.glyphCount, missingGlyphs: doc.missingGlyphs };
  (globalThis as { __cceLastPdf?: PdfStats }).__cceLastPdf = lastPdfStats;
  return bytes;
}

export interface PdfStats {
  pages: number;
  glyphs: number;
  missingGlyphs: number;
}

/** Stats of the most recent PDF (used by the automated PDF test). */
export let lastPdfStats: PdfStats | null = null;
