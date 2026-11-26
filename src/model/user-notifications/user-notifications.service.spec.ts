import { Test, TestingModule } from '@nestjs/testing';
import { UserNotificationsService } from './user-notifications.service';

describe('UserNotificationsService', () => {
  let service: UserNotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserNotificationsService],
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

    service = module.get<UserNotificationsService>(UserNotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
