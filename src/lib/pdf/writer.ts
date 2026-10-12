/**
 * A small, dependency-light PDF 1.7 writer.
 *
 * Text is drawn as vector glyph outlines (shaped by HarfBuzz), each unique
 * glyph stored once as a Form XObject and re-used — so files stay small and
 * Marathi renders identically in every PDF viewer, with no font embedding
 * or viewer-side shaping involved.
 */
import { zlibSync } from 'fflate';
import type { HbFont, PathCmd } from './hb';

const enc = new TextEncoder();

export interface RGB {
  r: number;
  g: number;
  b: number;
}

interface StreamObj {
  dict: string;
  data: Uint8Array;
}
type PdfObj = string | StreamObj;

function num(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

function colorOps(c: RGB, stroke = false): string {
  return `${num(c.r / 255)} ${num(c.g / 255)} ${num(c.b / 255)} ${stroke ? 'RG' : 'rg'}`;
}

/** PDF text string for the Info dictionary (UTF-16BE with BOM). */
function pdfTextString(s: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex}>`;
}

function pathToOps(cmds: PathCmd[]): string {
  const out: string[] = [];
  let cx = 0;
  let cy = 0;
  for (const c of cmds) {
    switch (c.t) {
      case 'M':
        out.push(`${num(c.x)} ${num(c.y)} m`);
        cx = c.x;
        cy = c.y;
        break;
      case 'L':
        out.push(`${num(c.x)} ${num(c.y)} l`);
        cx = c.x;
        cy = c.y;
        break;
      case 'Q': {
        // Quadratic -> cubic Bézier
        const c1x = cx + (2 / 3) * (c.cx - cx);
        const c1y = cy + (2 / 3) * (c.cy - cy);
        const c2x = c.x + (2 / 3) * (c.cx - c.x);
        const c2y = c.y + (2 / 3) * (c.cy - c.y);
        out.push(`${num(c1x)} ${num(c1y)} ${num(c2x)} ${num(c2y)} ${num(c.x)} ${num(c.y)} c`);
        cx = c.x;
        cy = c.y;
        break;
      }
      case 'C':
        out.push(`${num(c.c1x)} ${num(c.c1y)} ${num(c.c2x)} ${num(c.c2y)} ${num(c.x)} ${num(c.y)} c`);
        cx = c.x;
        cy = c.y;
        break;
      case 'Z':
        out.push('h');
        break;
    }
  }
  return out.join('\n');
}

export interface PdfPageOptions {
  /** Page size in PDF points. */
  width: number;
  height: number;
}

export interface JpegImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export class PdfDocument {
  private objects: PdfObj[] = [];
  private pages: number[] = [];
  private glyphForms = new Map<string, { name: string; id: number }>();
  private images: { name: string; id: number }[] = [];
  private pageXObjects = new Set<string>();
  private allXObjects = new Map<string, number>();
  private ops: string[] = [];
  private page: PdfPageOptions | null = null;
  private pagesRootId: number;
  private compress: boolean;
  /** Glyphs the font could not render (.notdef). Must stay 0 for Marathi text. */
  missingGlyphs = 0;
  glyphCount = 0;

  constructor(opts: { compress?: boolean } = {}) {
    this.compress = opts.compress ?? true;
    // Reserve id 1 for the Pages root.
    this.pagesRootId = this.reserve();
  }

  private reserve(): number {
    this.objects.push('');
    return this.objects.length;
  }

  private add(obj: PdfObj): number {
    this.objects.push(obj);
    return this.objects.length;
  }

  private stream(dict: string, content: string | Uint8Array): StreamObj {
    const raw = typeof content === 'string' ? enc.encode(content) : content;
    if (this.compress) {
      const z = zlibSync(raw, { level: 6 });
      return { dict: `${dict} /Length ${z.length} /Filter /FlateDecode`, data: z };
    }
    return { dict: `${dict} /Length ${raw.length}`, data: raw };
  }

  beginPage(opts: PdfPageOptions) {
    if (this.page) this.endPage();
    this.page = opts;
    this.ops = [];
    this.pageXObjects = new Set();
  }

  endPage() {
    if (!this.page) return;
    const contentId = this.add(this.stream('<<', this.ops.join('\n')));
    const xo = [...this.pageXObjects].map((n) => `/${n} ${this.allXObjects.get(n)} 0 R`).join(' ');
    const pageId = this.add(
      `<< /Type /Page /Parent ${this.pagesRootId} 0 R /MediaBox [0 0 ${num(this.page.width)} ${num(
        this.page.height,
      )}] /Resources << /XObject << ${xo} >> >> /Contents ${contentId} 0 R >>`,
    );
    this.pages.push(pageId);
    this.page = null;
    this.ops = [];
  }

  get pageHeight() {
    return this.page?.height ?? 0;
  }

  /** Filled rectangle, PDF coordinates (origin bottom-left). */
  fillRect(x: number, y: number, w: number, h: number, color: RGB) {
    this.ops.push(`${colorOps(color)} ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
  }

  /** Straight line, PDF coordinates. */
  line(x1: number, y1: number, x2: number, y2: number, width: number, color: RGB, dash?: number[]) {
    this.ops.push(
      `q ${colorOps(color, true)} ${num(width)} w 0 J ${dash && dash.length ? `[${dash.map(num).join(' ')}] 0 d ` : ''}${num(
        x1,
      )} ${num(y1)} m ${num(x2)} ${num(y2)} l S Q`,
    );
  }

  private glyphForm(font: HbFont, gid: number) {
    const key = `${font.key}_${gid}`;
    let rec = this.glyphForms.get(key);
    if (rec) return rec;
    const cmds = font.glyphPath(gid);
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    let first = true;
    const see = (x: number, y: number) => {
      if (first) {
        minX = maxX = x;
        minY = maxY = y;
        first = false;
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    };
    for (const c of cmds) {
      if (c.t === 'M' || c.t === 'L') see(c.x, c.y);
      else if (c.t === 'Q') {
        see(c.cx, c.cy);
        see(c.x, c.y);
      } else if (c.t === 'C') {
        see(c.c1x, c.c1y);
        see(c.c2x, c.c2y);
        see(c.x, c.y);
      }
    }
    const body = cmds.length ? `${pathToOps(cmds)}\nf` : '';
    const id = this.add(
      this.stream(
        `<< /Type /XObject /Subtype /Form /BBox [${num(minX - 2)} ${num(minY - 2)} ${num(maxX + 2)} ${num(maxY + 2)}]`,
        body,
      ),
    );
    const name = `G${this.glyphForms.size}`;
    rec = { name, id };
    this.glyphForms.set(key, rec);
    this.allXObjects.set(name, id);
    return rec;
  }

  /**
   * Draw a shaped run. (x, y) is the baseline origin in PDF points.
   * `rotate90` draws the run reading bottom-to-top (vertical table headers).
   */
  drawRun(font: HbFont, text: string, x: number, y: number, size: number, color: RGB, rotate90 = false, lang = 'mr') {
    const glyphs = font.shape(text, lang);
    if (!glyphs.length) return;
    const s = size / font.upem;
    this.ops.push(`q ${colorOps(color)}`);
    let pen = 0;
    for (const g of glyphs) {
      this.glyphCount++;
      if (g.gid === 0 && !/^\s$/.test(text[g.cluster] ?? '')) this.missingGlyphs++;
      if (g.gid !== 0) {
        const form = this.glyphForm(font, g.gid);
        this.pageXObjects.add(form.name);
        const dx = (pen + g.xOffset) * s;
        const dy = g.yOffset * s;
        if (rotate90) {
          // Text-space (dx, dy) rotated +90°: (x - dy, y + dx)
          this.ops.push(`q 0 ${num(s)} ${num(-s)} 0 ${num(x - dy)} ${num(y + dx)} cm /${form.name} Do Q`);
        } else {
          this.ops.push(`q ${num(s)} 0 0 ${num(s)} ${num(x + dx)} ${num(y + dy)} cm /${form.name} Do Q`);
        }
      }
      pen += g.xAdvance;
    }
    this.ops.push('Q');
  }

  /** Place a JPEG image (x, y = bottom-left in PDF points). */
  drawJpeg(img: JpegImage, x: number, y: number, w: number, h: number) {
    const name = `I${this.images.length}`;
    const id = this.add({
      dict: `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length}`,
      data: img.data,
    });
    this.images.push({ name, id });
    this.allXObjects.set(name, id);
    this.pageXObjects.add(name);
    this.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /${name} Do Q`);
  }

  /** Serialize to bytes. */
  save(meta: { title?: string; author?: string } = {}): Uint8Array {
    if (this.page) this.endPage();
    this.objects[this.pagesRootId - 1] = `<< /Type /Pages /Kids [${this.pages
      .map((p) => `${p} 0 R`)
      .join(' ')}] /Count ${this.pages.length} >>`;
    const catalogId = this.add(`<< /Type /Catalog /Pages ${this.pagesRootId} 0 R >>`);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `D:${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(
      now.getMinutes(),
    )}${pad(now.getSeconds())}`;
    const infoId = this.add(
      `<< /Producer ${pdfTextString('CCE नोंदवही')} /Creator ${pdfTextString('CCE नोंदवही')}${
        meta.title ? ` /Title ${pdfTextString(meta.title)}` : ''
      }${meta.author ? ` /Author ${pdfTextString(meta.author)}` : ''} /CreationDate (${date}) >>`,
    );

    const chunks: Uint8Array[] = [];
    let offset = 0;
    const push = (s: string | Uint8Array) => {
      const b = typeof s === 'string' ? enc.encode(s) : s;
      chunks.push(b);
      offset += b.length;
    };
    push('%PDF-1.7\n');
    push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    const offsets: number[] = [];
    this.objects.forEach((o, i) => {
      offsets[i] = offset;
      push(`${i + 1} 0 obj\n`);
      if (typeof o === 'string') push(`${o}\n`);
      else {
        push(`${o.dict} >>\nstream\n`);
        push(o.data);
        push('\nendstream\n');
      }
      push('endobj\n');
    });
    const xrefAt = offset;
    let xref = `xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
    push(xref);
    push(
      `trailer\n<< /Size ${this.objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
    );
    const out = new Uint8Array(offset);
    let p = 0;
    for (const c of chunks) {
      out.set(c, p);
      p += c.length;
    }
    return out;
  }
}
