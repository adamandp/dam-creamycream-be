import { Roles } from '../../decorators/access.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { PaginationDto } from '../../common/common.dto';
import type { WebResponse } from '../../common/common.interface';
import {
  FindAllAddressResDto as FindAllDto,
  FindByIdAddressResDto as FindByIdDto,
  FindByUserAddressResDto as FindByUserDto,
} from './addresses.interface';
import { PinoLogger } from 'nestjs-pino';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtPayload } from '../../integrations/accounts/accounts.interface';

@Roles('STORE_ADMIN')
@Controller('addresses')
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AddressesController.name);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Post()
  create(
    @CurrentUser() actor: JwtPayload,
    @Body() createAddressDto: CreateAddressDto,
  ): Promise<WebResponse> {
    return this.addressesService.create(createAddressDto, actor);
  }

  @Get()
  findAll(
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<FindAllDto>> {
    return this.addressesService.findAll(pagination);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Get('user')
  findByUserId(
    @CurrentUser() request: JwtPayload,
  ): Promise<WebResponse<FindByUserDto>> {
    return this.addressesService.findByUser(request);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Get(':id')
  findById(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindByIdDto>> {
    return this.addressesService.findById(id, actor);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Patch(':id')
  update(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ): Promise<WebResponse> {
    return this.addressesService.update(id, updateAddressDto, actor);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Delete(':id')
  remove(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse> {
    return this.addressesService.remove(id, actor);
  }
}
