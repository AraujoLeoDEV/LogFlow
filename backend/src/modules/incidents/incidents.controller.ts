import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import type { PaginatedResult } from '../../common/utils/pagination.util';
import { Role } from '../../../generated/prisma/client';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentIndicatorsQueryDto } from './dto/incident-indicators-query.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import {
  IncidentIndicators,
  IncidentsService,
  IncidentWithRelations,
} from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.FINANCEIRO, Role.MOTORISTA)
  @ApiOperation({
    summary:
      'Histórico de ocorrências, com filtros por veículo, motorista, categoria, tipo, gravidade e período',
  })
  findAll(
    @Query() query: IncidentQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<IncidentWithRelations>> {
    return this.incidentsService.findAll(query, user);
  }

  @Get('indicators')
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @ApiOperation({
    summary:
      'Indicadores de ocorrências: por motorista, por veículo e índice ocorrências/KM rodado',
  })
  getIndicators(
    @Query() query: IncidentIndicatorsQueryDto,
  ): Promise<IncidentIndicators> {
    return this.incidentsService.getIndicators(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.FINANCEIRO, Role.MOTORISTA)
  @ApiOperation({ summary: 'Busca uma ocorrência por id' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncidentWithRelations> {
    return this.incidentsService.findOne(id, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.MOTORISTA)
  @ApiOperation({ summary: 'Registra uma ocorrência' })
  create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncidentWithRelations> {
    return this.incidentsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @ApiOperation({ summary: 'Atualiza uma ocorrência' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncidentWithRelations> {
    return this.incidentsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma ocorrência' })
  remove(@Param('id') id: string): Promise<void> {
    return this.incidentsService.remove(id);
  }
}
