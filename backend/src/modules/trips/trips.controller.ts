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
import { Role, Trip } from '../../../generated/prisma/client';
import { TripsService, TripWithRelations } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { FinishTripDto } from './dto/finish-trip.dto';
import { TripQueryDto } from './dto/trip-query.dto';

@ApiTags('trips')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COORDENACAO, Role.MOTORISTA)
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Histórico de viagens, com filtros por veículo, motorista, rota, status e período',
  })
  findAll(
    @Query() query: TripQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripWithRelations[]> {
    return this.tripsService.findAll(query, user);
  }

  @Post()
  @ApiOperation({ summary: 'Inicia uma nova viagem' })
  create(
    @Body() dto: CreateTripDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Trip> {
    return this.tripsService.create(dto, user);
  }

  @Patch(':id/finish')
  @ApiOperation({ summary: 'Encerra uma viagem em andamento' })
  finish(
    @Param('id') id: string,
    @Body() dto: FinishTripDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Trip> {
    return this.tripsService.finish(id, dto, user);
  }
}
