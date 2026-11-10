import {
  BadRequestException,
  Injectable,
  PipeTransform,
  type ArgumentMetadata,
} from '@nestjs/common';
import { type ZodType, ZodError, treeifyError } from 'zod';

type ZodDtoConstructor = {
  schema?: ZodType;
};

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = (metadata.metatype as ZodDtoConstructor | undefined)?.schema;

    if (!schema) {
      return value;
    }

    try {
      return schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const onlyBarcode =
          error.issues.length > 0 &&
          error.issues.every((issue) => issue.path[0] === 'barcode');
        throw new BadRequestException({
          code: onlyBarcode ? 'INVALID_BARCODE' : 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: treeifyError(error),
        });
      }

      throw error;
    }
  }
}
