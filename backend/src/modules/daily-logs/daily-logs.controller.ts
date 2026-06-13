import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { DailyLog, Role } from '../../../generated/prisma/client';
import { DailyLogsService, DailyLogWithRelations } from './daily-logs.service';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { DailyLogQueryDto } from './dto/daily-log-query.dto';
import { ReturnDailyLogDto } from './dto/return-daily-log.dto';

@ApiTags('daily-logs')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COORDENACAO, Role.MOTORISTA)
@Controller('daily-logs')
export class DailyLogsController {
  constructor(private readonly dailyLogsService: DailyLogsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Histórico de saídas/retornos, com filtros por veículo, motorista, rota e período',
  })
  findAll(
    @Query() query: DailyLogQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DailyLogWithRelations[]> {
    return this.dailyLogsService.findAll(query, user);
  }

  @Post()
  @ApiOperation({ summary: 'Registra a saída de um veículo' })
  create(
    @Body() dto: CreateDailyLogDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DailyLog> {
    return this.dailyLogsService.create(dto, user);
  }

  @Patch(':id/return')
  @ApiOperation({ summary: 'Registra o retorno de um veículo' })
  returnTrip(
    @Param('id') id: string,
    @Body() dto: ReturnDailyLogDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DailyLog> {
    return this.dailyLogsService.returnTrip(id, dto, user);
  }
}
