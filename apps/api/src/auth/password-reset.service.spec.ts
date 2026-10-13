import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PasswordResetService,
  RESET_REQUEST_COOLDOWN_MS,
} from './password-reset.service.js';

vi.mock('argon2', () => ({
  hash: vi.fn(async (password: string) => `hashed:${password}`),
}));

interface TokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const NOW = new Date('2026-10-13T12:00:00.000Z');
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

function createService() {
  const users = [
    {
      id: 'u1',
      email: 'olena@example.com',
      isActive: true,
      passwordHash: 'old',
    },
    {
      id: 'u2',
      email: 'off@example.com',
      isActive: false,
      passwordHash: 'old',
    },
  ];
  const tokens: TokenRow[] = [];
  const sessions = [
    { id: 's1', userId: 'u1', revokedAt: null as Date | null },
    { id: 's2', userId: 'u1', revokedAt: null as Date | null },
    { id: 's3', userId: 'u3', revokedAt: null as Date | null },
  ];
  const refreshTokens = [
    { id: 'r1', sessionId: 's1', revokedAt: null as Date | null },
    { id: 'r2', sessionId: 's2', revokedAt: null as Date | null },
    { id: 'r3', sessionId: 's3', revokedAt: null as Date | null },
  ];
  let nextId = 1;

  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        const user = users.find((entry) => entry.email === where.email);
        return user ? { ...user } : null;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { passwordHash: string };
        }) => {
          Object.assign(
            users.find((entry) => entry.id === where.id)!,
            data,
          );
        },
      ),
    },
    passwordResetToken: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; createdAt: { gt: Date } };
        }) =>
          tokens.find(
            (row) =>
              row.userId === where.userId && row.createdAt > where.createdAt.gt,
          ) ?? null,
      ),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const row = tokens.find((entry) => entry.tokenHash === where.tokenHash);
        if (!row) return null;
        return { ...row, user: users.find((user) => user.id === row.userId) };
      }),
      deleteMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; usedAt?: null; id?: { not: string } };
        }) => {
          let removed = 0;
          for (let index = tokens.length - 1; index >= 0; index -= 1) {
            const row = tokens[index]!;
            if (
              row.userId === where.userId &&
              (where.usedAt === undefined || row.usedAt === null) &&
              (!where.id || row.id !== where.id.not)
            ) {
              tokens.splice(index, 1);
              removed += 1;
            }
          }
          return { count: removed };
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: Omit<TokenRow, 'id' | 'usedAt' | 'createdAt'>;
        }) => {
          tokens.push({
            ...data,
            id: `t${nextId++}`,
            usedAt: null,
            createdAt: new Date(),
          });
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; usedAt: null; expiresAt: { gt: Date } };
          data: { usedAt: Date };
        }) => {
          const row = tokens.find(
            (entry) =>
              entry.id === where.id &&
              entry.usedAt === null &&
              entry.expiresAt > where.expiresAt.gt,
          );
          if (!row) return { count: 0 };
          row.usedAt = data.usedAt;
          return { count: 1 };
        },
      ),
    },
    authSession: {
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { userId: string };
          data: { revokedAt: Date };
        }) => {
          for (const session of sessions) {
            if (session.userId === where.userId && !session.revokedAt) {
              session.revokedAt = data.revokedAt;
            }
          }
        },
      ),
    },
    authRefreshToken: {
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { session: { userId: string } };
          data: { revokedAt: Date };
        }) => {
          for (const token of refreshTokens) {
            const session = sessions.find(
              (entry) => entry.id === token.sessionId,
            );
            if (session?.userId === where.session.userId && !token.revokedAt) {
              token.revokedAt = data.revokedAt;
            }
          }
        },
      ),
    },
    $transaction: vi.fn(async (work: unknown) =>
      Array.isArray(work)
        ? Promise.all(work)
        : (work as (transaction: unknown) => Promise<unknown>)(prisma),
    ),
  };
  const mail = {
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    sendPasswordChanged: vi.fn().mockResolvedValue(undefined),
  };
  const service = new PasswordResetService(prisma as never, mail as never);
  return { service, prisma, mail, users, tokens, sessions, refreshTokens };
}

