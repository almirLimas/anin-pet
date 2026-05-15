import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappInstanceManager } from './whatsapp-baileys.service';

export interface EnviarMensagemDto {
  telefone: string;
  mensagem: string;
  clienteId?: string;
  nomeCliente?: string;
}

export interface ResultadoEnvio {
  sucesso: boolean;
  simulado: boolean;
  mensagem: string;
  telefone: string;
  enviadoEm: string;
  detalhes?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  // ── Variáveis de configuração (.env) ─────────────────────────────────────
  //
  //  WHATSAPP_MODE=simulacao | zapi | evolution
  //
  //  Z-API (recomendado para começar — sem Docker, só criar conta):
  //    ZAPI_INSTANCE_ID=seu-instance-id
  //    ZAPI_TOKEN=seu-token
  //    ZAPI_CLIENT_TOKEN=seu-client-token   (Security Token do painel)
  //
  //  Evolution API (self-hosted com Docker):
  //    EVOLUTION_API_URL=http://localhost:8080
  //    EVOLUTION_API_KEY=sua-chave
  //    EVOLUTION_INSTANCE=meu-pet

  private readonly modo: string;

  // Z-API
  private readonly zapiInstanceId: string;
  private readonly zapiToken: string;
  private readonly zapiClientToken: string;

  // Evolution
  private readonly evolutionUrl: string;
  private readonly evolutionKey: string;
  private readonly evolutionInstance: string;

  constructor(
    private readonly config: ConfigService,
    private readonly baileys: WhatsappInstanceManager,
  ) {
    this.modo = config.get<string>('WHATSAPP_MODE', 'simulacao');

    this.zapiInstanceId = config.get<string>('ZAPI_INSTANCE_ID', '');
    this.zapiToken = config.get<string>('ZAPI_TOKEN', '');
    this.zapiClientToken = config.get<string>('ZAPI_CLIENT_TOKEN', '');

    this.evolutionUrl = config.get<string>('EVOLUTION_API_URL', '');
    this.evolutionKey = config.get<string>('EVOLUTION_API_KEY', '');
    this.evolutionInstance = config.get<string>(
      'EVOLUTION_INSTANCE',
      'meu-pet',
    );
  }

  async enviar(
    dto: EnviarMensagemDto,
    tenantId?: string,
  ): Promise<ResultadoEnvio> {
    const tel = dto.telefone.replaceAll(/\D/gu, '');
    const numero = tel.startsWith('55') ? tel : `55${tel}`;
    const agora = new Date().toISOString();

    if (this.modo === 'baileys') {
      return this._enviarBaileys(
        numero,
        dto.mensagem,
        agora,
        tenantId ?? 'default',
      );
    }

    if (this.modo === 'zapi') {
      return this._enviarZApi(numero, dto.mensagem, agora);
    }

    if (this.modo === 'evolution') {
      return this._enviarEvolution(numero, dto.mensagem, agora, tenantId);
    }

    // ── MODO SIMULAÇÃO (padrão) ───────────────────────────────────────────
    this.logger.log('══════════════════════════════════════════════════');
    this.logger.log(' [WHATSAPP SIMULADO]');
    this.logger.log(` Para:     +${numero}`);
    if (dto.nomeCliente) this.logger.log(` Cliente:  ${dto.nomeCliente}`);
    this.logger.log(` Mensagem: ${dto.mensagem}`);
    this.logger.log('══════════════════════════════════════════════════');

    return {
      sucesso: true,
      simulado: true,
      mensagem: dto.mensagem,
      telefone: `+${numero}`,
      enviadoEm: agora,
      detalhes:
        'Modo simulação ativo. Defina WHATSAPP_MODE=baileys (grátis) no .env para enviar de verdade.',
    };
  }

  // ── Baileys (gratuito, WhatsApp Web) ───────────────────────────────────
  private async _enviarBaileys(
    numero: string,
    mensagem: string,
    agora: string,
    tenantId: string,
  ): Promise<ResultadoEnvio> {
    try {
      await this.baileys.enviar(tenantId, numero, mensagem);
      return {
        sucesso: true,
        simulado: false,
        mensagem,
        telefone: `+${numero}`,
        enviadoEm: agora,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha Baileys: ${msg}`);
      return {
        sucesso: false,
        simulado: false,
        mensagem,
        telefone: `+${numero}`,
        enviadoEm: agora,
        detalhes: msg,
      };
    }
  }

  // ── Z-API ─────────────────────────────────────────────────────────────────
  private async _enviarZApi(
    numero: string,
    mensagem: string,
    agora: string,
  ): Promise<ResultadoEnvio> {
    try {
      const url = `https://api.z-api.io/instances/${this.zapiInstanceId}/token/${this.zapiToken}/send-text`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.zapiClientToken,
        },
        body: JSON.stringify({ phone: numero, message: mensagem }),
      });

      const json = (await res.json()) as { zaapId?: string; error?: string };

      if (!res.ok || json.error) {
        const detalhe = json.error ?? `HTTP ${res.status}`;
        this.logger.error(`Z-API erro: ${detalhe}`);
        return {
          sucesso: false,
          simulado: false,
          mensagem,
          telefone: `+${numero}`,
          enviadoEm: agora,
          detalhes: `Z-API: ${detalhe}`,
        };
      }

