import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { EnviarMensagemDto, WhatsappService } from './whatsapp.service';
import { WhatsappInstanceManager } from './whatsapp-baileys.service';

interface UsuarioJwt {
  id: string;
  email: string;
  perfil: string;
  tenantId: string;
}

@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly manager: WhatsappInstanceManager,
  ) {}

  /** Envia mensagem usando a instancia do tenant autenticado */
  @Post('enviar')
  enviar(@Body() dto: EnviarMensagemDto, @UsuarioAtual() usuario: UsuarioJwt) {
    return this.whatsappService.enviar(dto, usuario.tenantId);
  }

  /** Retorna status da conexao WhatsApp do tenant */
  @Get('status')
  async status(@UsuarioAtual() usuario: UsuarioJwt) {
    if (this.whatsappService.modoAtual === 'evolution') {
      return this.whatsappService.evolutionStatus(usuario.tenantId);
    }
    return this.manager.getStatus(usuario.tenantId);
  }

  /** Inicia conexao e retorna QR code (string bruta para renderizar com qrcode lib no front) */
  @Post('conectar')
  @HttpCode(200)
  async conectar(@UsuarioAtual() usuario: UsuarioJwt) {
    if (this.whatsappService.modoAtual === 'evolution') {
      return this.whatsappService.evolutionConectar(usuario.tenantId);
    }
    await this.manager.conectar(usuario.tenantId);
    // Aguarda ate 3s para o QR code aparecer
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const status = this.manager.getStatus(usuario.tenantId);
      if (status.status !== 'conectando') return status;
    }
    return this.manager.getStatus(usuario.tenantId);
  }

  /** Desconecta e remove sessao do tenant */
  @Delete('desconectar')
  @HttpCode(200)
  async desconectar(@UsuarioAtual() usuario: UsuarioJwt) {
    if (this.whatsappService.modoAtual === 'evolution') {
      await this.whatsappService.evolutionDesconectar(usuario.tenantId);
      return { sucesso: true };
    }
    await this.manager.desconectar(usuario.tenantId);
    return { sucesso: true };
  }
}
