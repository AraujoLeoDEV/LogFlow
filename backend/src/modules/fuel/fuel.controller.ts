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
import { Fuel, Role } from '../../../generated/prisma/client';
import { CreateFuelDto } from './dto/create-fuel.dto';
import { FuelIndicatorsQueryDto } from './dto/fuel-indicators-query.dto';
import { FuelQueryDto } from './dto/fuel-query.dto';
import { UpdateFuelDto } from './dto/update-fuel.dto';
import { FuelIndicators, FuelService, FuelWithRelations } from './fuel.service';

@ApiTags('fuel')
@ApiBearerAuth()
@Controller('fuel')
export class FuelController {
  constructor(private readonly fuelService: FuelService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.MOTORISTA)
  @ApiOperation({
    summary:
      'Histórico de abastecimentos, com filtros por veículo, motorista e período',
  })
  findAll(
    @Query() query: FuelQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<FuelWithRelations>> {
    return this.fuelService.findAll(query, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.MOTORISTA)
  @ApiOperation({ summary: 'Registra um abastecimento' })
  create(
    @Body() dto: CreateFuelDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Fuel> {
    return this.fuelService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @ApiOperation({
    summary: 'Edita um abastecimento (somente ADMIN/COORDENACAO)',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFuelDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Fuel> {
    return this.fuelService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui definitivamente um abastecimento (somente ADMIN)',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.fuelService.remove(id);
  }

  @Get('indicators')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.FINANCEIRO)
  @ApiOperation({
    summary:
      'Indicadores de consumo e gasto com combustível por veículo e por mês',
  })
  getIndicators(
    @Query() query: FuelIndicatorsQueryDto,
  ): Promise<FuelIndicators> {
    return this.fuelService.getIndicators(query);
  }
}
