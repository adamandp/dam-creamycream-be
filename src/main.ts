import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig, swaggerOptions } from './config/swagger.config';
import { AccountsConfig } from './config/accounts.config';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = app.get(Logger);

  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig);
  if (process.env.NODE_ENV !== 'production')
    SwaggerModule.setup('docs', app, documentFactory, swaggerOptions);
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  const config = app.get(AccountsConfig);

  app.enableCors({
    origin: config.origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });
  app.useLogger(logger);
  app.useBodyParser('json', { limit: '2mb' });
  app.use(cookieParser());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((e) => {
  console.error(
    'Application startup failed; check configuration and service connectivity.',
  );
  process.exit(1);
});
