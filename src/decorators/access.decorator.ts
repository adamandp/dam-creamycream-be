import { SetMetadata } from '@nestjs/common';
export const PUBLIC = 'accounts:public';
export const AUTHENTICATED = 'accounts:authenticated';
export const ROLES = 'accounts:roles';
export const PERMISSIONS = 'accounts:permissions';
export type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'CUSTOMER';
export const Public = () => SetMetadata(PUBLIC, true);
export const Authenticated = () => SetMetadata(AUTHENTICATED, true);
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES, roles);
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS, permissions);
