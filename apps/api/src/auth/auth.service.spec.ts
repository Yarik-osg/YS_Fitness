import { ConflictException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('hashed'),
  verify: vi.fn(),
}));

const secrets: Record<string, unknown> = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_DAYS: 30,
};

const request = {
  get: () => 'vitest',
  ip: '127.0.0.1',
} as unknown as Request;

const input = {
  email: 'new@example.com',
  password: 'strong-password',
  clientType: 'WEB' as const,
};

function createService(options: { existing?: boolean } = {}) {
  const user = {
    id: 'user-1',
    email: input.email,
    role: 'CLIENT',
    profile: null,
  };
  const prisma = {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(options.existing ? { id: 'user-0' } : null),
      create: vi.fn().mockResolvedValue(user),
    },
  };
  const mail = { sendWelcome: vi.fn().mockResolvedValue(undefined) };
  const config = {
    get: (key: string) => secrets[key],
    getOrThrow: (key: string) => secrets[key],
  };
  const service = new AuthService(
    prisma as never,
    {} as never,
    config as never,
    mail as never,
  );
  const session = { user: { id: user.id } };
  vi.spyOn(
    service as unknown as { createSessionResponse: () => unknown },
    'createSessionResponse',
  ).mockResolvedValue(session);
  return { service, prisma, mail, session };
}

describe('AuthService.register welcome email', () => {
  it('sends the welcome email in the chosen language', async () => {
    const { service, mail, session } = createService();

    const result = await service.register({ ...input, locale: 'en' }, request);

    expect(result).toBe(session);
    expect(mail.sendWelcome).toHaveBeenCalledTimes(1);
    expect(mail.sendWelcome).toHaveBeenCalledWith('new@example.com', 'en');
  });

  it('passes no locale when the client did not send one', async () => {
    const { service, mail } = createService();

    await service.register(input, request);

    expect(mail.sendWelcome).toHaveBeenCalledWith('new@example.com', undefined);
  });

  it('does not wait for the email to be sent', async () => {
    const { service, mail, session } = createService();
    mail.sendWelcome.mockReturnValue(new Promise(() => undefined));

    await expect(service.register(input, request)).resolves.toBe(session);
  });

  it('sends nothing when the email is already registered', async () => {
    const { service, mail, prisma } = createService({ existing: true });

    await expect(service.register(input, request)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(mail.sendWelcome).not.toHaveBeenCalled();
  });
});
