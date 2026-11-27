import type { JwtPayload } from '../../../../../integrations/accounts/accounts.interface';
import { CheckOutDto } from '../../../dto/checkout.dto';
export class CheckOutCommand {
  constructor(
    public readonly payload: CheckOutDto,
    public readonly actor: JwtPayload,
    public readonly key: string,
  ) {}
}
