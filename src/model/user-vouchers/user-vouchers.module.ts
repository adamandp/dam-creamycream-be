import { Module } from '@nestjs/common';
import { UserVouchersService } from './user-vouchers.service';
import { UserVouchersController } from './user-vouchers.controller';
import { VouchersModule } from '../vouchers/vouchers.module';

@Module({
  imports: [VouchersModule],
  controllers: [UserVouchersController],
  providers: [UserVouchersService],
})
export class UserVouchersModule {}
