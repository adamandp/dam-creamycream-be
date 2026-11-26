import { Roles } from 'src/decorators/access.decorator';
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CartsService } from './carts.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { PaginationDto } from 'src/common/common.dto';
import { WebResponse } from 'src/common/common.interface';
import { FindByUserCartDto as FindByUserDto } from './carts.interface';
import { PinoLogger } from 'nestjs-pino';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import type { JwtPayload } from 'src/integrations/accounts/accounts.interface';

@Roles('STORE_ADMIN')
@Controller('carts')
export class CartsController {
  constructor(
    private readonly cartsService: CartsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CartsController.name);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Post('/user/add')
  async addToCart(
    @CurrentUser() payload: JwtPayload,
    @Body() body: AddToCartDto,
  ): Promise<WebResponse> {
    return this.cartsService.addToCart(payload.sub, body);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Post('/user/remove')
  async removeFromCart(
    @CurrentUser() payload: JwtPayload,
    @Body() body: AddToCartDto,
  ): Promise<WebResponse> {
    return this.cartsService.removeFromCart(payload.sub, body);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Get('/user')
  findByUser(
    @CurrentUser() payload: JwtPayload,
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<FindByUserDto[]>> {
    return this.cartsService.findByUser(payload, pagination);
  }
}
