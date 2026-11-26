import { Test, TestingModule } from '@nestjs/testing';
import { ProductAnalyticsService } from './product-analytics.service';

describe('ProductAnalyticsService', () => {
  let service: ProductAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductAnalyticsService],
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

    service = module.get<ProductAnalyticsService>(ProductAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
