import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { decodeProgressPhoto } from './progress-photo.js';
import { UsersService } from './users.service.js';

function solid(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 40, b: 60 },
    },
  });
}

describe('decodeProgressPhoto', () => {
  it('decodes jpeg, png, and webp into a jpeg', async () => {
    for (const encoded of [
      solid(8, 8).jpeg(),
      solid(8, 8).png(),
      solid(8, 8).webp(),
    ]) {
      const decoded = await decodeProgressPhoto(
        (await encoded.toBuffer()).toString('base64'),
      );
      expect(decoded.contentType).toBe('image/jpeg');
      expect(decoded.image.subarray(0, 3)).toEqual(
        Buffer.from([0xff, 0xd8, 0xff]),
      );
      const meta = await sharp(decoded.image).metadata();
      expect(meta.width).toBe(8);
      expect(meta.height).toBe(8);
    }
  });

  it('rejects spoofed, truncated, oversized, wide, and unsupported files', async () => {
    const real = await solid(4, 4).jpeg().toBuffer();
    const cases = [
      'aaaa',
      Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]).toString('base64'),
      real.subarray(0, 12).toString('base64'),
      Buffer.concat([real, Buffer.alloc(400_000)]).toString('base64'),
      (await solid(1025, 2).jpeg().toBuffer()).toString('base64'),
      (await solid(2048, 2048).jpeg().toBuffer()).toString('base64'),
      Buffer.from('00000018667479706865696300000000', 'hex').toString('base64'),
    ];

    for (const imageBase64 of cases) {
      await expect(decodeProgressPhoto(imageBase64)).rejects.toThrow(
        'PHOTO_INVALID',
      );
    }
  });
});

describe('UsersService progress photos', () => {
  it('locks the user row and refuses an eighth photo', async () => {
    const image = (await solid(2, 2).jpeg().toBuffer()).toString('base64');
    const prisma = {
      progressPhoto: {
        count: vi.fn().mockResolvedValue(8),
        create: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(
      async (work: (tx: typeof prisma) => unknown) => work(prisma),
    );
    const service = new UsersService(prisma as never, {} as never, {} as never);

    await expect(
      service.createProgressPhoto('user', image),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.progressPhoto.create).not.toHaveBeenCalled();
  });
});
