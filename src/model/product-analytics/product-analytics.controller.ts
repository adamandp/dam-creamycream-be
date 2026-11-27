import { Roles } from '../../decorators/access.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtPayload } from '../../integrations/accounts/accounts.interface';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ProductAnalyticsService } from './product-analytics.service';
import { CreateProductAnalyticDto } from './dto/create-product-analytic.dto';
import { PinoLogger } from 'nestjs-pino';
import type { WebResponse } from '../../common/common.interface';
import {
  FindByProductProductAnalyticsDto as FindByProductDto,
  FindByUserProductAnalyticsDto as FindByUserDto,
  FindByProductCountProductAnalyticsDto as FindByProductCountDto,
} from './product-analytics.interface';
import { PaginationDto } from '../../common/common.dto';

@Roles('STORE_ADMIN')
@Controller('product-analytics')
export class ProductAnalyticsController {
  constructor(
    private readonly service: ProductAnalyticsService,
    private readonly loger: PinoLogger,
  ) {
    this.loger.setContext(ProductAnalyticsController.name);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Post()
  create(
    @CurrentUser() actor: JwtPayload,
    @Body() body: CreateProductAnalyticDto,
  ): Promise<WebResponse> {
    return this.service.create(body, actor);
  }

  @Get('product/:id')
  async findByProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() { limit, page }: PaginationDto,
  ): Promise<WebResponse<FindByProductDto>> {
    return this.service.findByProduct(id, { limit, page });
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Get('user')
  async findByUser(
    @CurrentUser() request: JwtPayload,
    @Query() { limit, page }: PaginationDto,
  ): Promise<WebResponse<FindByUserDto>> {
    return this.service.findByUser(request, { limit, page });
  }

  @Get('product/:id/count')
  async findByProductCount(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindByProductCountDto>> {
    return this.service.findByProductCount(id);
  }
}
