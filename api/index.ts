import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/app.config';
import { validateProductionEnvironment } from '../src/config/production.config';
import type { Request, Response } from 'express';
let server: Promise<NestExpressApplication> | undefined;
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  validateProductionEnvironment();
  configureApp(app);
  await app.init();
  return app;
}
export default async function handler(req: Request, res: Response) {
  try {
    const app = await (server ??= bootstrap().catch((e) => {
      server = undefined;
      throw e;
    }));
    app.getHttpAdapter().getInstance()(req, res);
  } catch {
    res.status(503).json({ message: 'Application unavailable' });
  }
}
