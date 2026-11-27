import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  startupFailureReason,
  validateProductionEnvironment,
} from './config/production.config';
import { configureApp } from './config/app.config';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  validateProductionEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    abortOnError: false,
  });
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error: unknown) => {
  console.error('Application startup failed:', startupFailureReason(error));
  process.exit(1);
});
