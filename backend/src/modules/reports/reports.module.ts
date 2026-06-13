import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { FinanceModule } from '../finance/finance.module';
import { GoalsModule } from '../goals/goals.module';
import { ReportsController } from './reports.controller';
import { ReportsProcessor } from './reports.processor';
import { ReportsService, REPORTS_QUEUE } from './reports.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: REPORTS_QUEUE }),
    FinanceModule,
    GoalsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsProcessor],
})
export class ReportsModule {}
