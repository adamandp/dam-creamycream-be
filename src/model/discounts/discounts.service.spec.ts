import { Test, TestingModule } from '@nestjs/testing';
import { DiscountsService } from './discounts.service';

describe('DiscountsService', () => {
  let service: DiscountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiscountsService],
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

    service = module.get<DiscountsService>(DiscountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
