import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { PrismaClientKnownRequestError } from '../generated/prisma/internal/prismaNamespace';
import { startCase } from 'lodash';

@Catch(PrismaClientKnownRequestError)
export class CommonFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(CommonFilter.name);
  }

  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const model = startCase(String(exception.meta?.modelName ?? 'Record'));
    if (exception.code === 'P2002') {
      res.status(409).json({
        statusCode: 409,
        message: model + ' already exists',
        error: 'Conflict',
      });
    } else if (exception.code === 'P2025') {
      res.status(404).json({
        statusCode: 404,
        message: model + ' not found',
        error: 'Not Found',
      });
    } else if (['P2003', 'P2004', 'P2034'].includes(exception.code)) {
      res.status(409).json({
        statusCode: 409,
        message: 'Related resource conflict',
        error: 'Conflict',
      });
    } else {
      this.logger.error({ code: exception.code }, 'Database request failed');
      res
        .status(500)
        .json({ statusCode: 500, message: 'Internal server error' });
    }
  }
}
