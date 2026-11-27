import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/app.config';
import {
  startupFailureReason,
  validateProductionEnvironment,
} from '../src/config/production.config';
import type { Request, Response } from 'express';
let server: Promise<NestExpressApplication> | undefined;
async function bootstrap() {
  validateProductionEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    abortOnError: false,
  });
  try {
    configureApp(app, { shutdownHooks: false });
    await app.init();
    return app;
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}
export default async function handler(req: Request, res: Response) {
  try {
    const app = await (server ??= bootstrap().catch((e) => {
      server = undefined;
      throw e;
    }));
    app.getHttpAdapter().getInstance()(req, res);
  } catch (error) {
    console.error('Application startup failed:', startupFailureReason(error));
    res.status(503).json({ message: 'Application unavailable' });
  }
}
