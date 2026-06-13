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
import { Role } from '../../../generated/prisma/client';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import {
  ShipmentsService,
  ShipmentWithRelations,
  ShipmentWithTimeline,
} from './shipments.service';

@ApiTags('shipments')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COORDENACAO)
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista envios, com filtros por status, unidade de destino e período',
  })
  findAll(@Query() query: ShipmentQueryDto): Promise<ShipmentWithRelations[]> {
    return this.shipmentsService.findAll(query);
  }

  @Get(':protocolNumber')
  @ApiOperation({
    summary:
      'Busca um envio pelo número de protocolo, com a timeline de status',
  })
  findByProtocolNumber(
    @Param('protocolNumber') protocolNumber: string,
  ): Promise<ShipmentWithTimeline> {
    return this.shipmentsService.findByProtocolNumber(protocolNumber);
  }

  @Post()
  @ApiOperation({
    summary: 'Registra um novo envio, gerando o protocolo automaticamente',
  })
  create(
    @Body() dto: CreateShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    return this.shipmentsService.create(dto, user);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Atualiza o status do envio e registra na timeline',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    return this.shipmentsService.updateStatus(id, dto, user);
  }
}
