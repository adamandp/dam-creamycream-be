import { INestApplication, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { PUBLIC, ROLES, PERMISSIONS } from '../decorators/access.decorator';
import { swaggerConfig } from './swagger.config';

// Derive the security contract from the same runtime metadata consumed by the guards.
export function buildOpenApiDocument(app: INestApplication) {
  const doc = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, swaggerConfig, {
      autoTagControllers: true,
    }),
  );
  for (const module of app.get(ModulesContainer).values()) {
    for (const { metatype } of module.controllers.values()) {
      if (!metatype) continue;
      const base = Reflect.getMetadata(PATH_METADATA, metatype);
      for (const name of Object.getOwnPropertyNames(metatype.prototype)) {
        const handler = metatype.prototype[name];
        if (typeof handler !== 'function') continue;
        const route = Reflect.getMetadata(PATH_METADATA, handler);
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (
          typeof base !== 'string' ||
          typeof route !== 'string' ||
          method === undefined
        )
          continue;
        const path =
          '/' +
          [base, route]
            .join('/')
            .split('/')
            .filter(Boolean)
            .join('/')
            .replace(/:([A-Za-z0-9_]+)/g, '{$1}');
        const op =
          doc.paths[path]?.[RequestMethod[method].toLowerCase() as 'get'];
        if (!op) continue;
        const pub =
          Reflect.getMetadata(PUBLIC, handler) ??
          Reflect.getMetadata(PUBLIC, metatype);
        const roles =
          Reflect.getMetadata(ROLES, handler) ??
          Reflect.getMetadata(ROLES, metatype) ??
          [];
        op.security = pub ? [] : [{ accessToken: [] }];
        Object.assign(op, {
          'x-required-roles': pub ? [] : roles,
          'x-required-permissions': pub
            ? []
            : (Reflect.getMetadata(PERMISSIONS, handler) ??
              Reflect.getMetadata(PERMISSIONS, metatype) ??
              []),
        });
        if (!pub) {
          op.responses['401'] ??= {
            description: 'Missing, expired or invalid access token',
          };
          op.responses['403'] ??= { description: 'Role or permission denied' };
        }
        op.responses['429'] ??= { description: 'Rate limit exceeded' };
      }
    }
  }
  return doc;
}
