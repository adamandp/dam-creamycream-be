import { Module } from '@nestjs/common';
import { CheckoutOrderHandler } from './checkout.handler';
import { QstashModule } from '../../../../../integrations/qstash/qstash.module';
@Module({
  imports: [QstashModule],
  providers: [CheckoutOrderHandler],
  exports: [CheckoutOrderHandler],
})
export class CheckoutOrderModule {}
