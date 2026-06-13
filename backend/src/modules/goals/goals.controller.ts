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
import { Role } from '../../../generated/prisma/client';
import { CreateGoalDto } from './dto/create-goal.dto';
import { GoalQueryDto } from './dto/goal-query.dto';
import { GoalRankingQueryDto } from './dto/goal-ranking-query.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import {
  GoalRankingEntry,
  GoalsService,
  GoalWithRelations,
} from './goals.service';

@ApiTags('goals')
@ApiBearerAuth()
@Controller('goals')
@Roles(Role.ADMIN, Role.COORDENACAO)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista metas, com filtros por motorista, veículo, período, tipo e status',
  })
  findAll(@Query() query: GoalQueryDto): Promise<GoalWithRelations[]> {
    return this.goalsService.findAll(query);
  }

  @Get('ranking')
  @ApiOperation({
    summary: 'Ranking real vs. meta por motorista/veículo em um período',
  })
  getRanking(@Query() query: GoalRankingQueryDto): Promise<GoalRankingEntry[]> {
    return this.goalsService.getRanking(query.period);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma meta por id' })
  findOne(@Param('id') id: string): Promise<GoalWithRelations> {
    return this.goalsService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria uma meta de redução de consumo por motorista/veículo',
  })
  create(
    @Body() dto: CreateGoalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GoalWithRelations> {
    return this.goalsService.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma meta' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GoalWithRelations> {
    return this.goalsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma meta' })
  remove(@Param('id') id: string): Promise<void> {
    return this.goalsService.remove(id);
  }
}
