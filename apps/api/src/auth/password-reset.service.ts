import { BadRequestException, Injectable } from '@nestjs/common';
import { hash } from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { ForgotPasswordInput, ResetPasswordInput } from '@repo/validation';
import { MailService } from '../mail/mail.service.js';
import { PASSWORD_RESET_TTL_MINUTES } from '../mail/password-emails.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** A second link cannot be requested for the same account within this window. */
export const RESET_REQUEST_COOLDOWN_MS = 60_000;

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Emails a reset link when the account exists. It returns the same way for
   * unknown, inactive, and rate-limited accounts so the answer reveals nothing.
   */
  async requestReset(input: ForgotPasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) return;

    const now = new Date();
    const recent = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(now.getTime() - RESET_REQUEST_COOLDOWN_MS) },
      },
      select: { id: true },
    });
    if (recent) return;

    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.digest(token),
          expiresAt: new Date(
            now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000,
          ),
        },
      }),
    ]);

    // Fire and forget: sendPasswordReset never rejects.
    void this.mail.sendPasswordReset(user.email, token, input.locale);
  }

  /** Spends the token, sets the password, and signs the user out everywhere. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.digest(input.token) },
      include: { user: { select: { email: true, isActive: true } } },
    });
    const now = new Date();
    if (
      !stored ||
      stored.usedAt ||
      stored.expiresAt <= now ||
      !stored.user.isActive
    ) {
      throw this.invalidToken();
    }

    const passwordHash = await hash(input.password);

    await this.prisma.$transaction(async (transaction) => {
      // Claiming the token first makes a concurrent second use fail.
      const claimed = await transaction.passwordResetToken.updateMany({
        where: { id: stored.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw this.invalidToken();

      await transaction.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      });
      await transaction.passwordResetToken.deleteMany({
        where: { userId: stored.userId, id: { not: stored.id } },
      });
      await transaction.authSession.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.authRefreshToken.updateMany({
        where: { session: { userId: stored.userId }, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    // Fire and forget: sendPasswordChanged never rejects.
    void this.mail.sendPasswordChanged(stored.user.email, input.locale);
  }

  private invalidToken(): BadRequestException {
    return new BadRequestException({
      code: 'RESET_TOKEN_INVALID',
      message: 'This reset link is invalid or has expired',
    });
  }

  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
