import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { PdvService } from './pdv.service';
import { CreateVendaDto } from './dto/create-venda.dto';

class ConfiguracaoBalancaDto {
  @IsString()
  prefixo: string;

  @IsNumber()
  @IsInt()
  @Min(0)
  @Max(12)
  @Type(() => Number)
  posCodigo: number;

  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  tamCodigo: number;

  @IsNumber()
  @IsInt()
  @Min(0)
  @Max(12)
  @Type(() => Number)
  posValor: number;

  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  tamValor: number;
}

@ApiTags('PDV')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pdv')
export class PdvController {
  constructor(private readonly pdvService: PdvService) {}

  @Get('produto-barcode/:codigo')
  buscarPorBarcode(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('codigo') codigo: string,
  ) {
    return this.pdvService.buscarPorBarcode(usuario.tenantId, codigo);
  }

  @Post('vendas')
  fecharVenda(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreateVendaDto,
  ) {
    return this.pdvService.fecharVenda(usuario.tenantId, dto);
  }

  @Get('vendas')
  @ApiQuery({ name: 'dataInicio', required: false })
  @ApiQuery({ name: 'dataFim', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  listar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('page') page?: string,
  ) {
    return this.pdvService.listar(usuario.tenantId, {
      dataInicio,
      dataFim,
      page: page ? Number(page) : 1,
    });
  }

  @Get('resumo-dia')
  @ApiQuery({ name: 'data', required: false })
  resumoDia(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('data') data?: string,
  ) {
    return this.pdvService.resumoDia(usuario.tenantId, data);
  }

  @Get('vendas/:id')
  findOne(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.pdvService.findOne(usuario.tenantId, id);
  }

  @Patch('vendas/:id/cancelar')
  cancelar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.pdvService.cancelar(usuario.tenantId, id);
  }

  // ─── Configuração de balança ─────────────────────────────────

  @Get('configuracao-balanca')
  getConfiguracaoBalanca(@UsuarioAtual() usuario: { tenantId: string }) {
    return this.pdvService.getConfiguracaoBalanca(usuario.tenantId);
  }

  @Patch('configuracao-balanca')
  salvarConfiguracaoBalanca(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: ConfiguracaoBalancaDto,
  ) {
    return this.pdvService.salvarConfiguracaoBalanca(usuario.tenantId, dto);
  }
}
