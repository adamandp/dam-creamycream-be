import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { z } from 'zod';
import { AccountsConfig } from '../config/accounts.config';
import { PUBLIC } from '../decorators/access.decorator';
import { JwtPayload } from '../integrations/accounts/accounts.interface';

export type AuthenticatedRequest = Request & { user?: JwtPayload };
const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  jti: z.uuid(),
  iss: z.string(),
  aud: z.string(),
  iat: z.number().int(),
  exp: z.number().int(),
  token_use: z.literal('access'),
  role: z.string().min(1),
  permissions: z.array(z.string()),
  must_change_password: z.boolean(),
});

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AccountsConfig,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match || match[1].length > 16384) throw new UnauthorizedException();
    let claims: JwtPayload;
    try {
      const decoded = await this.jwt.verifyAsync(match[1], {
        publicKey: this.config.publicKey,
        algorithms: ['RS256'],
        issuer: this.config.issuer,
        audience: this.config.audience,
        ignoreExpiration: false,
      });
      claims = claimsSchema.parse(decoded);
      if (
        claims.iat > Math.floor(Date.now() / 1000) ||
        claims.exp <= claims.iat ||
        claims.exp - claims.iat > 900 ||
        claims.aud !== this.config.audience
      )
        throw new Error('Invalid claims');
    } catch {
      throw new UnauthorizedException();
    }
    if (claims.must_change_password)
      throw new ForbiddenException('Password change required');
    req.user = claims;
    context.switchToHttp().getResponse().setHeader('Cache-Control', 'no-store');
    return true;
  }
}
