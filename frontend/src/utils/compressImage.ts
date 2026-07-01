const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/gif') {
      resolve(file);
      return;
    }

    const isPng = file.type === 'image/png';

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No se pudo crear el contexto del canvas')); return; }

      if (isPng) {
        ctx.clearRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);

      if (isPng) {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Error al comprimir la imagen'));
          },
          'image/png',
        );
      } else {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Error al comprimir la imagen'));
          },
          'image/jpeg',
          JPEG_QUALITY,
        );
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar la imagen'));
    };

    img.src = url;
  });
}
