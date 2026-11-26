import { Test, TestingModule } from '@nestjs/testing';
import { ProductDiscountsController } from './product-discounts.controller';
import { ProductDiscountsService } from './product-discounts.service';

describe('ProductDiscountsController', () => {
  let controller: ProductDiscountsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductDiscountsController],
      providers: [{ provide: ProductDiscountsService, useValue: {} }],
    })
      .useMocker(() => ({
        setContext: jest.fn(),
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }))
      .compile();

    controller = module.get<ProductDiscountsController>(
      ProductDiscountsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
