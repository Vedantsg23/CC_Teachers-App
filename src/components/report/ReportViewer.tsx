/**
 * "अहवाल पूर्वदृश्य" — full-screen preview of report pages with
 * PDF तयार करा / प्रिंट करा / शेअर करा / बंद करा.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { pagesToPdf } from '../../lib/pdf/painter';
import { canShareFiles, downloadBlob, shareFile } from '../../lib/share';
import { Icon } from '../Icon';
import { useFeedback } from '../feedback';
import { Button } from '../ui';
import type { Orientation } from './Report';

export type Paper = 'A4' | 'A3';

const PAGE_W_PX = { portrait: (210 / 25.4) * 96, landscape: (297 / 25.4) * 96 };
/** A3 is A4 enlarged by √2 — every report keeps its A4 layout and prints bigger. */
const PAPER_SCALE: Record<Paper, number> = { A4: 1, A3: Math.SQRT2 };

function printRoot(): HTMLElement {
  let el = document.getElementById('print-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'print-root';
    document.body.appendChild(el);
  }
  return el;
}

export function ReportViewer({
  title,
  fileName,
  orientation,
  options,
  children,
  onClose,
  showPageNumbers = true,
  author,
  paper = 'A4',
}: {
  title: string;
  fileName: string;
  orientation: Orientation;
  paper?: Paper;
  options?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  showPageNumbers?: boolean;
  author?: string;
}) {
  const { toast } = useFeedback();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [zoom, setZoom] = useState<'fit' | 'full'>('fit');
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState<null | 'pdf' | 'share'>(null);
  const [progress, setProgress] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const shareable = canShareFiles();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // fit pages to the available width
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 16;
      setScale(zoom === 'full' ? 1 : Math.min(1, Math.max(0.15, w / (PAGE_W_PX[orientation] * PAPER_SCALE[paper]))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoom, orientation, paper]);

  // number the pages ("पृष्ठ 1 / 3") whenever the page set changes
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const renumber = () => {
      const nodes = stage.querySelectorAll<HTMLElement>('.report-page-wrap > .a4 > .page-no');
      nodes.forEach((n, i) => {
        const want = showPageNumbers && nodes.length > 1 ? `पृष्ठ ${i + 1} / ${nodes.length}` : '';
        if (n.textContent !== want) n.textContent = want;
      });
      setPageCount(nodes.length);
    };
    renumber();
    const mo = new MutationObserver(renumber);
    mo.observe(stage, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [showPageNumbers]);

  async function makePdf(mode: 'pdf' | 'share') {
    const stage = stageRef.current;
    if (!stage) return;
    const pages = Array.from(stage.querySelectorAll<HTMLElement>('.report-page-wrap > .a4'));
    if (!pages.length) {
      toast('अहवालात पृष्ठे नाहीत.', 'error');
      return;
    }
    setBusy(mode);
    setProgress('');
    try {
      const bytes = await pagesToPdf(pages, { title, author, pageScale: PAPER_SCALE[paper], onProgress: (d, t) => setProgress(`${d}/${t}`) });
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      if (mode === 'share') {
        const r = await shareFile(blob, fileName, title);
        if (r === 'downloaded') toast('PDF डाउनलोड झाली.');
      } else {
        downloadBlob(blob, fileName);
        toast('PDF तयार झाली व डाउनलोड झाली.');
      }
    } catch (e) {
      console.error(e);
      toast('PDF तयार करताना अडचण आली. पुन्हा प्रयत्न करा.', 'error');
    } finally {
      setBusy(null);
      setProgress('');
    }
  }

  function doPrint() {
    const style = document.createElement('style');
    style.textContent = `@page { size: ${paper} ${orientation}; margin: 0; }`;
    document.head.appendChild(style);
    const cleanup = () => {
      style.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 4000);
  }

  return createPortal(
    <div className="report-viewer fixed inset-0 z-40 flex flex-col bg-[#e4e9f0] lg:left-[280px]" role="region" aria-label={`${title} — अहवाल पूर्वदृश्य`}>
      <div className="no-print border-b border-rule bg-white">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
          <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label="बंद करा">
            <Icon name="left" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-muted">अहवाल पूर्वदृश्य</div>
            <h1 ref={headingRef} tabIndex={-1} className="truncate text-[17px] font-semibold text-ink-deep outline-none">
              {title}
            </h1>
          </div>
          <span className="hidden text-[13.5px] text-muted sm:inline">{pageCount ? `${pageCount} ${pageCount === 1 ? 'पृष्ठ' : 'पृष्ठे'}` : ''}</span>
          <Button size="sm" variant="ghost" icon={zoom === 'fit' ? 'plus' : 'filter'} onClick={() => setZoom(zoom === 'fit' ? 'full' : 'fit')} aria-label={zoom === 'fit' ? 'मोठे करा' : 'स्क्रीनएवढे करा'}>
            {zoom === 'fit' ? '100%' : 'बसवा'}
          </Button>
        </div>
        {options ? <div className="border-t border-rule px-3 py-2 sm:px-4">{options}</div> : null}
        <div className="scroll-x flex gap-2 border-t border-rule px-3 py-2 sm:px-4">
          <Button size="sm" variant="primary" icon="download" onClick={() => void makePdf('pdf')} loading={busy === 'pdf'} disabled={!!busy || !pageCount}>
            {busy === 'pdf' && progress ? `PDF… ${progress}` : 'PDF तयार करा'}
          </Button>
          {shareable ? (
            <Button size="sm" icon="share" onClick={() => void makePdf('share')} loading={busy === 'share'} disabled={!!busy || !pageCount}>
              शेअर करा
            </Button>
          ) : null}
          <Button size="sm" icon="printer" onClick={doPrint} disabled={!!busy || !pageCount}>
            प्रिंट करा
          </Button>
          <Button size="sm" variant="ghost" icon="x" onClick={onClose}>
            बंद करा
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="report-scroll flex-1 overflow-auto">
        <div ref={stageRef} className={`report-stage${paper === 'A3' ? ' paper-a3' : ''}`} style={{ ['--s' as string]: scale }}>
          {children}
        </div>
      </div>
    </div>,
    printRoot(),
  );
}
