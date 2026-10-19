import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { backfillProgressPhotoBytes } from './backfill-progress-photos.js';

const migrations = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../prisma/migrations',
);

function migration(name: string) {
  return readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8');
}

describe('progress photo file migration', () => {
  const prepare = migration('20261019210000_progress_photo_files');
  const finish = migration('20261019220000_progress_photo_require_files');

  it('does not delete photo rows while adding a place for the file key', () => {
    expect(prepare).not.toMatch(/DELETE\s+FROM/i);
    expect(prepare).not.toMatch(/DROP\s+COLUMN/i);
    expect(prepare).toMatch(/ADD COLUMN "storage_key" VARCHAR\(96\)/i);
    expect(prepare).not.toMatch(/storage_key" VARCHAR\(96\) NOT NULL/i);
  });

  it('drops image bytes only after refusing rows that have no stored file', () => {
    expect(finish).not.toMatch(/DELETE\s+FROM/i);
    expect(finish.indexOf('RAISE EXCEPTION')).toBeGreaterThan(-1);
    expect(finish.indexOf('RAISE EXCEPTION')).toBeLessThan(
      finish.indexOf('DROP COLUMN image'),
    );
    expect(finish).toMatch(/storage_key IS NULL/);
    expect(finish).toMatch(/IF NOT EXISTS/);
  });
});

describe('backfillProgressPhotoBytes', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const photoId = '22222222-2222-4222-8222-222222222222';

  async function jpeg() {
    return sharp({
      create: {
        width: 2,
        height: 3,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .jpeg()
      .toBuffer();
  }

  it('records a key only after the stored file matches the original bytes', async () => {
    const image = await jpeg();
    const saved = new Map<string, Buffer>();
    const record = vi.fn().mockResolvedValue(undefined);

    const migrated = await backfillProgressPhotoBytes(
      [{ id: photoId, userId, image }],
      {
        save: async (key, body) => {
          saved.set(key, Buffer.from(body));
        },
        read: async (key) => saved.get(key) ?? null,
      },
      record,
    );

    expect(migrated).toBe(1);
    expect(record).toHaveBeenCalledWith({
      id: photoId,
      storageKey: `${userId}/${photoId}.jpg`,
      width: 2,
      height: 3,
    });
  });

  it('leaves the original row unrecorded when the file cannot be saved or read back', async () => {
    const image = await jpeg();
    const record = vi.fn().mockResolvedValue(undefined);

    await expect(
      backfillProgressPhotoBytes(
        [{ id: photoId, userId, image }],
        {
          save: async () => {
            throw new Error('disk full');
          },
          read: async () => image,
        },
        record,
      ),
    ).rejects.toThrow('disk full');

    await expect(
      backfillProgressPhotoBytes(
        [{ id: photoId, userId, image }],
        {
          save: async () => undefined,
          read: async () => Buffer.from('different'),
        },
        record,
      ),
    ).rejects.toThrow('was not stored');
    expect(record).not.toHaveBeenCalled();
  });

  it('does not invent a second file when the metadata write fails and the copy is retried', async () => {
    const image = await jpeg();
    const keys: string[] = [];
    let failRecord = true;
    const record = vi.fn(async () => {
      if (failRecord) throw new Error('metadata');
    });
    const files = {
      save: async (key: string) => {
        keys.push(key);
      },
      read: async () => image,
    };

    await expect(
      backfillProgressPhotoBytes(
        [{ id: photoId, userId, image }],
        files,
        record,
      ),
    ).rejects.toThrow('metadata');
    failRecord = false;
    await expect(
      backfillProgressPhotoBytes(
        [{ id: photoId, userId, image }],
        files,
        record,
      ),
    ).resolves.toBe(1);
    expect(keys).toEqual([
      `${userId}/${photoId}.jpg`,
      `${userId}/${photoId}.jpg`,
    ]);
  });
});
