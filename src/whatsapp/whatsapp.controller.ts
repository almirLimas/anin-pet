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
    return this.whatsappService.enviar(dto, usuario.id);
  }

  /** Retorna status da conexao WhatsApp do tenant */
  @Get('status')
  status(@UsuarioAtual() usuario: UsuarioJwt) {
    return this.manager.getStatus(usuario.id);
  }

  /** Inicia conexao e retorna QR code (string bruta para renderizar com qrcode lib no front) */
  @Post('conectar')
  @HttpCode(200)
  async conectar(@UsuarioAtual() usuario: UsuarioJwt) {
    await this.manager.conectar(usuario.id);
    // Aguarda ate 3s para o QR code aparecer
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const status = this.manager.getStatus(usuario.id);
      if (status.status !== 'conectando') return status;
    }
    return this.manager.getStatus(usuario.id);
  }

  /** Desconecta e remove sessao do tenant */
  @Delete('desconectar')
  @HttpCode(200)
  async desconectar(@UsuarioAtual() usuario: UsuarioJwt) {
    await this.manager.desconectar(usuario.id);
    return { sucesso: true };
  }
}
