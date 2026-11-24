import { ConflictException, Injectable } from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { PaginationDto } from 'src/common/common.dto';
import { WebResponse } from 'src/common/common.interface';
// import { PrismaService } from 'src/common/prisma.module';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ErrorMessage, Messages } from 'src/utils/message.helper';
import { NotFoundException } from 'src/exceptions';
import {
  FindAllAddressResDto as FindAllDto,
  FindByIdAddressResDto as FindByIdDto,
  FindByUserAddressResDto as FindByUserDto,
  ValidateAddressResDto as ValidateDto,
} from './addresses.interface';
import { validateUpdate } from 'src/utils/validate-update';
import { PinoLogger } from 'nestjs-pino';
import { JwtPayload } from 'src/integrations/accounts/accounts.interface';

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AddressesService.name);
  }

  private name = 'Address';

  async create(
    body: CreateAddressDto,
    actor: JwtPayload,
  ): Promise<WebResponse> {
    const data = { ...body, userId: actor.sub };
    return await this.prisma
      .$transaction(async (tx) => {
        const count = await tx.address.count({
          where: { userId: data.userId },
        });
        if (count === 0) data.isPrimary = true;
        if (data.isPrimary) {
          await tx.address.updateMany({
            where: { userId: data.userId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        await tx.address.create({ data });
      })
      .then(() => ({ statusCode: 201, message: Messages.create(this.name) }));
  }

  async findAll({
    limit,
    page,
  }: PaginationDto): Promise<WebResponse<FindAllDto>> {
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.address.findMany({
        skip,
        take: limit,
      }),
      this.prisma.address.count(),
    ]).then(([address, total]) => {
      if (!total) new NotFoundException(this.name);
      return {
        message: Messages.get(this.name),
        data: address,
        paging: {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / (limit || 1)),
        },
      };
    });
  }

  async validateAddress(id: string): Promise<WebResponse<ValidateDto>> {
    return await this.prisma.address
      .findUniqueOrThrow({ where: { id } })
      .then((address) => ({
        message: Messages.get(this.name),
        data: address,
      }));
  }

  async findById(
    id: string,
    actor: JwtPayload,
  ): Promise<WebResponse<FindByIdDto>> {
    return await this.prisma.address
      .findUniqueOrThrow({ where: { id, userId: actor.sub } })
      .then((address) => ({
        message: Messages.get(this.name),
        data: address,
      }));
  }

  async findByUser({ sub }: JwtPayload): Promise<WebResponse<FindByUserDto>> {
    return await this.prisma.address
      .findMany({ where: { userId: sub } })
      .then((address) => {
        if (address.length <= 0) new NotFoundException(this.name);
        return {
          message: Messages.get('User Address'),
          data: address,
        };
      });
  }

  async update(
    id: string,
    body: UpdateAddressDto,
    actor: JwtPayload,
  ): Promise<WebResponse> {
    const exsitingAddress = await this.findById(id, actor);
    const { userId: _ignored, ...changes } = body as UpdateAddressDto & {
      userId?: string;
    };
    return await this.prisma.address
      .update({
        where: { id, userId: actor.sub },
        data: validateUpdate(changes, exsitingAddress.data!),
      })
      .then(() => ({ message: Messages.update(this.name) }));
  }

  async remove(id: string, actor: JwtPayload): Promise<WebResponse> {
    const exisitingAddress = await this.findById(id, actor);
    return await this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({
        where: { userId: exisitingAddress.data!.userId },
      });
      if (count <= 1) throw new ConflictException(ErrorMessage.strictDelete);
      return await tx.address
        .delete({ where: { id, userId: actor.sub } })
        .then(() => ({ message: Messages.delete(this.name) }));
    });
  }
}
