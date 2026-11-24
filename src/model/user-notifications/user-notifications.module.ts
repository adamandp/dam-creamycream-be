import { Module } from '@nestjs/common';
import { UserNotificationsService } from './user-notifications.service';
import { UserNotificationsController } from './user-notifications.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [UserNotificationsController],
  providers: [UserNotificationsService],
})
export class UserNotificationsModule {}