      this.logger.log(
        `[Z-API] Mensagem enviada para +${numero} (id: ${json.zaapId ?? '?'})`,
      );
      return {
        sucesso: true,
        simulado: false,
        mensagem,
        telefone: `+${numero}`,
        enviadoEm: agora,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha Z-API: ${msg}`);
      return {
        sucesso: false,
        simulado: false,
        mensagem,
        telefone: `+${numero}`,
        enviadoEm: agora,
        detalhes: msg,
      };
    }
  }

  // ── Evolution API (self-hosted) ───────────────────────────────────────────
  private async _enviarEvolution(
    numero: string,
    mensagem: string,
    agora: string,
    tenantId?: string,
  ): Promise<ResultadoEnvio> {
    try {
      const instancia = tenantId ?? this.evolutionInstance;
      const url = `${this.evolutionUrl}/message/sendText/${instancia}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.evolutionKey,
        },
        body: JSON.stringify({
          number: `${numero}@s.whatsapp.net`,
          textMessage: { text: mensagem },
        }),
      });

      if (!res.ok) {
        const erro = await res.text();
        this.logger.error(`Evolution API erro: ${erro}`);
        return {
          sucesso: false,
          simulado: false,
          mensagem,
          telefone: `+${numero}`,
          enviadoEm: agora,
          detalhes: `Erro na Evolution API: ${res.status} - ${erro}`,
        };
      }

      this.logger.log(
        `[Evolution] Mensagem enviada para +${numero} (instancia: ${instancia})`,
      );
      return {
        sucesso: true,
        simulado: false,
        mensagem,
        telefone: `+${numero}`,
        enviadoEm: agora,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha Evolution API: ${msg}`);
      return {
        sucesso: false,
        simulado: false,
        mensagem,
        telefone: `+${numero}`,
        enviadoEm: agora,
        detalhes: msg,
      };
    }
  }

  // ── Evolution: status / conectar / desconectar ────────────────────────────

  get modoAtual() {
    return this.modo;
  }

  async evolutionStatus(tenantId: string): Promise<{
    status: string;
    qrDataUrl?: string;
  }> {
    const instancia = tenantId ?? this.evolutionInstance;
    try {
      const res = await fetch(
        `${this.evolutionUrl}/instance/connectionState/${instancia}`,
        { headers: { apikey: this.evolutionKey } },
      );
      if (!res.ok) return { status: 'desconectado' };
      const json = (await res.json()) as { instance?: { state?: string } };
      const state = json.instance?.state ?? 'unknown';
      // Estados Evolution: open, connecting, close, qr
      if (state === 'open') return { status: 'conectado' };
      if (state === 'connecting') return { status: 'conectando' };
      return { status: 'desconectado' };
    } catch {
      return { status: 'desconectado' };
    }
  }

  async evolutionConectar(tenantId: string): Promise<{
    status: string;
    qrCode: string | null;
  }> {
    const instancia = tenantId ?? this.evolutionInstance;

    // Verifica se a instância já existe
    const checkRes = await fetch(
      `${this.evolutionUrl}/instance/connectionState/${instancia}`,
      { headers: { apikey: this.evolutionKey } },
    );

    if (checkRes.ok) {
      // Instância existe — solicita novo QR (reconectar)
      const connRes = await fetch(
        `${this.evolutionUrl}/instance/connect/${instancia}`,
        { headers: { apikey: this.evolutionKey } },
      );
      if (!connRes.ok) {
        const txt = await connRes.text();
        throw new Error(`Evolution connect erro: ${connRes.status} - ${txt}`);
      }
      const connJson = (await connRes.json()) as { base64?: string };
      if (connJson.base64) {
        return { status: 'aguardando_scan', qrCode: connJson.base64 };
      }
      // Sem QR — verifica o estado real antes de assumir "conectado"
      const stateRes = await fetch(
        `${this.evolutionUrl}/instance/connectionState/${instancia}`,
        { headers: { apikey: this.evolutionKey } },
      );
      if (stateRes.ok) {
        const stateJson = (await stateRes.json()) as {
          instance?: { state?: string };
        };
        const state = stateJson.instance?.state;
        if (state === 'open') return { status: 'conectado', qrCode: null };
      }
      return { status: 'desconectado', qrCode: null };
    }

    // Instância não existe — cria e já recebe o QR no response
    const createRes = await fetch(`${this.evolutionUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.evolutionKey,
      },
      body: JSON.stringify({
        instanceName: instancia,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });

    if (!createRes.ok) {
      const txt = await createRes.text();
      throw new Error(`Evolution create erro: ${createRes.status} - ${txt}`);
    }

    const createJson = (await createRes.json()) as {
      qrcode?: { base64?: string };
    };

    const base64 = createJson.qrcode?.base64;
    if (base64) {
      return { status: 'aguardando_scan', qrCode: base64 };
    }

    // Criou mas sem QR ainda — tenta buscar
    const connRes2 = await fetch(
      `${this.evolutionUrl}/instance/connect/${instancia}`,
      { headers: { apikey: this.evolutionKey } },
    );
    if (connRes2.ok) {
      const j = (await connRes2.json()) as { base64?: string };
      if (j.base64) return { status: 'aguardando_scan', qrCode: j.base64 };
    }

    return { status: 'conectando', qrCode: null };
  }

  async evolutionDesconectar(tenantId: string): Promise<void> {
    const instancia = tenantId ?? this.evolutionInstance;
    await fetch(`${this.evolutionUrl}/instance/logout/${instancia}`, {
      method: 'DELETE',
      headers: { apikey: this.evolutionKey },
    });
  }
}
