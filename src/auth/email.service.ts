import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly remetente: string;

  constructor(private readonly config: ConfigService) {
    this.remetente = config.getOrThrow<string>('EMAIL_FROM');

    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('EMAIL_HOST'),
      port: config.get<number>('EMAIL_PORT', 587),
      secure: config.get<boolean>('EMAIL_SECURE', false),
      auth: {
        user: config.getOrThrow<string>('EMAIL_USER'),
        pass: config.getOrThrow<string>('EMAIL_PASS'),
      },
    });
  }

  async enviarResetSenha(email: string, nome: string, link: string) {
    try {
      await this.transporter.sendMail({
        from: `"AninPet" <${this.remetente}>`,
        to: email,
        subject: 'Redefinição de senha — AninPet',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Redefinição de senha</h2>
            <p>Olá, <strong>${nome}</strong>!</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no AninPet.</p>
            <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${link}"
                 style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:16px;">
                Redefinir minha senha
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px;">
              Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
            <p style="color:#9ca3af;font-size:12px;">AninPet — Sistema de gestão para petshops</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail para ${email}`, err);
    }
  }
}
