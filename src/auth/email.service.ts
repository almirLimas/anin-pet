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

    const secure = config.get<boolean>('EMAIL_SECURE', false);

    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('EMAIL_HOST'),
      port: config.get<number>('EMAIL_PORT', 587),
      secure,
      requireTLS: !secure,
      auth: {
        user: config.getOrThrow<string>('EMAIL_USER'),
        pass: config.getOrThrow<string>('EMAIL_PASS'),
      },
    });
  }

  async enviarResetSenha(email: string, nome: string, link: string) {
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';

    if (isDev) {
      this.logger.warn(`[DEV] Link de redefinição para ${email}: ${link}`);
      return; // Em dev, apenas loga o link — não tenta enviar e-mail
    }

    try {
      await this.transporter.sendMail({
        from: `"AninPet" <${this.remetente}>`,
        to: email,
        subject: 'Redefinição de senha — AninPet',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1d9fb6;">Redefinição de senha</h2>
            <p>Olá, <strong>${nome}</strong>!</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no AninPet.</p>
            <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${link}"
                 style="background:#1d9fb6;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:16px;">
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
      if (!isDev) throw err;
    }
  }

  async enviarTrialExpirado(email: string, nome: string, link: string) {
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';

    if (isDev) {
      this.logger.warn(`[DEV] Link de renovação para ${email}: ${link}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"AninPet" <${this.remetente}>`,
        to: email,
        subject: 'Seu período de teste terminou — AninPet',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1d9fb6;">Hora de assinar o AninPet 🐾</h2>
            <p>Olá, <strong>${nome}</strong>!</p>
            <p>Seus 14 dias de teste gratuito chegaram ao fim. Para continuar usando o sistema sem interrupções, ative sua assinatura agora.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${link}"
                 style="background:#1d9fb6;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:16px;">
                Ativar minha assinatura
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px;">
              Após o pagamento, seu acesso será reativado automaticamente em instantes.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
            <p style="color:#9ca3af;font-size:12px;">AninPet — Sistema de gestão para petshops</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail de trial para ${email}`, err);
    }
  }

  async enviarTrialExpirando(
    email: string,
    nome: string,
    link: string,
    diasRestantes: number,
  ) {
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';

    if (isDev) {
      this.logger.warn(
        `[DEV] Aviso trial expirando em ${diasRestantes}d para ${email}: ${link}`,
      );
      return;
    }

    const urgente = diasRestantes === 1;
    const subject = urgente
      ? 'Seu teste gratuito acaba amanhã — AninPet'
      : `Seu teste gratuito expira em ${diasRestantes} dias — AninPet`;

    const corBotao = urgente ? '#ef4444' : '#f07030';
    const mensagem = urgente
      ? 'Seu período de teste gratuito <strong>termina amanhã</strong>. Não perca o acesso ao seu sistema — ative sua assinatura agora!'
      : `Faltam apenas <strong>${diasRestantes} dias</strong> para o fim do seu período de teste gratuito. Garanta já sua assinatura para continuar organizando seu petshop sem interrupções.`;

    try {
      await this.transporter.sendMail({
        from: `"AninPet" <${this.remetente}>`,
        to: email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1d9fb6;">Seu teste está chegando ao fim 🐾</h2>
            <p>Olá, <strong>${nome}</strong>!</p>
            <p>${mensagem}</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${link}"
                 style="background:${corBotao};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:16px;">
                Ativar minha assinatura
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px;">
              Após o pagamento, seu acesso continua normalmente sem nenhuma interrupção.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
            <p style="color:#9ca3af;font-size:12px;">AninPet — Sistema de gestão para petshops</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(
        `Falha ao enviar aviso de trial expirando para ${email}`,
        err,
      );
    }
  }
}
