import { INestApplication, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type {
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  SchemaObject,
} from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { PUBLIC, ROLES, PERMISSIONS } from '../decorators/access.decorator';
import { swaggerConfig } from './swagger.config';
import responseContracts from './openapi.contracts.json';

interface OperationContract {
  schema: SchemaObject;
  errors: Record<string, string>;
  request?: RequestBodyObject;
  description?: string;
}

// Documentation-only contracts, derived from actual service return expressions
// (not from legacy WebResponse<unknown> controller annotations).
const contracts = responseContracts as unknown as Record<
  string,
  OperationContract
>;

const errorSchema: SchemaObject = {
  type: 'object',
  required: ['statusCode', 'message'],
  properties: {
    statusCode: { type: 'integer' },
    message: {
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
    error: { type: 'string' },
    errors: {
      type: 'array',
      description: 'Structured Zod validation issues, when present.',
      items: { type: 'object', additionalProperties: true },
    },
  },
};
const errorExamples: Record<string, string> = {
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'Resource not found',
  '409': 'Conflict',
  '413': 'Payload Too Large',
  '429': 'Too many requests',
  '500': 'Internal server error',
  '502': 'Bad Gateway',
  '503': 'Service unavailable',
};

function completeResponse(op: OperationObject, contract: OperationContract) {
  for (const [status, response] of Object.entries(op.responses)) {
    if (
      !response ||
      !status.startsWith('2') ||
      '$ref' in response ||
      status === '204'
    )
      continue;
    // Keep Terminus' detailed health metadata when it matches the actual handler.
    if (op.operationId === 'HealthController_check' && response.content)
      continue;
    response.description ||=
      status === '201' ? 'Created successfully' : 'Successful response';
    response.content = { 'application/json': { schema: contract.schema } };
  }

  for (const [status, description] of Object.entries(contract.errors)) {
    const existing = op.responses[status];
    if (existing && '$ref' in existing) continue;
    op.responses[status] = {
      ...existing,
      description: existing?.description || description,
      content: existing?.content ?? {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponse' },
          example: {
            statusCode: Number(status),
            message: errorExamples[status] || description,
          },
        },
      },
    };
  }

  if (contract.request) op.requestBody = contract.request;
  if (contract.description) op.description = contract.description;
}

// Zod 4 emits numeric exclusive bounds in JSON Schema. OpenAPI 3.0 uses
// a boolean exclusiveMinimum/exclusiveMaximum alongside minimum/maximum.
function normalizeOpenApi30(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach(normalizeOpenApi30);
    return;
  }
  const node = value as Record<string, unknown>;
  for (const [exclusive, bound] of [
    ['exclusiveMinimum', 'minimum'],
    ['exclusiveMaximum', 'maximum'],
  ]) {
    if (typeof node[exclusive] === 'number') {
      node[bound] = node[exclusive];
      node[exclusive] = true;
    }
  }
  Object.values(node).forEach(normalizeOpenApi30);
}

export function buildOpenApiDocument(app: INestApplication) {
  const doc = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, swaggerConfig, {
      autoTagControllers: true,
    }),
  );
  doc.components ??= {};
  doc.components.schemas ??= {};
  doc.components.schemas.ApiErrorResponse = errorSchema;
  doc.components.securitySchemes ??= {};
  Object.assign(doc.components.securitySchemes, {
    paymentWebhookSignature: {
      type: 'apiKey',
      in: 'header',
      name: 'X-Webhook-Signature',
      description:
        'Payment Service HMAC-SHA256 signature. Timestamp and event ID are also required. Not a user JWT.',
    },
    qstashSignature: {
      type: 'apiKey',
      in: 'header',
      name: 'Upstash-Signature',
      description:
        'Upstash-signed JWT over the destination and raw request body.',
    },
  });

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
        const webhook = path === '/payments/webhook';
        const qstash = [
          '/payments/expire-checkout',
          '/payments/reconcile',
        ].includes(path);
        op.security = webhook
          ? [{ paymentWebhookSignature: [] }]
          : qstash
            ? [{ qstashSignature: [] }]
            : pub
              ? []
              : [{ accessToken: [] }];
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

        for (const param of op.parameters ?? []) {
          if ('$ref' in param) continue;
          const parameter = param as ParameterObject;
          // Every path parameter except this legacy product-discounts route
          // is validated with ParseUUIDPipe in the controller.
          if (
            parameter.in === 'path' &&
            path !== '/product-discounts/product/{productId}'
          ) {
            parameter.schema = { type: 'string', format: 'uuid' };
          }
          if (
            path === '/shipments/destinations/search' &&
            parameter.name === 'q'
          ) {
            parameter.schema = { type: 'string', minLength: 3, maxLength: 100 };
            parameter.description =
              'Search text; validated after trimming whitespace.';
          }
          if (
            webhook &&
            parameter.name.toLowerCase() === 'x-webhook-event-id'
          ) {
            parameter.schema = { type: 'string', format: 'uuid' };
          }
          if (
            webhook &&
            parameter.name.toLowerCase() === 'x-webhook-timestamp'
          ) {
            parameter.description =
              'Unix seconds, within 300 seconds of server time.';
            parameter.schema = { type: 'string', pattern: '^[0-9]+$' };
          }
          if (
            webhook &&
            parameter.name.toLowerCase() === 'x-webhook-signature'
          ) {
            parameter.schema = { type: 'string', pattern: '^[a-fA-F0-9]{64}$' };
          }
        }
        const contract = op.operationId && contracts[op.operationId];
        if (contract) completeResponse(op, contract);
      }
    }
  }
  normalizeOpenApi30(doc);
  return doc;
}
