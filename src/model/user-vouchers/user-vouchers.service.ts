import { Injectable } from '@nestjs/common';
import { CreateUserVoucherDto } from './dto/create-user-voucher.dto';
import {
  ValidateUserVoucherDto as ValidateDto,
  FindByUserUserVoucherDto as FindByUserDto,
  FindByIdUserVoucherDto as FindByIdDto,
  FindAllUserVoucherDto as FindAllDto,
  FindByVoucherUserVoucherDto as FindByVoucherDto,
} from './user-vouchers.interface';
import { WebResponse } from '../../common/common.interface';
// import { PrismaService } from 'src/common/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PinoLogger } from 'nestjs-pino';
import { PaginationDto } from '../../common/common.dto';
import { Messages } from '../../utils/message.helper';
import { NotFoundException } from '../../exceptions';
import { JwtPayload } from '../../integrations/accounts/accounts.interface';
import { VouchersService } from '../vouchers/vouchers.service';

@Injectable()
export class UserVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,

    private readonly voucher: VouchersService,
  ) {
    this.logger.setContext(UserVouchersService.name);
  }

  private name = 'User Voucher';

  async create(body: CreateUserVoucherDto): Promise<WebResponse> {
    await this.voucher.validateVoucher(body.voucherId);
    return await this.prisma.userVoucher
      .create({ data: body })
      .then(() => ({ message: Messages.create(this.name) }));
  }

  async findAll({
    limit,
    page,
  }: PaginationDto): Promise<WebResponse<FindAllDto>> {
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.userVoucher.findMany({
        skip,
        take: limit,
      }),
      this.prisma.userVoucher.count(),
    ]).then(([data, total]) => {
      if (total <= 0) throw new NotFoundException(this.name);
      return {
        message: Messages.get(this.name),
        data,
        paging: {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / (limit || 1)),
        },
      };
    });
  }

  async validateUserVoucher(id: string): Promise<WebResponse<ValidateDto>> {
    return await this.prisma.userVoucher
      .findUniqueOrThrow({ where: { id } })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

  async findById(id: string): Promise<WebResponse<FindByIdDto>> {
    return await this.prisma.userVoucher
      .findUniqueOrThrow({ where: { id } })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

  async findByUser(request: JwtPayload): Promise<WebResponse<FindByUserDto>> {
    const { sub } = request;
    return await this.prisma.userVoucher
      .findMany({ where: { userId: sub }, include: { vouchers: true } })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

  async findByVoucher(id: string): Promise<WebResponse<FindByVoucherDto>> {
    return await this.prisma.userVoucher
      .findMany({ where: { voucherId: id } })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

}
