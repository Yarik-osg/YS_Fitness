import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { decodeProgressPhoto } from './progress-photo.js';
import { UsersService } from './users.service.js';

function jpeg(width: number, height: number) {
  const segment = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x00,
    0x00,
  ]);
  segment.writeUInt16BE(height, 5);
  segment.writeUInt16BE(width, 7);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment,
    Buffer.from([0xff, 0xd9]),
  ]);
}

const onePixel = jpeg(1, 1).toString('base64');

describe('decodeProgressPhoto', () => {
  it('accepts a small jpeg and rejects anything else', () => {
    expect(decodeProgressPhoto(onePixel).contentType).toBe('image/jpeg');
    expect(() => decodeProgressPhoto('aaaa')).toThrow('PHOTO_INVALID');
    expect(() => decodeProgressPhoto(jpeg(1, 2000).toString('base64'))).toThrow(
      'PHOTO_INVALID',
    );
    const huge = Buffer.concat([jpeg(1, 1), Buffer.alloc(400_000)]);
    expect(() => decodeProgressPhoto(huge.toString('base64'))).toThrow(
      'PHOTO_INVALID',
    );
  });
});

describe('UsersService progress photos', () => {
  it('refuses an eighth photo', async () => {
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
      service.createProgressPhoto('user', onePixel),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.progressPhoto.create).not.toHaveBeenCalled();
  });
});
