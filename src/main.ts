import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateProductionEnvironment } from './config/production.config';
import { configureApp } from './config/app.config';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  validateProductionEnvironment();
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(() => {
  console.error(
    'Application startup failed; check configuration and service connectivity.',
  );
  process.exit(1);
});
