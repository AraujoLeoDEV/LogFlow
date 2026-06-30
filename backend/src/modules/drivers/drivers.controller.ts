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
import { Driver, Role } from '../../../generated/prisma/client';
import { CreateDriverDto } from './dto/create-driver.dto';
import { DriverHistoryDto } from './dto/driver-history.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriversService } from './drivers.service';

@ApiTags('drivers')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COORDENACAO)
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os motoristas ativos' })
  findAll(): Promise<Driver[]> {
    return this.driversService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um motorista por id' })
  findOne(@Param('id') id: string): Promise<Driver> {
    return this.driversService.findOne(id);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Histórico do motorista (viagens, abastecimentos e ocorrências)',
  })
  history(@Param('id') id: string): Promise<DriverHistoryDto> {
    return this.driversService.history(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo motorista' })
  create(
    @Body() dto: CreateDriverDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Driver> {
    return this.driversService.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um motorista' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Driver> {
    return this.driversService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove (soft delete) um motorista' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.driversService.remove(id, user.sub);
  }

  @Delete(':id/permanent')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Exclui definitivamente um motorista (somente ADMIN; bloqueado se houver registros vinculados)',
  })
  removePermanently(@Param('id') id: string): Promise<void> {
    return this.driversService.removePermanently(id);
  }
}
