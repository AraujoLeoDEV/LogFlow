import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { DailyLogsModule } from './modules/daily-logs/daily-logs.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { FuelModule } from './modules/fuel/fuel.module';
import { HealthModule } from './modules/health/health.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { RoutesModule } from './modules/routes/routes.module';
import { TripsModule } from './modules/trips/trips.module';
import { UnitsModule } from './modules/units/units.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          transport:
            config.get<string>('APP_ENV') === 'production'
              ? {
                  target: 'pino-roll',
                  options: {
                    file: 'logs/app.log',
                    frequency: 'daily',
                    mkdir: true,
                  },
                }
              : { target: 'pino-pretty', options: { singleLine: true } },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.passwordHash',
            ],
            remove: true,
          },
        },
      }),
    }),
    PrismaModule,
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    UnitsModule,
    RoutesModule,
    VehiclesModule,
    DriversModule,
    DailyLogsModule,
    TripsModule,
    FuelModule,
    MaintenanceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
