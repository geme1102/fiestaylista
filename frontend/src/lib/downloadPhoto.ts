import { reportError } from './reportError';

const DOWNLOAD_TIMEOUT_MS = 15_000;

// F4-M + F11-B: descarga de fotos cross-origin (Cloudinary). Un `<a download>`
// con URL de otro origen ignora el atributo download (sin Content-Disposition)
// y reemplaza la SPA por la imagen — antes PhotoSlideshow lo hacía y perdía
// slideshow/scroll/drafts. Se reutiliza aquí el patrón fetch→blob→objectURL
// (con AbortController + timeout como api.ts) y en móvil se comparte el blob.
export async function downloadPhoto(url: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    const fileName = url.split('/').pop() || 'photo.jpg';

    if (navigator.share && (/Mobi|Android/i.test(navigator.userAgent) || 'ontouchstart' in window)) {
      try {
        const file = new File([blob], fileName, { type: blob.type });
        await navigator.share({ files: [file], title: 'Foto del evento' });
        return;
      } catch (err) {
        reportError(err, { source: 'downloadPhoto' });
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    reportError(err, { source: 'downloadPhoto' });
    // Fallback: abrir en pestaña nueva (el usuario descarga manualmente)
    try {
      const safe = new URL(url);
      if (safe.protocol === 'https:' || safe.protocol === 'http:') {
        window.open(url, '_blank', 'noopener');
      }
    } catch {
      /* URL inválida — ignorar */
    }
  }
}
