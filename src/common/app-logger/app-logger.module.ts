import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { Request, Response } from 'express';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('NODE_ENV') !== 'production';

        return {
          pinoHttp: {
            level:
              config.get<string>('LOG_LEVEL') ?? (isDev ? 'debug' : 'info'),
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  level: 'trace',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : {
                  targets: [
                    {
                      target: 'pino/file',
                      level: 'error',
                      options: {
                        destination: './logs/error.log',
                        mkdir: true,
                      },
                    },
                    {
                      target: 'pino/file',
                      level: 'warn',
                      options: {
                        destination: './logs/warn.log',
                        mkdir: true,
                      },
                    },
                    {
                      target: 'pino/file',
                      level: 'info',
                      options: {
                        destination: './logs/info.log',
                        mkdir: true,
                      },
                    },
                  ],
                },
            autoLogging: true,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers[\"set-cookie\"]',
                'password',
                'accessToken',
                'refreshToken',
              ],
              censor: '[REDACTED]',
            },
            serializers: {
              req(req: Request) {
                return {
                  method: req.method,
                  url: req.url?.split('?')[0],
                };
              },
              err(err: Error & { statusCode?: number }) {
                return { type: err.name, statusCode: err.statusCode };
              },
              res(res: Response) {
                return { statusCode: res.statusCode };
              },
            },
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}
