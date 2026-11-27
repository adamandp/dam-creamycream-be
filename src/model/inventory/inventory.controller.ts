import { Roles } from '../../decorators/access.decorator';
import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { PaginationDto } from '../../common/common.dto';
import { WebResponse } from '../../common/common.interface';
import {
  findByProductIdInventoryResDto as findByProductId,
  findAllInventoryResDto as findAll,
  findByIdInventoryResDto as findById,
} from './inventory.interface';
import { PinoLogger } from 'nestjs-pino';

@Roles('STORE_ADMIN')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(InventoryController.name);
  }

  @Get()
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<findAll>> {
    return this.inventoryService.findAll(pagination);
  }

  @Get(':id')
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<findById>> {
    return this.inventoryService.findById(id);
  }

  @Get('product/:id')
  findByProductId(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<findByProductId>> {
    return this.inventoryService.findByProductId(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateInventoryDto,
  ): Promise<WebResponse> {
    return this.inventoryService.update(id, body);
  }
}
