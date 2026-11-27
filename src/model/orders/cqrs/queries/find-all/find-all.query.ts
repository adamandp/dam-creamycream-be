import { PaginationDto } from '../../../../../common/common.dto';

export class FindAllOrderCommand {
  constructor(public readonly pagination: PaginationDto) {}
}
