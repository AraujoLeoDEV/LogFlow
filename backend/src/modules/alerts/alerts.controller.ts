import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { Alert, Role } from '../../../generated/prisma/client';
import { AlertQueryDto } from './dto/alert-query.dto';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.MOTORISTA, Role.FINANCEIRO)
  @ApiOperation({
    summary:
      'Lista os alertas visíveis para o usuário autenticado, com filtro opcional por status',
  })
  findAll(
    @Query() query: AlertQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Alert[]> {
    return this.alertsService.findAll(query, user);
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.MOTORISTA, Role.FINANCEIRO)
  @ApiOperation({ summary: 'Marca um alerta como lido' })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Alert> {
    return this.alertsService.markAsRead(id, user);
  }
}
