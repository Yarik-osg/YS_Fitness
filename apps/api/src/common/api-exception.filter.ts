import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorPayload {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = payload;
      } else {
        const body = payload as ErrorPayload;
        code = body.code ?? this.defaultCode(status);
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? exception.message);
        details = body.details;
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      status = HttpStatus.CONFLICT;
      code = 'RESOURCE_CONFLICT';
      message = 'A record with these values already exists';
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      ...(details === undefined ? {} : { details }),
    });
  }

  private defaultCode(status: number): string {
    return (HttpStatus[status]?.toString() ?? 'HTTP_ERROR').replaceAll(
      ' ',
      '_',
    );
  }
}
