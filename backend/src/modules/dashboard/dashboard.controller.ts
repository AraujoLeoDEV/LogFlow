import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../../generated/prisma/client';
import {
  DashboardService,
  DriverIndicator,
  FuelVehicleIndicator,
  RouteIndicator,
  ShipmentUnitIndicator,
  VehicleIndicators,
} from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('drivers')
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @ApiOperation({
    summary:
      'Indicadores por motorista: KM total, horas dirigidas, ocorrências, índice ocorrências/KM e ranking',
  })
  getDriverIndicators(
    @Query() query: DashboardQueryDto,
  ): Promise<DriverIndicator[]> {
    return this.dashboardService.getDriverIndicators(query);
  }

  @Get('vehicles')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.FINANCEIRO)
  @ApiOperation({
    summary:
      'Indicadores por veículo: KM total, tempo de uso, qtd. de usos, custos totais, custo/KM e destaques',
  })
  getVehicleIndicators(
    @Query() query: DashboardQueryDto,
  ): Promise<VehicleIndicators> {
    return this.dashboardService.getVehicleIndicators(query);
  }

  @Get('routes')
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @ApiOperation({
    summary:
      'Indicadores por rota: rotas mais utilizadas, distância e tempo médios e custo estimado',
  })
  getRouteIndicators(
    @Query() query: DashboardQueryDto,
  ): Promise<RouteIndicator[]> {
    return this.dashboardService.getRouteIndicators(query);
  }

  @Get('fuel')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.FINANCEIRO)
  @ApiOperation({
    summary:
      'Indicadores de combustível por veículo: total de litros, gasto, consumo médio e preço médio/L',
  })
  getFuelIndicators(
    @Query() query: DashboardQueryDto,
  ): Promise<FuelVehicleIndicator[]> {
    return this.dashboardService.getFuelIndicators(query);
  }

  @Get('shipments')
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @ApiOperation({
    summary:
      'Indicadores de envios por unidade: qtd. de envios, itens enviados e recebidos no período',
  })
  getShipmentIndicators(
    @Query() query: DashboardQueryDto,
  ): Promise<ShipmentUnitIndicator[]> {
    return this.dashboardService.getShipmentIndicators(query);
  }
}
