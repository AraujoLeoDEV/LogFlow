import { readFileSync } from 'fs';
import { join } from 'path';

import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';

import { sanitizeForPdf, truncateToWidth } from '../reports/reports.util';
import { ShipmentItemUnit } from '../../../generated/prisma/client';
import { ShipmentWithRelations } from './shipments.service';

const PDF_PAGE_WIDTH = 595.28; // A4 retrato
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN = 40;
const PDF_FONT_SIZE = 9;
const PDF_ROW_HEIGHT = 16;

const shipmentItemUnitLabels: Record<ShipmentItemUnit, string> = {
  UND: 'UN',
  CX: 'CX',
  ML: 'ML',
  L: 'L',
};

const ITEM_COLUMNS = [
  { key: 'description', header: 'Descrição', width: 215 },
  { key: 'category', header: 'Categoria', width: 95 },
  { key: 'quantity', header: 'Qtd.', width: 55 },
  { key: 'unit', header: 'Un.', width: 40 },
  { key: 'notes', header: 'Observação', width: 110 },
];

export interface ShipmentPdfOptions {
  downloadUrl: string;
}

// Gera o PDF de comprovante de envio (logo, dados do protocolo, itens, área
// de confirmação de recebimento e QR code para o link público) - módulo de
// envios.
export async function generateShipmentPdf(
  shipment: ShipmentWithRelations,
  options: ShipmentPdfOptions,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
  let y = PDF_PAGE_HEIGHT - PDF_MARGIN;

  try {
    const logoBytes = readFileSync(
      join(__dirname, '../../assets/logo-icon.png'),
    );
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImage.scale(40 / logoImage.width);
    page.drawImage(logoImage, {
      x: PDF_MARGIN,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    });
  } catch {
    // Logo é opcional - segue sem ela caso o arquivo não exista.
  }

  page.drawText('Comprovante de Envio', {
    x: PDF_MARGIN + 55,
    y: y - 25,
    size: 18,
    font: boldFont,
  });

  y -= 70;

  const drawField = (label: string, value: string): void => {
    page.drawText(sanitizeForPdf(label, boldFont), {
      x: PDF_MARGIN,
      y,
      size: PDF_FONT_SIZE,
      font: boldFont,
    });
    page.drawText(
      truncateToWidth(
        sanitizeForPdf(value, font),
        font,
        PDF_FONT_SIZE,
        PDF_PAGE_WIDTH - PDF_MARGIN * 2 - 130,
      ),
      {
        x: PDF_MARGIN + 130,
        y,
        size: PDF_FONT_SIZE,
        font,
      },
    );
    y -= PDF_ROW_HEIGHT;
  };

  drawField('Protocolo:', shipment.protocolNumber);
  drawField('Data do envio:', shipment.shippedAt.toLocaleString('pt-BR'));
  drawField('Unidade de origem:', shipment.originUnit?.name ?? '-');
  drawField('Unidade de destino:', shipment.destinationUnit.name);
  drawField('Responsável pelo envio:', shipment.sender.name);
  drawField('Transportador:', shipment.transporter?.name ?? '-');
  drawField('Status:', shipment.status);

  y -= 10;

  page.drawText('Itens do envio', {
    x: PDF_MARGIN,
    y,
    size: 12,
    font: boldFont,
  });
  y -= 20;

  const drawItemsHeader = (): void => {
    let x = PDF_MARGIN;
    ITEM_COLUMNS.forEach((column) => {
      page.drawText(column.header, {
        x,
        y,
        size: PDF_FONT_SIZE,
        font: boldFont,
      });
      x += column.width;
    });
    y -= PDF_ROW_HEIGHT;
  };

  drawItemsHeader();

  for (const item of shipment.items) {
    const values = [
      item.description,
      item.category ?? '-',
      item.quantity.toNumber().toString(),
      shipmentItemUnitLabels[item.unit],
      item.notes ?? '-',
    ];

    let x = PDF_MARGIN;
    values.forEach((value, index) => {
      const column = ITEM_COLUMNS[index];
      page.drawText(
        truncateToWidth(
          sanitizeForPdf(value, font),
          font,
          PDF_FONT_SIZE,
          column.width - 4,
        ),
        { x, y, size: PDF_FONT_SIZE, font },
      );
      x += column.width;
    });

    y -= PDF_ROW_HEIGHT;
  }

  y -= 20;

  if (shipment.observations) {
    page.drawText('Observações:', {
      x: PDF_MARGIN,
      y,
      size: PDF_FONT_SIZE,
      font: boldFont,
    });
    y -= PDF_ROW_HEIGHT;
    page.drawText(
      truncateToWidth(
        sanitizeForPdf(shipment.observations, font),
        font,
        PDF_FONT_SIZE,
        PDF_PAGE_WIDTH - PDF_MARGIN * 2,
      ),
      { x: PDF_MARGIN, y, size: PDF_FONT_SIZE, font },
    );
    y -= PDF_ROW_HEIGHT;
  }

  const qrSize = 110;
  const signatureWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2 - qrSize - 20;
  const bottomY = Math.min(y - 30, PDF_MARGIN + qrSize + 30);

  page.drawLine({
    start: { x: PDF_MARGIN, y: bottomY },
    end: { x: PDF_MARGIN + signatureWidth, y: bottomY },
    thickness: 1,
  });
  page.drawText('Assinatura de quem recebeu', {
    x: PDF_MARGIN,
    y: bottomY - 14,
    size: PDF_FONT_SIZE,
    font,
  });

  const qrDataUrl = await QRCode.toDataURL(options.downloadUrl, {
    margin: 1,
    width: qrSize,
  });
  const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  const qrX = PDF_PAGE_WIDTH - PDF_MARGIN - qrSize;
  page.drawImage(qrImage, {
    x: qrX,
    y: bottomY - qrSize + PDF_FONT_SIZE,
    width: qrSize,
    height: qrSize,
  });
  page.drawText('Comprovante digital', {
    x: qrX,
    y: bottomY - qrSize,
    size: 7,
    font,
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
