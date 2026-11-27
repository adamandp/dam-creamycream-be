import { Public, Roles } from '../../decorators/access.decorator';
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ProductService } from './product.service';
import { WebResponse } from '../../common/common.interface';
import { FindOneProductResDto } from './products.interface';
import { PinoLogger } from 'nestjs-pino';

@Roles('STORE_ADMIN')
@Controller('product')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProductController.name);
  }

  @Public()
  @Get('information/:id')
  findInformation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse> {
    return this.productService.findInformation(id);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindOneProductResDto>> {
    return this.productService.findOne(id);
  }
}
