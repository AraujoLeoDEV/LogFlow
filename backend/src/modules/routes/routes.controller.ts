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
import { Role, Route } from '../../../generated/prisma/client';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COORDENACAO)
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas as rotas cadastradas' })
  findAll(): Promise<Route[]> {
    return this.routesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma rota por id' })
  findOne(@Param('id') id: string): Promise<Route> {
    return this.routesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova rota' })
  create(@Body() dto: CreateRouteDto): Promise<Route> {
    return this.routesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma rota' })
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto): Promise<Route> {
    return this.routesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Inativa uma rota' })
  remove(@Param('id') id: string): Promise<void> {
    return this.routesService.remove(id);
  }
}
