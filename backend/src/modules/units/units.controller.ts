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
import { Role, Unit } from '../../../generated/prisma/client';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@ApiTags('units')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COORDENACAO)
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.CONFERENTE)
  @ApiOperation({ summary: 'Lista todas as unidades cadastradas' })
  findAll(): Promise<Unit[]> {
    return this.unitsService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.CONFERENTE)
  @ApiOperation({ summary: 'Busca uma unidade por id' })
  findOne(@Param('id') id: string): Promise<Unit> {
    return this.unitsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova unidade' })
  create(@Body() dto: CreateUnitDto): Promise<Unit> {
    return this.unitsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma unidade' })
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto): Promise<Unit> {
    return this.unitsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Inativa uma unidade' })
  remove(@Param('id') id: string): Promise<void> {
    return this.unitsService.remove(id);
  }

  @Delete(':id/permanent')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Exclui definitivamente uma unidade (somente ADMIN; bloqueado se houver registros vinculados)',
  })
  removePermanently(@Param('id') id: string): Promise<void> {
    return this.unitsService.removePermanently(id);
  }
}
