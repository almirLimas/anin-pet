import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IniciarPagamentoDto } from './dto/iniciar-pagamento.dto';
import { PagamentoService } from './pagamento.service';

@ApiTags('pagamento')
@Controller('pagamento')
export class PagamentoController {
  constructor(private readonly pagamentoService: PagamentoService) {}

  @Post('iniciar')
  @UseGuards(JwtAuthGuard)
  iniciar(
    @Body() dto: IniciarPagamentoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.pagamentoService.iniciarPagamento(
      dto,
      usuario.tenantId,
      usuario.email,
    );
  }

  /** Endpoint público — chamado pelo Mercado Pago via webhook */
  @Post('webhook')
  @HttpCode(200)
  webhook(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    return this.pagamentoService.processarWebhook(headers, body);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@UsuarioAtual() usuario: JwtPayload) {
    return this.pagamentoService.obterStatus(usuario.tenantId);
  }
}
