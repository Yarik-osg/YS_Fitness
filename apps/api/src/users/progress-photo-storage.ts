import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';

export interface ProgressPhotoStorage {
  save(key: string, body: Buffer): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

/**
 * Local disk for development. The database stores `storageKey`, never an
 * absolute path. A later object-storage adapter can implement the same three
 * methods and leave the photo service unchanged.
 */
@Injectable()
export class LocalProgressPhotoStorage implements ProgressPhotoStorage {
  private readonly root: string;

  constructor(config: AppConfigService) {
    this.root = path.resolve(
      config.get('PROGRESS_PHOTO_DIR') ??
        path.join(process.cwd(), 'storage', 'progress-photos'),
    );
  }

  async save(key: string, body: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, body, { mode: 0o600 });
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  private resolve(key: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i.test(
        key,
      )
    ) {
      throw new Error('Invalid progress photo key');
    }
    const root = path.resolve(this.root);
    const file = path.resolve(root, key);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid progress photo key');
    }
    return file;
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
