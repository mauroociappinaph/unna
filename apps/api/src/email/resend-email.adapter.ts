import { Injectable, Inject } from '@nestjs/common';
import { EmailPort, EmailConfig } from '@unna/domain';
import { Resend } from 'resend';

@Injectable()
export class ResendEmailAdapter implements EmailPort {
  private readonly resend: Resend;
  private readonly config: EmailConfig;

  constructor(
    @Inject('EMAIL_CONFIG') config: EmailConfig,
    @Inject('RESEND_API_KEY') private readonly apiKey: string,
  ) {
    this.resend = new Resend(this.apiKey);
    this.config = config;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.resend.emails.send({
      from: this.config.from,
      to,
      subject,
      html,
      replyTo: this.config.replyTo,
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #16a34a;">Recuperá tu contraseña</h2>
            <p>Hiciste clic en "Olvidé mi contraseña". Si no fuiste vos, ignorá este email.</p>
            <p>
              <a href="${resetLink}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Restablecer contraseña
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">El link expira en 1 hora.</p>
            <hr style="margin: 20px 0; border-color: #eee;">
            <p style="color: #999; font-size: 12px;">UNNA - Una sola plataforma para tu restaurante</p>
          </div>
        </body>
      </html>
    `;
    await this.sendEmail(to, 'Restablecé tu contraseña - UNNA', html);
  }

  async sendEmailVerificationEmail(to: string, verificationLink: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #16a34a;">Verificá tu email</h2>
            <p>Gracias por registrarte en UNNA. Confirmá tu email para activar tu cuenta.</p>
            <p>
              <a href="${verificationLink}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Verificar email
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">El link expira en 24 horas.</p>
            <hr style="margin: 20px 0; border-color: #eee;">
            <p style="color: #999; font-size: 12px;">UNNA - Una sola plataforma para tu restaurante</p>
          </div>
        </body>
      </html>
    `;
    await this.sendEmail(to, 'Verificá tu email - UNNA', html);
  }
}