import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AccountsConfig } from './accounts.config';
import { configureApp } from './app.config';

describe('Swagger reverse proxy routing', () => {
  it('redirects to protected index and serves relative assets', async () => {
    const previous = { ...process.env };
    Object.assign(process.env, {
      NODE_ENV: 'production',
      DOCS_USERNAME: 'fixture',
      DOCS_PASSWORD: 'fixture-password',
    });
    const module = await Test.createTestingModule({
      providers: [
        { provide: AccountsConfig, useValue: { origins: [] } },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
          },
        },
      ],
    }).compile();
    const app = module.createNestApplication<NestExpressApplication>();
    try {
      configureApp(app, { shutdownHooks: false });
      await app.init();
      const http = request(app.getHttpServer());
      await http.get('/docs').expect(303).expect('Location', 'docs/index.html');
      await http
        .get('/docs/index.html')
        .expect(401)
        .expect('WWW-Authenticate', /Basic/);
      const page = await http
        .get('/docs/index.html')
        .auth('fixture', 'fixture-password')
        .expect(200);
      expect(page.text).toContain('src="./swagger-ui-bundle.js"');
      expect(page.text).toContain('src="./swagger-ui-init.js"');
      for (const asset of [
        'swagger-ui.css',
        'swagger-ui-bundle.js',
        'swagger-ui-standalone-preset.js',
        'swagger-ui-init.js',
      ]) {
        await http.get('/docs/' + asset).expect(401);
        await http
          .get('/docs/' + asset)
          .auth('fixture', 'fixture-password')
          .expect(200);
      }
      const spec = await http
        .get('/swagger/json')
        .auth('fixture', 'fixture-password')
        .expect(200);
      expect(spec.body.servers[0].url).toBe('../');
      await http.get('/docs-yaml').expect(401);
    } finally {
      await app.close();
      for (const key of ['NODE_ENV', 'DOCS_USERNAME', 'DOCS_PASSWORD']) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  });
});
