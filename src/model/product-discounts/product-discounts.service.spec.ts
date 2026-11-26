import { Test, TestingModule } from '@nestjs/testing';
import { ProductDiscountsService } from './product-discounts.service';

describe('ProductDiscountsService', () => {
  let service: ProductDiscountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductDiscountsService],
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

    service = module.get<ProductDiscountsService>(ProductDiscountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
