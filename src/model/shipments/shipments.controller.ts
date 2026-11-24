import { Roles } from 'src/decorators/access.decorator';
import {
  Controller,
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
import { PinoLogger } from 'nestjs-pino';
import { CostDto } from './dto/cost-shipment.dto';

@Roles('ADMIN', 'SUPER_ADMIN')
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

  @Roles('ADMIN', 'SUPER_ADMIN', 'CUSTOMER')
  @Post('cost')
  async cost(@Body() request: CostDto): Promise<WebResponse<ShippingData[]>> {
    return await this.shipmentsService.cost(request);
  }
}
