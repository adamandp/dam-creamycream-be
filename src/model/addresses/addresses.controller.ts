import { Roles } from 'src/decorators/access.decorator';
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
import { PaginationDto } from 'src/common/common.dto';
import type { WebResponse } from 'src/common/common.interface';
import {
  FindAllAddressResDto as FindAllDto,
  FindByIdAddressResDto as FindByIdDto,
  FindByUserAddressResDto as FindByUserDto,
} from './addresses.interface';
import { PinoLogger } from 'nestjs-pino';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import type { JwtPayload } from 'src/integrations/accounts/accounts.interface';

@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('addresses')
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AddressesController.name);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'CUSTOMER')
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

  @Roles('ADMIN', 'SUPER_ADMIN', 'CUSTOMER')
  @Get('user')
  findByUserId(
    @CurrentUser() request: JwtPayload,
  ): Promise<WebResponse<FindByUserDto>> {
    return this.addressesService.findByUser(request);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'CUSTOMER')
  @Get(':id')
  findById(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindByIdDto>> {
    return this.addressesService.findById(id, actor);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'CUSTOMER')
  @Patch(':id')
  update(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ): Promise<WebResponse> {
    return this.addressesService.update(id, updateAddressDto, actor);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'CUSTOMER')
  @Delete(':id')
  remove(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse> {
    return this.addressesService.remove(id, actor);
  }
}
