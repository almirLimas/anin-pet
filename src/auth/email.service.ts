import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly remetente: string;

  constructor(private readonly config: ConfigService) {
    this.remetente = config.get<string>('EMAIL_FROM', 'noreply@aninpet.com.br');
    const apiKey = config.get<string>('RESEND_API_KEY', '');
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY não configurada — e-mails não serão enviados.',
      );
      this.resend = null;
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  private async enviar(to: string, subject: string, html: string) {
    if (!this.resend) {
      this.logger.warn(`[EMAIL IGNORADO] Para: ${to} | Assunto: ${subject}`);
      return;
    }
    const { error } = await this.resend.emails.send({
      from: `AninPet <${this.remetente}>`,
      to,
      subject,
      html,
    });
    if (error) throw new Error(error.message);
  }

  async enviarResetSenha(email: string, nome: string, link: string) {
    try {
      await this.enviar(
        email,
        'Redefinição de senha — AninPet',
        `
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
      );
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail para ${email}`, err);
      throw err;
    }
  }

  async enviarTrialExpirado(email: string, nome: string, link: string) {
    try {
      await this.enviar(
        email,
        'Seu período de teste terminou — AninPet',
        `
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
      );
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
    const urgente = diasRestantes === 1;
    const subject = urgente
      ? 'Seu teste gratuito acaba amanhã — AninPet'
      : `Seu teste gratuito expira em ${diasRestantes} dias — AninPet`;

    const corBotao = urgente ? '#ef4444' : '#f07030';
    const mensagem = urgente
      ? 'Seu período de teste gratuito <strong>termina amanhã</strong>. Não perca o acesso ao seu sistema — ative sua assinatura agora!'
      : `Faltam apenas <strong>${diasRestantes} dias</strong> para o fim do seu período de teste gratuito. Garanta já sua assinatura para continuar organizando seu petshop sem interrupções.`;

    try {
      await this.enviar(
        email,
        subject,
        `
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
      );
    } catch (err) {
      this.logger.error(
        `Falha ao enviar aviso de trial expirando para ${email}`,
        err,
      );
    }
  }

  async enviarNotificacaoNovoCadastro(
    nomeCliente: string,
    emailCliente: string,
    nomePetshop: string,
  ) {
    const adminEmail = this.config.get<string>('ADMIN_NOTIFICATION_EMAIL');
    if (!adminEmail) return;

    try {
      await this.enviar(
        adminEmail,
        '🐾 Novo cadastro no AninPet!',
        `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1d9fb6;">Novo cliente cadastrado! 🎉</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;">Nome</td>
              <td style="padding:8px 0;font-weight:bold;font-size:14px;">${nomeCliente}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;">E-mail</td>
              <td style="padding:8px 0;font-size:14px;">${emailCliente}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;">Petshop</td>
              <td style="padding:8px 0;font-size:14px;">${nomePetshop}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;">Data</td>
              <td style="padding:8px 0;font-size:14px;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">AninPet — Sistema de gestão para petshops</p>
        </div>
      `,
      );
    } catch (err) {
      this.logger.error('Falha ao enviar notificação de novo cadastro', err);
    }
  }

  async enviarLembreteRetorno(
    email: string,
    nomeCliente: string,
    nomePet: string,
    nomePetshop: string,
    diasSemVisita: number,
  ) {
    try {
      await this.enviar(
        email,
        `${nomePet} está com saudades do petshop! 🐾`,
        `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1d9fb6;">Está na hora de cuidar do ${nomePet}! 🐾</h2>
          <p>Olá, <strong>${nomeCliente}</strong>!</p>
          <p>Já faz <strong>${diasSemVisita} dias</strong> desde a última visita do <strong>${nomePet}</strong> ao <strong>${nomePetshop}</strong>.</p>
          <p>Que tal agendar um banho, tosa ou consulta? Seu pet merece sempre o melhor cuidado! 😊</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">AninPet — Sistema de gestão para petshops</p>
        </div>
      `,
      );
    } catch (err) {
      this.logger.error(
        `Falha ao enviar lembrete de retorno para ${email}`,
        err,
      );
    }
  }

  async enviarPesquisaSatisfacao(
    email: string,
    nomeCliente: string,
    nomePet: string,
    nomeServico: string,
    nomePetshop: string,
    linkAvaliacao: string,
  ) {
    const estrelas = [1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<a href="${linkAvaliacao}?nota=${n}"
             style="display:inline-block;margin:0 4px;padding:10px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;text-decoration:none;font-size:22px;color:#f59e0b;">
            ${'⭐'.repeat(n)}
          </a>`,
      )
      .join('');

    try {
      await this.enviar(
        email,
        `Como foi o ${nomeServico} do ${nomePet}? — ${nomePetshop}`,
        `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #1d9fb6;">Como foi a experiência? 🐾</h2>
          <p>Olá, <strong>${nomeCliente}</strong>!</p>
          <p>
            O <strong>${nomeServico}</strong> do <strong>${nomePet}</strong> no
            <strong>${nomePetshop}</strong> acabou de ser concluído.
            Sua opinião é muito importante para continuarmos melhorando!
          </p>
          <p style="font-weight:bold;margin-bottom:8px;">Clique para avaliar sua experiência:</p>
          <div style="text-align:center;margin:24px 0;">
            ${estrelas}
          </div>
          <p style="color:#6b7280;font-size:13px;">
            Leva menos de 10 segundos e nos ajuda a oferecer um serviço cada vez melhor para você e seu pet. 😊
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">AninPet — Sistema de gestão para petshops</p>
        </div>
      `,
      );
    } catch (err) {
      this.logger.error(
        `Falha ao enviar pesquisa de satisfação para ${email}`,
        err,
      );
    }
  }
}
