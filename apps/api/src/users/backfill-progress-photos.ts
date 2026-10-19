import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { LocalProgressPhotoStorage } from './progress-photo-storage.js';

export type UnstoredProgressPhoto = {
  id: string;
  userId: string;
  image: Buffer;
};

type StoredPhoto = {
  id: string;
  storageKey: string;
  width: number;
  height: number;
};

/**
 * Copy each photo's Postgres bytes to storage, then record the key.
 * The image column is left in place. A failed save or a file that does not
 * read back the same bytes does not record a key, so the row can be retried.
 */
export async function backfillProgressPhotoBytes(
  photos: UnstoredProgressPhoto[],
  files: {
    save(key: string, body: Buffer): Promise<void>;
    read(key: string): Promise<Buffer | null>;
  },
  record: (photo: StoredPhoto) => Promise<void>,
): Promise<number> {
  let migrated = 0;
  for (const photo of photos) {
    const storageKey = `${photo.userId}/${photo.id}.jpg`;
    const meta = await sharp(photo.image, { failOn: 'error' }).metadata();
    if (!meta.width || !meta.height) {
      throw new Error(`Progress photo ${photo.id} has no dimensions`);
    }
    await files.save(storageKey, photo.image);
    const stored = await files.read(storageKey);
    if (!stored || !stored.equals(photo.image)) {
      throw new Error(`Progress photo ${photo.id} was not stored`);
    }
    await record({
      id: photo.id,
      storageKey,
      width: meta.width,
      height: meta.height,
    });
    migrated += 1;
  }
  return migrated;
}

export async function backfillStoredProgressPhotos(
  prisma: PrismaClient,
  files: {
    save(key: string, body: Buffer): Promise<void>;
    read(key: string): Promise<Buffer | null>;
  },
): Promise<number> {
  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'progress_photos'
      AND column_name IN ('image', 'storage_key')
  `;
  const names = new Set(columns.map((column) => column.column_name));
  if (!names.has('image')) return 0;
  if (!names.has('storage_key')) {
    throw new Error(
      'Apply the progress photo file migration before copying photo bytes.',
    );
  }

  const rows = await prisma.$queryRaw<
    { id: string; userId: string; image: Buffer }[]
  >`
    SELECT id, user_id AS "userId", image
    FROM progress_photos
    WHERE storage_key IS NULL
  `;

  return backfillProgressPhotoBytes(
    rows.map((row) => ({ ...row, image: Buffer.from(row.image) })),
    files,
    async (photo) => {
      await prisma.$executeRaw`
        UPDATE progress_photos
        SET storage_key = ${photo.storageKey},
            width = ${photo.width},
            height = ${photo.height}
        WHERE id = CAST(${photo.id} AS uuid)
          AND storage_key IS NULL
      `;
    },
  );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const files = new LocalProgressPhotoStorage({
      get: (key: string) => process.env[key],
    } as never);
    const migrated = await backfillStoredProgressPhotos(prisma, files);
    console.log(`Copied ${migrated} progress photo(s) to storage.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Progress photo backfill failed',
    );
    process.exitCode = 1;
  });
}
