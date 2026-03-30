import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { FinanceiroService } from './financeiro.service';
import { CreateLancamentoDto } from './dto/create-lancamento.dto';
import { TipoLancamento } from '@prisma/client';

@ApiTags('Financeiro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly financeiroService: FinanceiroService) {}

  @Get('lancamentos')
  @ApiQuery({ name: 'dataInicio', required: false })
  @ApiQuery({ name: 'dataFim', required: false })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoLancamento })
  listar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('tipo') tipo?: TipoLancamento,
  ) {
    return this.financeiroService.listar(usuario.tenantId, {
      dataInicio,
      dataFim,
      tipo,
    });
  }

  @Get('resumo-mes')
  @ApiQuery({ name: 'ano', required: false })
  @ApiQuery({ name: 'mes', required: false })
  resumoMes(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('ano') ano?: string,
    @Query('mes') mes?: string,
  ) {
    const now = new Date();
    return this.financeiroService.resumoMes(
      usuario.tenantId,
      ano ? Number(ano) : now.getFullYear(),
      mes ? Number(mes) : now.getMonth() + 1,
    );
  }

  @Post('lancamentos')
  criar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreateLancamentoDto,
  ) {
    return this.financeiroService.criar(dto, usuario.tenantId);
  }

  @Patch('lancamentos/:id')
  atualizar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: Partial<CreateLancamentoDto>,
  ) {
    return this.financeiroService.atualizar(usuario.tenantId, id, dto);
  }

  @Delete('lancamentos/:id')
  remover(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.financeiroService.remover(usuario.tenantId, id);
  }
}
