import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import type { PaginatedResult } from '../../common/utils/pagination.util';
import { Role } from '../../../generated/prisma/client';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { MaintenanceQueryDto } from './dto/maintenance-query.dto';
import {
  MaintenanceService,
  MaintenanceWithVehicle,
} from './maintenance.service';
import { ScheduleEntry } from './maintenance.util';

@ApiTags('maintenance')
@ApiBearerAuth()
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.FINANCEIRO)
  @ApiOperation({
    summary:
      'Histórico de manutenções, com filtros por veículo, tipo e período',
  })
  findAll(
    @Query() query: MaintenanceQueryDto,
  ): Promise<PaginatedResult<MaintenanceWithVehicle>> {
    return this.maintenanceService.findAll(query);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @ApiOperation({ summary: 'Registra uma manutenção' })
  create(
    @Body() dto: CreateMaintenanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MaintenanceWithVehicle> {
    return this.maintenanceService.create(dto, user);
  }

  @Get('schedule')
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @ApiOperation({
    summary:
      'Agenda de manutenções previstas (troca de óleo, pneus e revisão geral), ordenada por proximidade',
  })
  getSchedule(): Promise<ScheduleEntry[]> {
    return this.maintenanceService.getSchedule();
  }
}
