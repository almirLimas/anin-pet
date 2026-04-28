import {
  Controller,
  Get,
  Post,
  Query,
  Redirect,
  ParseIntPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { NpsService } from './nps.service';
import { AdminApiKeyGuard } from '../admin/admin-api-key.guard';

@Controller('nps')
export class NpsController {
  constructor(private readonly nps: NpsService) {}

  /**
   * Endpoint público — chamado quando o dono do petshop clica na nota do e-mail.
   * Redireciona para uma página de agradecimento no frontend.
   */
  @Get('responder')
  @Redirect()
  async responder(
    @Query('token') token: string,
    @Query('nota', ParseIntPipe) nota: number,
    @Query('comentario') comentario?: string,
  ) {
    if (!token) throw new BadRequestException('Token inválido.');
    if (nota < 1 || nota > 5) throw new BadRequestException('Nota inválida.');

    const resultado = await this.nps.responder(token, nota, comentario);

    const base =
      process.env['FRONTEND_URL']?.split(',')[0]?.trim().replace(/\/$/, '') ??
      'https://app.aninpet.com.br';

    if (resultado.jaRespondido) {
      return { url: `${base}/nps/obrigado?repetido=1` };
    }

    return { url: `${base}/nps/obrigado?nota=${nota}` };
  }

  /**
   * Endpoint admin — aciona o envio de NPS manualmente (sem esperar o cron).
   * POST /nps/disparar
   */
  @Post('disparar')
  @UseGuards(AdminApiKeyGuard)
  disparar() {
    return this.nps.dispararNPS();
  }

  /**
   * Endpoint admin — lista todos os feedbacks respondidos.
   */
  @Get()
  @UseGuards(AdminApiKeyGuard)
  listar() {
    return this.nps.listar();
  }
}
