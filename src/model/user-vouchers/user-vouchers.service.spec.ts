import { Test, TestingModule } from '@nestjs/testing';
import { UserVouchersService } from './user-vouchers.service';

describe('UserVouchersService', () => {
  let service: UserVouchersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserVouchersService],
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

    service = module.get<UserVouchersService>(UserVouchersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
