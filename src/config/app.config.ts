import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApiDocument } from './openapi.config';
import { swaggerOptions } from './swagger.config';
import { AccountsConfig } from './accounts.config';
import helmet from 'helmet';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { Logger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';
export function configureApp(app: NestExpressApplication) {
  const documentFactory = () => buildOpenApiDocument(app);
  if (process.env.NODE_ENV === 'production') {
    const expected = Buffer.from(
      (process.env.DOCS_USERNAME ?? '') +
        ':' +
        (process.env.DOCS_PASSWORD ?? ''),
    );
    app.use(['/docs', '/swagger/json'], (req: any, res: any, next: any) => {
      const match = /^Basic ([A-Za-z0-9+/=]+)$/i.exec(
        req.headers.authorization ?? '',
      );
      const got = match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
      if (
        !process.env.DOCS_USERNAME ||
        !process.env.DOCS_PASSWORD ||
        got.length !== expected.length ||
        !timingSafeEqual(got, expected)
      ) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Commerce API docs"');
        return res.status(401).end();
      }
      next();
    });
  }
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
    allowedHeaders: 'Content-Type, Accept, Authorization, Idempotency-Key',
    credentials: false,
  });
  app.useLogger(app.get(Logger));
  app.disable('x-powered-by');
  const proxies = (process.env.TRUSTED_PROXY_IPS ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (proxies.some((ip) => !isIP(ip)))
    throw new Error('Invalid trusted proxy IP');
  if (proxies.length) app.set('trust proxy', proxies);
  app.useBodyParser('json', { limit: '2mb' });
  app.enableShutdownHooks();
}
