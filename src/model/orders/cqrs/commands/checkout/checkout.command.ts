import type { JwtPayload } from 'src/integrations/accounts/accounts.interface';
import { CheckOutDto } from 'src/model/orders/dto/checkout.dto';

export class CheckOutCommand {
  constructor(
    public readonly payload: CheckOutDto,
    public readonly actor: JwtPayload,
  ) {}
}
