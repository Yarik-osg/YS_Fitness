import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from '../auth/roles.guard.js';
import { CoachController } from './coach.controller.js';

describe('CoachController export', () => {
  it('rejects a client on the excel export', () => {
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => CoachController.prototype.exportClient,
      getClass: () => CoachController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            sub: 'client-1',
            sessionId: 'session-1',
            role: UserRole.CLIENT,
          },
        }),
      }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(
      ForbiddenException,
    );
  });

  it('returns the client workbook as a named xlsx file', async () => {
    const clientWorkbook = vi.fn().mockResolvedValue({
      body: Buffer.from('xlsx'),
      filename: 'ys-fitness-client-2026-01-15.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const controller = new CoachController(
      {} as never,
      {} as never,
      { clientWorkbook } as never,
    );

    const file = await controller.exportClient({
      userId: '6d0f2d6e-3c1b-4a7e-9c2a-1b7e5a9d4c11',
    });

    expect(clientWorkbook).toHaveBeenCalledWith(
      '6d0f2d6e-3c1b-4a7e-9c2a-1b7e5a9d4c11',
    );
    expect(file.getHeaders().disposition).toBe(
      'attachment; filename="ys-fitness-client-2026-01-15.xlsx"',
    );
  });
});
