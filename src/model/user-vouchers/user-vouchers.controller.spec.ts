import { Test, TestingModule } from '@nestjs/testing';
import { UserVouchersController } from './user-vouchers.controller';
import { UserVouchersService } from './user-vouchers.service';

describe('UserVouchersController', () => {
  let controller: UserVouchersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserVouchersController],
      providers: [{ provide: UserVouchersService, useValue: {} }],
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

    controller = module.get<UserVouchersController>(UserVouchersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
