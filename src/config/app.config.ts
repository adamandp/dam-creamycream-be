import { SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { buildOpenApiDocument } from './openapi.config';
import { swaggerOptions } from './swagger.config';
import { AccountsConfig } from './accounts.config';
import helmet from 'helmet';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { Logger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';
export function configureApp(
  app: NestExpressApplication,
  options: { shutdownHooks?: boolean } = {},
) {
  const documentFactory = () => buildOpenApiDocument(app);
  // An explicit document filename avoids trailing-slash normalization by proxies
  // and scopes browser Basic credentials to the docs directory, not the API root.
  app
    .getHttpAdapter()
    .get('/docs', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.endsWith('/')) return next();
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(303, 'docs/index.html');
    });
  if (process.env.NODE_ENV === 'production') {
    const expected = Buffer.from(
      (process.env.DOCS_USERNAME ?? '') +
        ':' +
        (process.env.DOCS_PASSWORD ?? ''),
    );
    app.use(
      ['/docs', '/swagger/json', '/docs-yaml'],
      (req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Cache-Control', 'private, no-store');
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
          return res
            .status(401)
            .type('text/plain')
            .send('Authentication required for API documentation.');
        }
        next();
      },
    );
  }
  app
    .getHttpAdapter()
    .get('/docs/index.html', (_req: Request, res: Response) => {
      res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Creamy Cream API Documentation</title><link rel="stylesheet" href="./swagger-ui.css"><link rel="icon" href="./favicon-32x32.png"></head><body><div id="swagger-ui"></div><script src="./swagger-ui-bundle.js"></script><script src="./swagger-ui-standalone-preset.js"></script><script src="./swagger-ui-init.js"></script></body></html>`);
    });
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
  if (options.shutdownHooks !== false) app.enableShutdownHooks();
}
