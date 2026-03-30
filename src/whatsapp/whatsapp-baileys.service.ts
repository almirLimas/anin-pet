import { Injectable, Logger } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { join } from 'node:path';

const silentLogger = {
  level: 'silent',
  child: () => silentLogger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

interface Instancia {
  sock: ReturnType<typeof makeWASocket>;
  conectado: boolean;
  qrCode: string | null;
}

/**
 * Gerencia uma sessão Baileys por tenant (usuarioId).
 * Cada petshop conecta o próprio WhatsApp — sessão salva em
 * .whatsapp-session/{tenantId}/
 */
@Injectable()
export class WhatsappInstanceManager {
  private readonly logger = new Logger(WhatsappInstanceManager.name);
  private readonly instancias = new Map<string, Instancia>();

  async conectar(tenantId: string): Promise<void> {
    if (this.instancias.has(tenantId)) return;

    const dir = join(process.cwd(), '.whatsapp-session', tenantId);
    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const { version } = await fetchLatestBaileysVersion();

    const instancia: Instancia = {
      sock: null!,
      conectado: false,
      qrCode: null,
    };
    this.instancias.set(tenantId, instancia);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: silentLogger as any,
    });
    instancia.sock = sock;

    sock.ev.on('creds.update', () => {
      void saveCreds();
    });

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        instancia.qrCode = qr;
        this.logger.log(`[${tenantId}] QR code gerado — aguardando scan`);
      }

      if (connection === 'open') {
        instancia.conectado = true;
        instancia.qrCode = null;
        this.logger.log(`✅ [${tenantId}] WhatsApp conectado!`);
      }

      if (connection === 'close') {
        instancia.conectado = false;
        const codigo = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const deslogado =
          codigo === (DisconnectReason.loggedOut as unknown as number);

        if (deslogado) {
          this.instancias.delete(tenantId);
          this.logger.warn(
            `[${tenantId}] Desconectado (logout). Refaça o QR code.`,
          );
        } else {
          this.logger.warn(`[${tenantId}] Conexão perdida, reconectando...`);
          this.instancias.delete(tenantId);
          void this.conectar(tenantId);
        }
      }
    });
  }

  async desconectar(tenantId: string): Promise<void> {
    const inst = this.instancias.get(tenantId);
    if (!inst) return;
    await inst.sock.logout();
    this.instancias.delete(tenantId);
    this.logger.log(`[${tenantId}] Desconectado manualmente.`);
  }

  getStatus(tenantId: string) {
    const inst = this.instancias.get(tenantId);
    if (!inst) return { status: 'desconectado' as const, qrCode: null };
    if (inst.qrCode)
      return { status: 'aguardando_scan' as const, qrCode: inst.qrCode };
    if (inst.conectado) return { status: 'conectado' as const, qrCode: null };
    return { status: 'conectando' as const, qrCode: null };
  }

  async enviar(
    tenantId: string,
    numero: string,
    mensagem: string,
  ): Promise<void> {
    const inst = this.instancias.get(tenantId);
    if (!inst?.conectado) {
      throw new Error(
        'WhatsApp não conectado. Vá em Configurações → WhatsApp e escaneie o QR code.',
      );
    }
    const jid = `${numero}@s.whatsapp.net`;
    await inst.sock.sendMessage(jid, { text: mensagem });
    this.logger.log(`[${tenantId}] Mensagem enviada para +${numero}`);
  }
}
