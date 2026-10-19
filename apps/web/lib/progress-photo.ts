const MAX_EDGE = 960;
const MAX_BYTES = 400_000;

export function isHeicFile(file: { name: string; type: string }): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

export async function readProgressPhoto(file: File): Promise<string> {
  const source = isHeicFile(file) ? await heicToJpeg(file) : file;
  const bitmap = await createImageBitmap(source, {
    imageOrientation: 'from-image',
  });
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PHOTO_INVALID');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let quality = 0.72;
    let blob = await canvasToJpeg(canvas, quality);
    while (blob.size > MAX_BYTES && quality > 0.4) {
      quality = Math.round((quality - 0.1) * 100) / 100;
      blob = await canvasToJpeg(canvas, quality);
    }
    if (blob.size > MAX_BYTES) throw new Error('PHOTO_INVALID');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  } finally {
    bitmap.close();
  }
}

async function heicToJpeg(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!blob) throw new Error('PHOTO_INVALID');
  return blob;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PHOTO_INVALID'))),
      'image/jpeg',
      quality,
    );
  });
}
