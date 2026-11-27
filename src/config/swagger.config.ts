import { DocumentBuilder, SwaggerCustomOptions } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Creamy Cream Commerce API')
  .setDescription(
    'Business API. Obtain a short-lived RS256 access token directly from Accounts Service; send it as a Bearer token. Payments are handled by the centralized Payment Service.',
  )
  .setVersion('1.0')
  .addServer('../')
  .addBearerAuth(
    { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    'accessToken',
  )
  .build();

export const swaggerOptions: SwaggerCustomOptions = {
  jsonDocumentUrl: 'swagger/json',
  customSiteTitle: 'Creamy Cream API Documentation',
};
