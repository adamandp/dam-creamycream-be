export interface JwtPayload {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
  jti: string;
  token_use: 'access';
  role: string;
  permissions: string[];
  must_change_password: boolean;
}
