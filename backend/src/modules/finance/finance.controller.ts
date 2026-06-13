import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../../generated/prisma/client';
import { FinanceQueryDto } from './dto/finance-query.dto';
import {
  CostPerKmResult,
  FinanceService,
  MonthlyFinanceComparison,
  MonthlyFinanceSummary,
} from './finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
@Roles(Role.ADMIN, Role.COORDENACAO, Role.FINANCEIRO)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('monthly')
  @ApiOperation({
    summary:
      'Custo mensal da frota: combustível + manutenção + depreciação mensal dos veículos ativos',
  })
  getMonthlySummary(
    @Query() query: FinanceQueryDto,
  ): Promise<MonthlyFinanceSummary[]> {
    return this.financeService.getMonthlySummary(query);
  }

  @Get('cost-per-km')
  @ApiOperation({
    summary: 'Custo médio por KM no período (custo total / KM total rodado)',
  })
  getCostPerKm(@Query() query: FinanceQueryDto): Promise<CostPerKmResult> {
    return this.financeService.getCostPerKm(query);
  }

  @Get('comparison')
  @ApiOperation({
    summary:
      'Comparativo mensal do custo total da frota com variação percentual',
  })
  getMonthlyComparison(
    @Query() query: FinanceQueryDto,
  ): Promise<MonthlyFinanceComparison[]> {
    return this.financeService.getMonthlyComparison(query);
  }
}
