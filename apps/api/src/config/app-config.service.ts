import { Injectable } from '@nestjs/common';
import { type AppEnvironment, validateEnvironment } from './env.js';
import { readProcessEnvironment } from './process-environment.js';

@Injectable()
export class AppConfigService {
  private readonly values = validateEnvironment(readProcessEnvironment());

  get<K extends keyof AppEnvironment>(key: K): AppEnvironment[K] {
    return this.values[key];
  }

  getOrThrow<K extends keyof AppEnvironment>(
    key: K,
  ): NonNullable<AppEnvironment[K]> {
    const value = this.values[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing required configuration: ${key}`);
    }
    return value;
  }
}
