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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { Role } from '../../../generated/prisma/client';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService, VehicleWithDepreciation } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COORDENACAO)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os veículos ativos' })
  findAll(): Promise<VehicleWithDepreciation[]> {
    return this.vehiclesService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Busca um veículo por id, incluindo a depreciação mensal calculada',
  })
  findOne(@Param('id') id: string): Promise<VehicleWithDepreciation> {
    return this.vehiclesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo veículo' })
  create(
    @Body() dto: CreateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VehicleWithDepreciation> {
    return this.vehiclesService.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um veículo' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VehicleWithDepreciation> {
    return this.vehiclesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove (soft delete) um veículo' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.vehiclesService.remove(id, user.sub);
  }
}
