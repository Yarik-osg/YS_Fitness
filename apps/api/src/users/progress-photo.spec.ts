import { mkdtemp, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { decodeProgressPhoto } from './progress-photo.js';
import { LocalProgressPhotoStorage } from './progress-photo-storage.js';
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
  const userId = '11111111-1111-4111-8111-111111111111';

  function storage() {
    return {
      save: vi.fn().mockResolvedValue(undefined),
      read: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('locks the user row and removes the file when the eighth photo is refused', async () => {
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
    const files = storage();
    const service = new UsersService(
      prisma as never,
      {} as never,
      {} as never,
      files,
    );

    await expect(
      service.createProgressPhoto(userId, image),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.progressPhoto.create).not.toHaveBeenCalled();
    expect(files.save).toHaveBeenCalledOnce();
    expect(files.remove).toHaveBeenCalledWith(files.save.mock.calls[0]?.[0]);
  });

  it('removes the saved file when the database insert fails', async () => {
    const image = (await solid(2, 2).jpeg().toBuffer()).toString('base64');
    const prisma = {
      progressPhoto: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockRejectedValue(new Error('insert failed')),
      },
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(
      async (work: (tx: typeof prisma) => unknown) => work(prisma),
    );
    const files = storage();
    const service = new UsersService(
      prisma as never,
      {} as never,
      {} as never,
      files,
    );

    await expect(service.createProgressPhoto(userId, image)).rejects.toThrow(
      'insert failed',
    );
    expect(files.remove).toHaveBeenCalledWith(files.save.mock.calls[0]?.[0]);
  });

  it('deletes the row before the file and still succeeds if the file is already gone', async () => {
    const photoId = '22222222-2222-4222-8222-222222222222';
    const prisma = {
      progressPhoto: {
        findFirst: vi.fn().mockResolvedValue({
          id: photoId,
          storageKey: `${userId}/${photoId}.jpg`,
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
    };
    const files = storage();
    const order: string[] = [];
    prisma.progressPhoto.delete.mockImplementation(async () => {
      order.push('delete');
    });
    files.remove.mockImplementation(async () => {
      order.push('remove');
      throw new Error('disk');
    });
    const service = new UsersService(
      prisma as never,
      {} as never,
      {} as never,
      files,
    );

    await expect(
      service.deleteProgressPhoto(userId, photoId),
    ).resolves.toBeUndefined();
    expect(order).toEqual(['delete', 'remove']);
  });
});

describe('LocalProgressPhotoStorage', () => {
  it('stores a generated key and rejects a path outside the directory', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'photo-store-'));
    const storage = new LocalProgressPhotoStorage({
      get: () => root,
    } as never);
    const key =
      '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg';

    await storage.save(key, Buffer.from([0xff, 0xd8]));
    expect(await storage.read(key)).toEqual(Buffer.from([0xff, 0xd8]));
    expect((await stat(path.join(root, key))).mode & 0o777).toBe(0o600);
    await storage.remove(key);
    expect(await storage.read(key)).toBeNull();
    await expect(
      storage.save('../outside.jpg', Buffer.from('no')),
    ).rejects.toThrow('Invalid progress photo key');
    expect(await readdir(path.join(root, key.split('/')[0]!))).toEqual([]);
  });
});
