import { Test, TestingModule } from '@nestjs/testing';
import { UserNotificationsController } from './user-notifications.controller';
import { UserNotificationsService } from './user-notifications.service';

describe('UserNotificationsController', () => {
  let controller: UserNotificationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserNotificationsController],
      providers: [{ provide: UserNotificationsService, useValue: {} }],
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

    controller = module.get<UserNotificationsController>(
      UserNotificationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
