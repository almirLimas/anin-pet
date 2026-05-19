import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { AvaliacoesService } from './avaliacoes.service';

class ResponderAvaliacaoDto {
  @IsInt()
  @Min(1)
  @Max(5)
  nota: number;
}

@ApiTags('Avaliações')
@Controller('avaliacoes')
export class AvaliacoesController {
  constructor(private readonly avaliacoesService: AvaliacoesService) {}

  /** Rota PÚBLICA — retorna nome do petshop para exibir na página de avaliação */
  @Get('info/:token')
  @ApiOperation({ summary: 'Dados públicos da avaliação (nome do petshop)' })
  buscarInfo(@Param('token') token: string) {
    return this.avaliacoesService.buscarInfoPorToken(token);
  }

  /** Rota PÚBLICA — cliente acessa via link do e-mail */
  @Post('responder/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar avaliação via token (sem autenticação)' })
  responder(
    @Param('token') token: string,
    @Body() body: ResponderAvaliacaoDto,
  ) {
    return this.avaliacoesService.responder(token, body.nota);
  }

  /** Rotas PRIVADAS — petshop autenticado */
  @Get('resumo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resumo de satisfação do petshop' })
  resumo(@UsuarioAtual() usuario: { tenantId: string }) {
    return this.avaliacoesService.resumo(usuario.tenantId);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lista todas as avaliações respondidas' })
  listar(@UsuarioAtual() usuario: { tenantId: string }) {
    return this.avaliacoesService.listar(usuario.tenantId);
  }
}
