/**
 * Report building blocks: A4 pages, a measuring paginator for long register
 * tables (header row repeated on every page), the CCE header block and the
 * signature row. Pages are plain DOM so preview, print and PDF match.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type Orientation = 'portrait' | 'landscape';

let fontsReadyCache = false;

/** Wait until the report font (all weights) is loaded before measuring. */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(fontsReadyCache);
  useEffect(() => {
    if (fontsReadyCache) return;
    let alive = true;
    const f = document.fonts;
    if (!f?.load) {
      fontsReadyCache = true;
      setReady(true);
      return;
    }
    Promise.all([f.load('400 12px "CCE Sans"', 'अआ12'), f.load('600 12px "CCE Sans"', 'अआ12'), f.load('700 12px "CCE Sans"', 'अआ12')])
      .catch(() => undefined)
      .then(() => f.ready)
      .then(() => {
        fontsReadyCache = true;
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

export function ReportPage({ orientation = 'portrait', children, className = '' }: { orientation?: Orientation; children: ReactNode; className?: string }) {
  return (
    <div className={`report-page-wrap ${orientation}`}>
      <div className={`a4 ${orientation === 'landscape' ? 'landscape' : ''} ${className}`}>
        {children}
        <div className="page-no" />
      </div>
    </div>
  );
}

interface Split {
  pages: number[][];
  footerOwnPage: boolean;
}

/**
 * A table that flows over as many A4 pages as needed. `header` (title and
 * meta lines) and `thead` repeat on every page; `footer` (summary tables,
 * signatures) follows the last row — on a new page if it does not fit.
 */
export function PagedTable({
  orientation = 'portrait',
  header,
  thead,
  rows,
  footer,
  tableClassName = 'rt',
  colgroup,
  empty = 'माहिती उपलब्ध नाही.',
  emptyColSpan = 1,
}: {
  orientation?: Orientation;
  header: ReactNode;
  thead: ReactNode;
  rows: ReactNode[];
  footer?: ReactNode;
  tableClassName?: string;
  colgroup?: ReactNode;
  empty?: string;
  emptyColSpan?: number;
}) {
  const ready = useFontsReady();
  const measure = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState<Split | null>(null);

  // Re-measure after every render (rows/fonts may change); the state update is
  // skipped when the split is unchanged, so this cannot loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!ready || !measure.current) return;
    const page = measure.current.querySelector<HTMLElement>('.a4');
    const body = measure.current.querySelector<HTMLElement>('.page-body');
    const table = measure.current.querySelector<HTMLTableElement>('table');
    const foot = measure.current.querySelector<HTMLElement>('[data-m="footer"]');
    if (!page || !body || !table) return;
    const cs = getComputedStyle(page);
    const usable = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 4; // safety
    const bodyTop = body.getBoundingClientRect().top;
    const tRect = table.getBoundingClientRect();
    const above = tRect.top - bodyTop;
    const theadH = table.tHead?.getBoundingClientRect().height ?? 0;
    const trs = Array.from(table.tBodies[0]?.rows ?? []);
    const heights = trs.map((tr) => tr.getBoundingClientRect().height);
    const footerH = foot ? foot.getBoundingClientRect().bottom - tRect.bottom : 0;
    const capacity = usable - above - theadH - 2;
    const pages: number[][] = [];
    let cur: number[] = [];
    let used = 0;
    heights.forEach((h, i) => {
      if (cur.length && used + h > capacity) {
        pages.push(cur);
        cur = [];
        used = 0;
      }
      cur.push(i);
      used += h;
    });
    pages.push(cur);
    let footerOwnPage = false;
    if (foot && footerH > 0 && used + footerH > capacity) {
      // The footer (summary/signatures) does not fit under the last rows: carry
      // up to three rows over with it, so the signatures are never alone on a page.
      const last = pages[pages.length - 1];
      const carry: number[] = [];
      let carryH = 0;
      while (last.length > 1 && carry.length < 3) {
        const i = last[last.length - 1];
        if (carryH + heights[i] + footerH > capacity) break;
        carry.unshift(i);
        last.pop();
        carryH += heights[i];
      }
      if (carry.length) pages.push(carry);
      else footerOwnPage = true;
    }
    const next: Split = { pages, footerOwnPage };
    setSplit((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });

  const body = rows.length ? rows : [
    <tr key="empty">
      <td colSpan={emptyColSpan} style={{ padding: '6mm', textAlign: 'center' }}>
        {empty}
      </td>
    </tr>,
  ];

  const table = (idx: number[] | null) => (
    <table className={tableClassName}>
      {colgroup}
      <thead>{thead}</thead>
      <tbody>{idx ? idx.map((i) => body[i]) : body}</tbody>
    </table>
  );

  return (
    <>
      <div className="report-measure" aria-hidden ref={measure}>
        <div className={`a4 ${orientation === 'landscape' ? 'landscape' : ''}`}>
          <div className="page-body">
            {header}
            {table(null)}
            {footer ? <div data-m="footer">{footer}</div> : null}
          </div>
        </div>
      </div>
      {split
        ? split.pages.map((idx, pi) => (
            <ReportPage key={pi} orientation={orientation}>
              <div className="page-body">
                {header}
                {table(idx)}
                {footer && pi === split.pages.length - 1 && !split.footerOwnPage ? footer : null}
              </div>
            </ReportPage>
          ))
        : null}
      {split?.footerOwnPage && footer ? (
        <ReportPage orientation={orientation}>
          <div className="page-body">
            {header}
            {footer}
          </div>
        </ReportPage>
      ) : null}
    </>
  );
}

/** "सातत्यपूर्ण सर्वंकष मूल्यमापन" + meta lines, as in the reference registers. */
export function CceHeader({ title = 'सातत्यपूर्ण सर्वंकष मूल्यमापन', org, lines }: { title?: string; org?: string; lines: ReactNode[][] }) {
  return (
    <div style={{ marginBottom: '2mm' }}>
      {org ? <div className="rpt-org">{org}</div> : null}
      <div className="rpt-title">{title}</div>
      {lines.map((cells, i) => (
        <div className="rpt-meta" key={i}>
          {cells.map((c, j) => (
            <div key={j}>{c}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

export interface SignItem {
  label: string;
  name?: string;
}

export function Signatures({ items, compact, style, className = '' }: { items: SignItem[]; compact?: boolean; style?: CSSProperties; className?: string }) {
  return (
    <div className={`sign-row ${compact ? 'compact' : ''} ${className}`} style={style}>
      {items.map((s, i) => (
        <div className="sign" key={`${s.label}-${i}`}>
          <div className="lbl">{s.label}</div>
          <div className="who">{s.name || '\u00A0'}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Vertical header text inside a <th>, reading bottom → top.
 * The visible copy is ordinary horizontal text rotated with a CSS transform,
 * so Devanagari is always shaped correctly (some browsers mis-shape
 * Devanagari in vertical writing-mode). A hidden vertical copy only sizes
 * the cell. The PDF engine draws `[data-vt]` text rotated itself.
 */
export function VT({ children }: { children: ReactNode }) {
  return (
    <span className="vt-box">
      <span className="vt-size" aria-hidden>
        {children}
      </span>
      <span className="vt" data-vt="">
        {children}
      </span>
    </span>
  );
}
