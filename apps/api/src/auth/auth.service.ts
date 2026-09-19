import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import { hash, verify } from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { AuthResponse, SafeUser } from '@repo/shared-types';
import type { LoginInput, RegisterInput } from '@repo/validation';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  tokenId: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
}

export interface IssuedAuthResponse extends AuthResponse {
  refreshToken: string;
  refreshMaxAgeMs: number;
}

type RotationResult =
  | {
      kind: 'success';
      user: User & {
        profile: { onboardingCompletedAt: Date | null } | null;
      };
      refreshToken: string;
    }
  | { kind: 'replay' }
  | { kind: 'invalid' };

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: AppConfigService,
  ) {
    this.accessSecret = config.getOrThrow('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow('JWT_REFRESH_SECRET');
    this.accessTtlSeconds = config.get('JWT_ACCESS_TTL_SECONDS');
    this.refreshTtlDays = config.get('JWT_REFRESH_TTL_DAYS');
  }

  async register(
    input: RegisterInput,
    request: Request,
  ): Promise<IssuedAuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await hash(input.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
        },
        include: { profile: true },
      });

      return this.createSessionResponse(user, {
        ...this.requestMetadata(request),
        deviceName: input.deviceName,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email already exists',
        });
      }
      throw error;
    }
  }

  async login(
    input: LoginInput,
    request: Request,
  ): Promise<IssuedAuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { profile: true },
    });

    if (
      !user ||
      !user.isActive ||
      !(await verify(user.passwordHash, input.password))
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      });
    }

    return this.createSessionResponse(user, {
      ...this.requestMetadata(request),
      deviceName: input.deviceName,
    });
  }

  async refresh(refreshToken: string): Promise<IssuedAuthResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = this.digest(refreshToken);
    const nextTokenId = randomUUID();

    const result = await this.prisma.$transaction<RotationResult>(
      async (transaction) => {
        const storedToken = await transaction.authRefreshToken.findUnique({
          where: { id: payload.tokenId },
          include: {
            session: {
              include: {
                user: { include: { profile: true } },
              },
            },
          },
        });

        if (
          !storedToken ||
          storedToken.tokenHash !== tokenHash ||
          storedToken.sessionId !== payload.sessionId ||
          storedToken.session.userId !== payload.sub
        ) {
          return { kind: 'invalid' };
        }

        if (storedToken.consumedAt) {
          const now = new Date();
          await transaction.authSession.update({
            where: { id: storedToken.sessionId },
            data: { revokedAt: now },
          });
          await transaction.authRefreshToken.updateMany({
            where: {
              sessionId: storedToken.sessionId,
              revokedAt: null,
            },
            data: { revokedAt: now },
          });
          return { kind: 'replay' };
        }

        if (
          storedToken.revokedAt ||
          storedToken.expiresAt <= new Date() ||
          storedToken.session.revokedAt ||
          storedToken.session.expiresAt <= new Date() ||
          !storedToken.session.user.isActive
        ) {
          return { kind: 'invalid' };
        }

        const consumed = await transaction.authRefreshToken.updateMany({
          where: {
            id: storedToken.id,
            consumedAt: null,
            revokedAt: null,
          },
          data: { consumedAt: new Date() },
        });

        if (consumed.count !== 1) {
          const now = new Date();
          await transaction.authSession.update({
            where: { id: storedToken.sessionId },
            data: { revokedAt: now },
          });
          await transaction.authRefreshToken.updateMany({
            where: {
              sessionId: storedToken.sessionId,
              revokedAt: null,
            },
            data: { revokedAt: now },
          });
          return { kind: 'replay' };
        }

        const nextRefreshToken = await this.signRefreshToken({
          sub: storedToken.session.userId,
          sessionId: storedToken.sessionId,
          tokenId: nextTokenId,
          type: 'refresh',
        });

        await transaction.authRefreshToken.create({
          data: {
            id: nextTokenId,
            sessionId: storedToken.sessionId,
            tokenHash: this.digest(nextRefreshToken),
            expiresAt: storedToken.session.expiresAt,
          },
        });

        return {
          kind: 'success',
          user: storedToken.session.user,
          refreshToken: nextRefreshToken,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === 'replay') {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: 'Refresh token reuse was detected; the session was revoked',
      });
    }

    if (result.kind === 'invalid') {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }

    return this.buildResponse(
      result.user,
      payload.sessionId,
      result.refreshToken,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const storedToken = await this.prisma.authRefreshToken.findUnique({
      where: { id: payload.tokenId },
    });

    if (
      !storedToken ||
      storedToken.sessionId !== payload.sessionId ||
      storedToken.tokenHash !== this.digest(refreshToken)
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid',
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authSession.update({
        where: { id: payload.sessionId },
        data: { revokedAt: now },
      }),
      this.prisma.authRefreshToken.updateMany({
        where: { sessionId: payload.sessionId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  private async createSessionResponse(
    user: User & {
      profile: { onboardingCompletedAt: Date | null } | null;
    },
    metadata: SessionMetadata,
  ): Promise<IssuedAuthResponse> {
    const sessionExpiresAt = this.refreshExpiry();
    const tokenId = randomUUID();

    const { sessionId, refreshToken } = await this.prisma.$transaction(
      async (transaction) => {
        const session = await transaction.authSession.create({
          data: {
            userId: user.id,
            expiresAt: sessionExpiresAt,
            ...metadata,
          },
        });

        const token = await this.signRefreshToken({
          sub: user.id,
          sessionId: session.id,
          tokenId,
          type: 'refresh',
        });

        await transaction.authRefreshToken.create({
          data: {
            id: tokenId,
            sessionId: session.id,
            tokenHash: this.digest(token),
            expiresAt: sessionExpiresAt,
          },
        });

        return { sessionId: session.id, refreshToken: token };
      },
    );

    return this.buildResponse(user, sessionId, refreshToken);
  }

  private async buildResponse(
    user: User & {
      profile: { onboardingCompletedAt: Date | null } | null;
    },
    sessionId: string,
    refreshToken: string,
  ): Promise<IssuedAuthResponse> {
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        sessionId,
        role: user.role,
      },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
      },
    );

    return {
      user: this.safeUser(user),
      tokens: {
        accessToken,
        expiresIn: this.accessTtlSeconds,
      },
      refreshToken,
      refreshMaxAgeMs: this.refreshTtlDays * 24 * 60 * 60 * 1000,
    };
  }

  private safeUser(
    user: User & {
      profile: { onboardingCompletedAt: Date | null } | null;
    },
  ): SafeUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      onboardingCompletedAt:
        user.profile?.onboardingCompletedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async signRefreshToken(
    payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>,
  ): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtlDays * 24 * 60 * 60,
    });
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
      });

      if (
        payload.type !== 'refresh' ||
        !payload.sub ||
        !payload.sessionId ||
        !payload.tokenId
      ) {
        throw new Error('Invalid refresh payload');
      }

      return payload;
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }
  }

  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);
  }

  private requestMetadata(request: Request): SessionMetadata {
    return {
      userAgent: request.get('user-agent')?.slice(0, 500),
      ipAddress: request.ip?.slice(0, 45),
    };
  }
}
