import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { AlertsModule } from '../alerts/alerts.module';
import { SHIPMENT_PDF_QUEUE } from './shipment-pdf.constants';
import { ShipmentPdfProcessor } from './shipment-pdf.processor';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';

const STORAGE_PATH =
  process.env.SHIPMENT_PDF_STORAGE_PATH ?? './storage/shipments';

@Module({
  imports: [
    BullModule.registerQueue({ name: SHIPMENT_PDF_QUEUE }),
    AlertsModule,
    MulterModule.register({
      storage: diskStorage({
        destination: STORAGE_PATH,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `photo-${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Apenas imagens são permitidas.'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ShipmentPdfProcessor],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
