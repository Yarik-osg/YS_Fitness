const MAX_BYTES = 400_000;
const MAX_EDGE = 1024;

export type ProgressPhotoContentType =
  'image/jpeg' | 'image/png' | 'image/webp';

export class ProgressPhotoError extends Error {
  constructor(readonly code: 'PHOTO_INVALID') {
    super(code);
  }
}

export function decodeProgressPhoto(imageBase64: string): {
  contentType: ProgressPhotoContentType;
  image: Buffer;
} {
  const image = Buffer.from(imageBase64, 'base64');
  const contentType = sniff(image);
  const size = contentType ? dimensions(image, contentType) : null;
  if (
    image.length === 0 ||
    image.length > MAX_BYTES ||
    !contentType ||
    !size ||
    size.width < 1 ||
    size.height < 1 ||
    size.width > MAX_EDGE ||
    size.height > MAX_EDGE
  ) {
    throw new ProgressPhotoError('PHOTO_INVALID');
  }
  return { contentType, image };
}

function sniff(image: Buffer): ProgressPhotoContentType | null {
  if (image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    image[0] === 0x89 &&
    image[1] === 0x50 &&
    image[2] === 0x4e &&
    image[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    image.subarray(0, 4).toString('ascii') === 'RIFF' &&
    image.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function dimensions(
  image: Buffer,
  contentType: ProgressPhotoContentType,
): { width: number; height: number } | null {
  if (contentType === 'image/png') return pngSize(image);
  if (contentType === 'image/webp') return webpSize(image);
  return jpegSize(image);
}

function jpegSize(image: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 3 < image.length) {
    if (image[offset] !== 0xff) return null;
    const marker = image[offset + 1]!;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const segmentLength = image.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > image.length) {
      return null;
    }
    const startOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (startOfFrame) {
      if (segmentLength < 7) return null;
      return {
        height: image.readUInt16BE(offset + 5),
        width: image.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function pngSize(image: Buffer): { width: number; height: number } | null {
  if (image.length < 24 || image.toString('ascii', 12, 16) !== 'IHDR') {
    return null;
  }
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

function webpSize(image: Buffer): { width: number; height: number } | null {
  if (image.length < 25) return null;
  const chunk = image.toString('ascii', 12, 16);
  if (chunk === 'VP8X' && image.length >= 30) {
    return {
      width: 1 + image.readUIntLE(24, 3),
      height: 1 + image.readUIntLE(27, 3),
    };
  }
  if (
    chunk === 'VP8 ' &&
    image.length >= 30 &&
    image[23] === 0x9d &&
    image[24] === 0x01 &&
    image[25] === 0x2a
  ) {
    return {
      width: image.readUInt16LE(26) & 0x3fff,
      height: image.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L' && image[20] === 0x2f) {
    const bits = image.readUInt32LE(21);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
    };
  }
  return null;
}
