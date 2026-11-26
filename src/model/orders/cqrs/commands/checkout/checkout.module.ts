import { Module } from '@nestjs/common';
import { CheckoutOrderHandler } from './checkout.handler';
@Module({ providers: [CheckoutOrderHandler], exports: [CheckoutOrderHandler] })
export class CheckoutOrderModule {}
