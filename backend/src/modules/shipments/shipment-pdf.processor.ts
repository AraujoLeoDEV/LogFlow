import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { PrismaService } from '../../prisma/prisma.service';
import { ShipmentFileType } from '../../../generated/prisma/client';
import {
  GENERATE_SHIPMENT_PDF_JOB,
  SHIPMENT_PDF_QUEUE,
} from './shipment-pdf.constants';
import { generateShipmentPdf } from './shipment-pdf.util';
import { shipmentInclude } from './shipments.service';

export interface GenerateShipmentPdfJobData {
  shipmentId: string;
}

// Worker da fila de PDFs de comprovante de envio - módulo de envios. Ao
// receber um job, gera o PDF (logo, itens, QR code), salva em disco e cria o
// registro ShipmentFile com um token público para download/compartilhamento.
@Processor(SHIPMENT_PDF_QUEUE)
export class ShipmentPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(ShipmentPdfProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<GenerateShipmentPdfJobData>): Promise<void> {
    if (job.name !== GENERATE_SHIPMENT_PDF_JOB) {
      return;
    }

    const { shipmentId } = job.data;
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: shipmentInclude,
    });

    if (!shipment) {
      this.logger.warn(
        `Envio ${shipmentId} não encontrado para geração de PDF.`,
      );
      return;
    }

    const publicToken = randomBytes(16).toString('hex');
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const downloadUrl = `${appUrl}/shipments/files/${publicToken}/download`;

    const pdfBytes = await generateShipmentPdf(shipment, { downloadUrl });

    const storagePath = this.config.get<string>(
      'SHIPMENT_PDF_STORAGE_PATH',
      './storage/shipments',
    );
    await mkdir(storagePath, { recursive: true });

    const filePath = join(storagePath, `${shipment.id}.pdf`);
    await writeFile(filePath, pdfBytes);

    await this.prisma.shipmentFile.create({
      data: {
        shipmentId: shipment.id,
        type: ShipmentFileType.PDF,
        filePath,
        publicToken,
      },
    });
  }
}
