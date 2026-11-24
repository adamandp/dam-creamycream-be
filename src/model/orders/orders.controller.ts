import { Roles } from 'src/decorators/access.decorator';
import { Controller } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
}
