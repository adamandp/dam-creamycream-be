import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountsConfig } from '../config/accounts.config';
import {
  AUTHENTICATED,
  AppRole,
  PERMISSIONS,
  PUBLIC,
  ROLES,
} from '../decorators/access.decorator';
import { AuthenticatedRequest } from './jwt.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AccountsConfig,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !Object.values(this.config.roles).includes(user.role))
      throw new ForbiddenException();
    const roles = this.reflector.getAllAndOverride<AppRole[]>(ROLES, targets);
    const permissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS,
      targets,
    );
    const authenticated = this.reflector.getAllAndOverride<boolean>(
      AUTHENTICATED,
      targets,
    );
    if (roles && !roles.some((role) => this.config.roles[role] === user.role))
      throw new ForbiddenException();
    if (!roles && !permissions && !authenticated)
      throw new ForbiddenException();
    return true;
  }
}
