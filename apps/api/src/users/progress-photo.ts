import sharp from 'sharp';

const MAX_BYTES = 400_000;
const MAX_EDGE = 1024;

export type ProgressPhotoContentType =
  'image/jpeg' | 'image/png' | 'image/webp';

export class ProgressPhotoError extends Error {
  constructor(readonly code: 'PHOTO_INVALID') {
    super(code);
  }
}

export async function decodeProgressPhoto(imageBase64: string): Promise<{
  contentType: 'image/jpeg';
  image: Buffer;
}> {
  const input = Buffer.from(imageBase64, 'base64');
  if (input.length === 0 || input.length > MAX_BYTES || !sniff(input)) {
    throw new ProgressPhotoError('PHOTO_INVALID');
  }

  try {
    const decoded = await sharp(input, {
      failOn: 'error',
      limitInputPixels: MAX_EDGE * MAX_EDGE,
      animated: false,
    })
      .rotate()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = decoded.info;
    if (
      width < 1 ||
      height < 1 ||
      width > MAX_EDGE ||
      height > MAX_EDGE ||
      channels < 1 ||
      channels > 4
    ) {
      throw new ProgressPhotoError('PHOTO_INVALID');
    }

    let quality = 80;
    let image = await encodeJpeg(
      decoded.data,
      width,
      height,
      channels,
      quality,
    );
    while (image.length > MAX_BYTES && quality > 40) {
      quality -= 10;
      image = await encodeJpeg(decoded.data, width, height, channels, quality);
    }
    if (image.length === 0 || image.length > MAX_BYTES) {
      throw new ProgressPhotoError('PHOTO_INVALID');
    }
    return { contentType: 'image/jpeg', image };
  } catch (error) {
    if (error instanceof ProgressPhotoError) throw error;
    throw new ProgressPhotoError('PHOTO_INVALID');
  }
}

function encodeJpeg(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  quality: number,
) {
  return sharp(data, {
    raw: {
      width,
      height,
      channels: channels as 1 | 2 | 3 | 4,
    },
  })
    .jpeg({ quality })
    .toBuffer();
}

function sniff(image: Buffer): boolean {
  if (image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) return true;
  if (
    image[0] === 0x89 &&
    image[1] === 0x50 &&
    image[2] === 0x4e &&
    image[3] === 0x47
  ) {
    return true;
  }
  return (
    image.subarray(0, 4).toString('ascii') === 'RIFF' &&
    image.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}
