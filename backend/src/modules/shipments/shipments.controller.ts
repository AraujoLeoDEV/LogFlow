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
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import type { PaginatedResult } from '../../common/utils/pagination.util';
import { Role, ShipmentFile } from '../../../generated/prisma/client';
import { ConfirmShipmentDto } from './dto/confirm-shipment.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import {
  ShipmentMonitoringItem,
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
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.CONFERENTE)
  @ApiOperation({
    summary:
      'Lista envios, com filtros por status, unidade de destino e período',
  })
  findAll(
    @Query() query: ShipmentQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<ShipmentWithRelations>> {
    return this.shipmentsService.findAll(query, user);
  }

  @Get('files/:token/download')
  @Roles()
  @Public()
  @ApiOperation({
    summary: 'Baixa publicamente o PDF de comprovante de um envio pelo token',
  })
  async downloadFile(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.shipmentsService.findFileByPublicToken(token);

    res.download(file.filePath, `comprovante-${file.shipmentId}.pdf`);
  }

  @Get('by-id/:id')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.CONFERENTE)
  @ApiOperation({
    summary:
      'Busca um envio pelo id (usado para abrir a partir de uma notificação)',
  })
  findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    return this.shipmentsService.findById(id, user);
  }

  @Get('monitoring')
  @Roles(Role.ADMIN, Role.COORDENACAO)
  @ApiOperation({
    summary:
      'Lista envios ainda não confirmados/cancelados, agrupáveis por criticidade, com tempo de espera calculado',
  })
  findMonitoring(): Promise<ShipmentMonitoringItem[]> {
    return this.shipmentsService.findMonitoring();
  }

  @Get(':protocolNumber')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.CONFERENTE)
  @ApiOperation({
    summary:
      'Busca um envio pelo número de protocolo, com a timeline de status',
  })
  findByProtocolNumber(
    @Param('protocolNumber') protocolNumber: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentWithTimeline> {
    return this.shipmentsService.findByProtocolNumber(protocolNumber, user);
  }

  @Get(':id/files')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.CONFERENTE)
  @ApiOperation({ summary: 'Lista os arquivos (PDFs) gerados para o envio' })
  listFiles(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentFile[]> {
    return this.shipmentsService.listFiles(id, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.CONFERENTE)
  @ApiOperation({
    summary: 'Registra um novo envio, gerando o protocolo automaticamente',
  })
  create(
    @Body() dto: CreateShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    return this.shipmentsService.create(dto, user);
  }

  @Post(':id/upload-photo')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.CONFERENTE)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ summary: 'Faz upload de uma foto para o envio' })
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentFile> {
    return this.shipmentsService.uploadPhoto(id, file, user);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.COORDENACAO, Role.CONFERENTE)
  @ApiOperation({
    summary: 'Confirma o recebimento de um envio entregue',
  })
  confirmReceipt(
    @Param('id') id: string,
    @Body() dto: ConfirmShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ShipmentWithRelations> {
    return this.shipmentsService.confirmReceipt(id, dto, user, req.ip);
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

  @Patch(':id')
  @ApiOperation({
    summary:
      'Edita itens, observações e/ou transportador de um envio (somente ADMIN/COORDENACAO). ' +
      'Edições em envios já confirmados são registradas na timeline para auditoria.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    return this.shipmentsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui definitivamente um envio (somente ADMIN)' })
  remove(@Param('id') id: string): Promise<void> {
    return this.shipmentsService.remove(id);
  }
}
