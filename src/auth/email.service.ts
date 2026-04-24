import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly remetente: string;

  constructor(private readonly config: ConfigService) {
    this.remetente = config.get<string>('EMAIL_FROM', 'noreply@aninpet.com.br');
  }

  private getResend(): Resend | null {
    const apiKey =
      this.config.get<string>('RESEND_API_KEY') ||
      process.env['RESEND_API_KEY'] ||
      '';

    // Diagnóstico temporário — remover após confirmar funcionamento
    const resendKeys = Object.keys(process.env).filter((k) =>
      k.toUpperCase().includes('RESEND'),
    );
    this.logger.debug(
      `[EmailService] Chaves com "RESEND" no process.env: [${resendKeys.join(', ')}]`,
    );
    this.logger.debug(`[EmailService] RESEND_API_KEY presente: ${!!apiKey}`);

    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY não configurada — e-mails não serão enviados.',
      );
      return null;
    }
    return new Resend(apiKey);
  }

  private async enviar(to: string, subject: string, html: string) {
    const resend = this.getResend();
    if (!resend) {
      this.logger.warn(`[EMAIL IGNORADO] Para: ${to} | Assunto: ${subject}`);
      return;
    }
    const { error } = await resend.emails.send({
      from: `AninPet <${this.remetente}>`,
      to,
      subject,
      html,
    });
    if (error) throw new Error(error.message);
  }

  async enviarBoasVindas(email: string, nome: string, nomePetshop: string) {
    try {
      await this.enviar(
        email,
        `Bem-vindo ao AninPet, ${nomePetshop}! 🐾`,
        `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #1d9fb6;">Tudo pronto para começar! 🎉</h2>
          <p>Olá, <strong>${nome}</strong>! Seu petshop <strong>${nomePetshop}</strong> está cadastrado no AninPet. Aqui estão os primeiros passos para configurar o sistema:</p>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="background:#f0fafb;">
              <td style="padding:12px 16px;font-size:22px;width:48px;">1️⃣</td>
              <td style="padding:12px 16px;">
                <strong>Cadastre seus serviços</strong><br/>
                <span style="color:#6b7280;font-size:13px;">Vá em <em>Serviços</em> e cadastre banho, tosa, consulta etc. com o preço e duração de cada um.</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:22px;">2️⃣</td>
              <td style="padding:12px 16px;">
                <strong>Configure a taxa de busca (taxidog)</strong><br/>
                <span style="color:#6b7280;font-size:13px;">Se seu petshop faz transporte de pets, defina o valor fixo da taxa em <em>Configurações → Taxa de busca</em>. Esse valor será somado automaticamente nos agendamentos marcados como "Petshop Busca".</span>
              </td>
            </tr>
            <tr style="background:#f0fafb;">
              <td style="padding:12px 16px;font-size:22px;">3️⃣</td>
              <td style="padding:12px 16px;">
                <strong>Defina sua meta mensal</strong><br/>
                <span style="color:#6b7280;font-size:13px;">Em <em>Configurações → Meta mensal</em>, informe quanto você quer faturar por mês. O painel vai mostrar seu progresso em tempo real.</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:22px;">4️⃣</td>
              <td style="padding:12px 16px;">
                <strong>Cadastre seus clientes e pets</strong><br/>
                <span style="color:#6b7280;font-size:13px;">Adicione os clientes na seção <em>Clientes</em>. Você já pode incluir os pets deles no mesmo cadastro.</span>
              </td>
            </tr>
            <tr style="background:#f0fafb;">
              <td style="padding:12px 16px;font-size:22px;">5️⃣</td>
              <td style="padding:12px 16px;">
                <strong>Faça seu primeiro agendamento</strong><br/>
                <span style="color:#6b7280;font-size:13px;">Na agenda, clique em <em>Novo agendamento</em>, escolha o cliente, o pet, o serviço e o horário. Pronto!</span>
              </td>
            </tr>
          </table>

          <p style="color:#6b7280;font-size:13px;">Você tem <strong>7 dias de teste gratuito</strong>. Aproveite para explorar todas as funcionalidades!</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">AninPet — Sistema de gestão para petshops</p>
        </div>
      `,
      );
    } catch (err) {
      this.logger.error(
        `Falha ao enviar e-mail de boas-vindas para ${email}`,
        err,
      );
    }
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
          <p>Seus 7 dias de teste gratuito chegaram ao fim. Para continuar usando o sistema sem interrupções, ative sua assinatura agora.</p>
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
    const opcoes = [
      { nota: 1, emoji: '😞', label: 'Muito ruim' },
      { nota: 2, emoji: '😕', label: 'Ruim' },
      { nota: 3, emoji: '😐', label: 'Regular' },
      { nota: 4, emoji: '🙂', label: 'Bom' },
      { nota: 5, emoji: '😍', label: 'Excelente' },
    ];

    const estrelas = opcoes
      .map(
        ({ nota: n, emoji, label }) =>
          `<a href="${linkAvaliacao}?nota=${n}"
             style="display:inline-block;margin:0 6px;padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;text-decoration:none;text-align:center;min-width:60px;">
            <div style="font-size:28px;line-height:1;">${emoji}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">${label}</div>
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

  async enviarAlertaAgendamentoConcluido(params: {
    nomePetshop: string;
    tenantId: string;
    nomeCliente: string;
    nomePet: string;
    servicos: string;
    formaPagamento?: string | null;
    valor: number;
  }) {
    const adminEmail = this.config.get<string>(
      'ADMIN_NOTIFICATION_EMAIL',
      'josealmirsla@gmail.com',
    );
    const {
      nomePetshop,
      tenantId,
      nomeCliente,
      nomePet,
      servicos,
      formaPagamento,
      valor,
    } = params;
    const valorFmt = valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const dataHora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    try {
      await this.enviar(
        adminEmail,
        `✅ Agendamento concluído — ${nomePetshop}`,
        `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#1d9fb6;">Agendamento concluído 🐾</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px;">Petshop</td><td style="padding:6px 0;font-size:14px;font-weight:bold;">${nomePetshop}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Tenant ID</td><td style="padding:6px 0;font-size:13px;color:#9ca3af;">${tenantId}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Cliente</td><td style="padding:6px 0;font-size:14px;">${nomeCliente}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Pet</td><td style="padding:6px 0;font-size:14px;">${nomePet}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Serviços</td><td style="padding:6px 0;font-size:14px;">${servicos}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Pagamento</td><td style="padding:6px 0;font-size:14px;">${formaPagamento ?? '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Valor</td><td style="padding:6px 0;font-size:14px;font-weight:bold;color:#10b981;">${valorFmt}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Horário</td><td style="padding:6px 0;font-size:14px;">${dataHora}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">AninPet — notificação interna</p>
        </div>
      `,
      );
    } catch (err) {
      this.logger.error('Falha ao enviar alerta de agendamento concluído', err);
    }
  }

  async enviarAlertaVendaPdv(params: {
    nomePetshop: string;
    tenantId: string;
    numeroPedido: number;
    itens: string;
    formaPagamento?: string | null;
    valor: number;
    nomeCliente?: string | null;
  }) {
    const adminEmail = this.config.get<string>(
      'ADMIN_NOTIFICATION_EMAIL',
      'josealmirsla@gmail.com',
    );
    const {
      nomePetshop,
      tenantId,
      numeroPedido,
      itens,
      formaPagamento,
      valor,
      nomeCliente,
    } = params;
    const valorFmt = valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const dataHora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    try {
      await this.enviar(
        adminEmail,
        `🛍️ Venda PDV #${numeroPedido} — ${nomePetshop}`,
        `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#f07030;">Venda PDV realizada 🛒</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px;">Petshop</td><td style="padding:6px 0;font-size:14px;font-weight:bold;">${nomePetshop}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Tenant ID</td><td style="padding:6px 0;font-size:13px;color:#9ca3af;">${tenantId}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Pedido</td><td style="padding:6px 0;font-size:14px;">#${numeroPedido}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Cliente</td><td style="padding:6px 0;font-size:14px;">${nomeCliente ?? 'Não informado'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Itens</td><td style="padding:6px 0;font-size:14px;">${itens}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Pagamento</td><td style="padding:6px 0;font-size:14px;">${formaPagamento ?? '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Total</td><td style="padding:6px 0;font-size:14px;font-weight:bold;color:#10b981;">${valorFmt}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Horário</td><td style="padding:6px 0;font-size:14px;">${dataHora}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">AninPet — notificação interna</p>
        </div>
      `,
      );
    } catch (err) {
      this.logger.error('Falha ao enviar alerta de venda PDV', err);
    }
  }

  async enviarAlertaErro(params: {
    metodo: string;
    url: string;
    status: number;
    mensagem: string;
    stack?: string;
  }) {
    const alertEmail = this.config.get<string>('ALERT_EMAIL');
    if (!alertEmail) return;

    const { metodo, url, status, mensagem, stack } = params;
    const dataHora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    const stackHtml = stack
      ? `<pre style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;font-size:11px;overflow:auto;color:#374151;">${stack.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre>`
      : '';

    try {
      await this.enviar(
        alertEmail,
        `🚨 Erro ${status} em produção — AninPet`,
        `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#dc2626;">🚨 Erro ${status} detectado em produção</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr style="background:#fef2f2;">
              <td style="padding:8px 12px;color:#6b7280;font-size:14px;width:120px;">Status</td>
              <td style="padding:8px 12px;font-size:14px;font-weight:bold;color:#dc2626;">${status}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Rota</td>
              <td style="padding:8px 12px;font-size:14px;font-family:monospace;">${metodo} ${url}</td>
            </tr>
            <tr style="background:#fef2f2;">
              <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Mensagem</td>
              <td style="padding:8px 12px;font-size:14px;">${mensagem}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Horário</td>
              <td style="padding:8px 12px;font-size:14px;">${dataHora}</td>
            </tr>
          </table>
          ${stackHtml}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">AninPet — alerta automático de erro em produção</p>
        </div>
      `,
      );
    } catch (err) {
      this.logger.error('Falha ao enviar alerta de erro', err);
    }
  }
}
