import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  Query,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../decorators/access.decorator';
import { AccountsClient } from './accounts.client';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
class LoginDto extends createZodDto(
  z
    .object({
      username: z.string().min(3).max(50),
      password: z.string().min(8).max(72),
    })
    .strict(),
) {}
class UpdateProfileDto extends createZodDto(
  z
    .object({
      username: z.string().min(3).max(50).optional(),
      name: z.string().max(255).nullable().optional(),
      email: z.email().max(320).nullable().optional(),
      imageBase64: z.string().max(1400000).nullable().optional(),
    })
    .strict(),
) {}
class ChangePasswordDto extends createZodDto(
  z
    .object({
      currentPassword: z.string().min(8).max(72),
      newPassword: z.string().min(8).max(72),
    })
    .strict(),
) {}
class RegisterDto extends createZodDto(
  z
    .object({
      username: z.string().min(3).max(50),
      password: z.string().min(8).max(72),
      confirmPassword: z.string().min(8).max(72),
    })
    .strict(),
) {}
// Explicit gateway routes: Accounts Service itself authenticates and authorizes these operations.
@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsClient) {}
  @Public()
  @Post('auth/login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Req() req: Request, @Res() res: Response, @Body() body: LoginDto) {
    return this.accounts.forward('POST', '/auth/login', req, res, body);
  }
  @Public()
  @Post('auth/register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: RegisterDto,
  ) {
    return this.accounts.forward('POST', '/auth/register', req, res, body);
  }
  @Public()
  @Post('auth/logout')
  logout(@Req() req: Request, @Res() res: Response) {
    return this.accounts.forward('POST', '/auth/logout', req, res);
  }
  @Public()
  @Post('auth/logout-all')
  logoutAll(@Req() req: Request, @Res() res: Response) {
    return this.accounts.forward('POST', '/auth/logout-all', req, res);
  }
  @Public()
  @Post('sessions/refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  refresh(@Req() req: Request, @Res() res: Response) {
    return this.accounts.forward('POST', '/sessions/refresh', req, res);
  }
  @Public()
  @Get('users/profile')
  profile(@Req() req: Request, @Res() res: Response) {
    return this.accounts.forward('GET', '/users/me', req, res);
  }
  @Public()
  @Patch('users/profile')
  updateProfile(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: UpdateProfileDto,
  ) {
    return this.accounts.forward('PATCH', '/users/me', req, res, body);
  }
  @Public()
  @Put('users/profile/password')
  changePassword(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: ChangePasswordDto,
  ) {
    return this.accounts.forward('PUT', '/users/me/password', req, res, body);
  }
  @Public()
  @Get('sessions')
  sessions(@Req() req: Request, @Res() res: Response) {
    return this.accounts.forward('GET', '/sessions', req, res);
  }
  @Public()
  @Delete('sessions/:id')
  revoke(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accounts.forward('DELETE', '/sessions/' + id, req, res);
  }
}
