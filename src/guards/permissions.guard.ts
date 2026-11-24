import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS, PUBLIC } from '../decorators/access.decorator';
import { AuthenticatedRequest } from './jwt.guard';
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new ForbiddenException();
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS,
      targets,
    );
    if (required && !required.every((key) => user.permissions.includes(key)))
      throw new ForbiddenException();
    return true;
  }
}
