import { Module } from '@nestjs/common';

import { AlertsController } from './alerts.controller';
import { AlertsMailerService } from './alerts-mailer.service';
import { AlertsService } from './alerts.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertsMailerService],
  exports: [AlertsService],
})
export class AlertsModule {}
