/** Save / share files from the browser (works offline). */

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadText(text: string, fileName: string, type = 'application/json'): void {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), fileName);
}

export function downloadBytes(bytes: Uint8Array, fileName: string, type: string): void {
  downloadBlob(new Blob([bytes as BlobPart], { type }), fileName);
}

export function canShareFiles(): boolean {
  try {
    const f = new File(['x'], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

/** Share through the phone's share sheet (WhatsApp, Drive, email …); falls back to download. */
export async function shareFile(blob: Blob, fileName: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: blob.type });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

/** Read a user-picked file as text with a size limit. */
export async function readFileText(file: File, maxBytes = 30 * 1024 * 1024): Promise<string> {
  if (file.size > maxBytes) throw new Error('फाइल खूप मोठी आहे.');
  return file.text();
}

/** Resize a picked photo to a small JPEG data URL (for student photos / school logo). */
export async function imageFileToDataUrl(file: File, maxW = 360, maxH = 440, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('कृपया फोटो (image) फाइल निवडा.');
  if (file.size > 15 * 1024 * 1024) throw new Error('फोटो खूप मोठा आहे.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('हा फोटो उघडता आला नाही.'));
      i.src = url;
    });
    const s = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * s));
    const h = Math.max(1, Math.round(img.naturalHeight * s));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
