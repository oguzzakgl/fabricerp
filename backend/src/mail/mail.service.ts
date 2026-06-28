import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(
        `SMTP Mail Transporter initialized successfully. Host: ${host}`,
      );
    } else {
      this.logger.warn(
        'SMTP configurations are missing in .env. MailService will run in SIMULATION mode and log emails to console.',
      );
    }
  }

  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    const from = process.env.SMTP_FROM || 'no-reply@fabricerp.com';

    this.logger.log(`Attempting to send email to: ${to} | Subject: ${subject}`);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
        });
        this.logger.log(`Email successfully sent to ${to}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send email to ${to}`, error);
        return false;
      }
    } else {
      this.logger.log(`[EMAIL SIMULATION]
From: ${from}
To: ${to}
Subject: ${subject}
Content (HTML):
${html}
======================================`);
      return true;
    }
  }

  async sendAdminNotificationOnRegister(
    tenantName: string,
    adminEmail: string,
  ) {
    const adminNotificationEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL || 'info@fabricerp.com';
    const subject = 'Yeni Üye Kaydı Bildirimi - FabricERP';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Yeni Üye Kaydı</h2>
        <p>Sisteminize yeni bir firma/bayi kaydoldu. Detaylar aşağıdadır:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0; width: 150px;">Firma/Tenant Adı:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${tenantName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Yönetici E-posta:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${adminEmail}">${adminEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Kayıt Tarihi:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${new Date().toLocaleString('tr-TR')}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #888;">Bu e-posta FabricERP sistemi tarafından otomatik olarak gönderilmiştir.</p>
      </div>
    `;

    return this.sendMail(adminNotificationEmail, subject, html);
  }
}
