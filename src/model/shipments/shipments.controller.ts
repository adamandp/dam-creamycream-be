import { Roles } from 'src/decorators/access.decorator';
import {
  Controller,
  BadRequestException,
  Get,
  Body,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { UpdateStatusShipmentDto } from './dto/update-shipment.dto';
import { PaginationDto } from 'src/common/common.dto';
import { WebResponse } from 'src/common/common.interface';
import {
  FindAllShipmentDto as FindAllDto,
  FindByIdShipmentDto as FindByIdDto,
  ShippingData,
} from './shipments.interface';
import { UserRateLimit } from 'src/guards/user-rate-limit.guard';
import { PinoLogger } from 'nestjs-pino';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import type { JwtPayload } from 'src/integrations/accounts/accounts.interface';
import { CostDto, QuoteDto } from './dto/cost-shipment.dto';

@Roles('STORE_ADMIN')
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ShipmentsController.name);
  }

  @Get()
  findAll(
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<FindAllDto>> {
    return this.shipmentsService.findAll(pagination);
  }

  @Get(':id')
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindByIdDto>> {
    return this.shipmentsService.findById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStatusShipmentDto,
  ): Promise<WebResponse> {
    return this.shipmentsService.updateStatus(id, body);
  }

  @Roles('CUSTOMER', 'STORE_ADMIN')
  @UserRateLimit(30)
  @Get('destinations/search')
  destinations(@Query('q') q: string) {
    if (typeof q !== 'string' || q.trim().length < 3 || q.trim().length > 100)
      throw new BadRequestException('Search must contain 3–100 characters');
    return this.shipmentsService.destinations(q.trim());
  }

  @Roles('CUSTOMER')
  @UserRateLimit(20)
  @Post('quote')
  quote(@Body() request: QuoteDto, @CurrentUser() actor: JwtPayload) {
    return this.shipmentsService.quote(request, actor.sub);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Post('cost')
  async cost(@Body() request: CostDto): Promise<WebResponse<ShippingData[]>> {
    return await this.shipmentsService.cost(request);
  }
}
