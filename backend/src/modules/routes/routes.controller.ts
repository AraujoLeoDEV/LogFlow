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

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../../generated/prisma/client';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import {
  RoutesService,
  RouteWithStops,
  RouteWithUsageCount,
} from './routes.service';

@ApiTags('routes')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COORDENACAO)
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas as rotas cadastradas' })
  findAll(): Promise<RouteWithUsageCount[]> {
    return this.routesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma rota por id' })
  findOne(@Param('id') id: string): Promise<RouteWithStops> {
    return this.routesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova rota' })
  create(@Body() dto: CreateRouteDto): Promise<RouteWithStops> {
    return this.routesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma rota' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
  ): Promise<RouteWithStops> {
    return this.routesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Inativa uma rota' })
  remove(@Param('id') id: string): Promise<void> {
    return this.routesService.remove(id);
  }

  @Delete(':id/permanent')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Exclui definitivamente uma rota (somente ADMIN; bloqueado se houver registros vinculados)',
  })
  removePermanently(@Param('id') id: string): Promise<void> {
    return this.routesService.removePermanently(id);
  }
}
