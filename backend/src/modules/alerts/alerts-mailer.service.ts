import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

const DEFAULT_SMTP_PORT = 587;
const CONNECTION_TIMEOUT_MS = 5000;

// Envio de e-mails de alerta - seção 4.10. Habilitado via
// ENABLE_EMAIL_ALERTS no .env; falhas de envio (ex: credenciais SMTP
// inválidas) são logadas e não interrompem o job de geração de alertas.
@Injectable()
export class AlertsMailerService {
  private readonly logger = new Logger(AlertsMailerService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<string>('ENABLE_EMAIL_ALERTS') === 'true';
  }

  async sendAlertEmail(
    to: string,
    subject: string,
    text: string,
  ): Promise<boolean> {
    try {
      await this.getTransporter().sendMail({
        from: this.config.get<string>(
          'SMTP_FROM',
          'Sistema Logistica <no-reply@logflow.com>',
        ),
        to,
        subject,
        text,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Falha ao enviar e-mail de alerta para ${to}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const port = this.getEnvNumber('SMTP_PORT', DEFAULT_SMTP_PORT);
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port,
        secure: port === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
        connectionTimeout: CONNECTION_TIMEOUT_MS,
      });
    }
    return this.transporter;
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const raw = this.config.get<string>(key);
    return raw !== undefined ? Number(raw) : defaultValue;
  }
}