describe('PasswordResetService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('requestReset', () => {
    it('stores only the token hash and mails the raw token for 30 minutes', async () => {
      const { service, tokens, mail } = createService();

      await service.requestReset({ email: 'olena@example.com', locale: 'en' });

      const rawToken = mail.sendPasswordReset.mock.calls[0]![1] as string;
      expect(mail.sendPasswordReset).toHaveBeenCalledWith(
        'olena@example.com',
        rawToken,
        'en',
      );
      expect(rawToken.length).toBeGreaterThanOrEqual(32);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.tokenHash).toBe(sha(rawToken));
      expect(JSON.stringify(tokens)).not.toContain(rawToken);
      expect(tokens[0]!.expiresAt.getTime() - NOW.getTime()).toBe(30 * 60_000);
    });

    it('does nothing, and nothing different, for unknown and inactive emails', async () => {
      const { service, tokens, mail } = createService();

      await expect(
        service.requestReset({ email: 'nobody@example.com' }),
      ).resolves.toBeUndefined();
      await expect(
        service.requestReset({ email: 'off@example.com' }),
      ).resolves.toBeUndefined();

      expect(tokens).toHaveLength(0);
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('sends one link per minute and replaces the earlier unused one afterwards', async () => {
      const { service, tokens, mail } = createService();

      await service.requestReset({ email: 'olena@example.com' });
      await service.requestReset({ email: 'olena@example.com' });
      expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);

      vi.setSystemTime(new Date(NOW.getTime() + RESET_REQUEST_COOLDOWN_MS + 1));
      await service.requestReset({ email: 'olena@example.com' });

      expect(mail.sendPasswordReset).toHaveBeenCalledTimes(2);
      expect(tokens).toHaveLength(1);
      const [first, second] = mail.sendPasswordReset.mock.calls.map(
        (call) => call[1] as string,
      );
      expect(tokens[0]!.tokenHash).toBe(sha(second!));
      expect(tokens[0]!.tokenHash).not.toBe(sha(first!));
    });
  });

  describe('resetPassword', () => {
    async function issue(context: ReturnType<typeof createService>) {
      await context.service.requestReset({ email: 'olena@example.com' });
      return context.mail.sendPasswordReset.mock.calls[0]![1] as string;
    }

    it('sets the password, spends the token, and signs out every session', async () => {
      const context = createService();
      const token = await issue(context);

      await context.service.resetPassword({
        token,
        password: 'brand-new-pass',
        locale: 'en',
      });

      expect(context.users[0]!.passwordHash).toBe('hashed:brand-new-pass');
      expect(context.tokens[0]!.usedAt).toEqual(NOW);
      const [olena1, olena2, other] = context.sessions;
      expect(olena1!.revokedAt).toEqual(NOW);
      expect(olena2!.revokedAt).toEqual(NOW);
      expect(other!.revokedAt).toBeNull();
      expect(context.refreshTokens.map((row) => row.revokedAt)).toEqual([
        NOW,
        NOW,
        null,
      ]);
      expect(context.mail.sendPasswordChanged).toHaveBeenCalledWith(
        'olena@example.com',
        'en',
      );
    });

    it('rejects a token that was already used', async () => {
      const context = createService();
      const token = await issue(context);
      await context.service.resetPassword({
        token,
        password: 'first-new-pass',
      });

      await expect(
        context.service.resetPassword({ token, password: 'second-new-pass' }),
      ).rejects.toMatchObject({
        response: { code: 'RESET_TOKEN_INVALID' },
      });
      expect(context.users[0]!.passwordHash).toBe('hashed:first-new-pass');
      expect(context.mail.sendPasswordChanged).toHaveBeenCalledTimes(1);
    });

    it('rejects an expired token without changing anything', async () => {
      const context = createService();
      const token = await issue(context);
      vi.setSystemTime(new Date(NOW.getTime() + 30 * 60_000 + 1));

      await expect(
        context.service.resetPassword({ token, password: 'brand-new-pass' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(context.users[0]!.passwordHash).toBe('old');
      expect(context.sessions[0]!.revokedAt).toBeNull();
    });

    it('rejects an unknown token', async () => {
      const context = createService();

      await expect(
        context.service.resetPassword({
          token: 'x'.repeat(43),
          password: 'brand-new-pass',
        }),
      ).rejects.toMatchObject({ response: { code: 'RESET_TOKEN_INVALID' } });
      expect(context.mail.sendPasswordChanged).not.toHaveBeenCalled();
    });

    it('rejects the loser of two simultaneous resets', async () => {
      const context = createService();
      const token = await issue(context);

      const results = await Promise.allSettled([
        context.service.resetPassword({ token, password: 'winner-password' }),
        context.service.resetPassword({ token, password: 'loser-password' }),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      expect(context.mail.sendPasswordChanged).toHaveBeenCalledTimes(1);
    });

    it('rejects the link of an account that was deactivated meanwhile', async () => {
      const context = createService();
      const token = await issue(context);
      context.users[0]!.isActive = false;

      await expect(
        context.service.resetPassword({ token, password: 'brand-new-pass' }),
      ).rejects.toMatchObject({ response: { code: 'RESET_TOKEN_INVALID' } });
    });
  });
});
