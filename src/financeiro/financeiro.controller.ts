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
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('tipo') tipo?: TipoLancamento,
  ) {
    return this.financeiroService.listar({ dataInicio, dataFim, tipo });
  }

  @Get('resumo-mes')
  @ApiQuery({ name: 'ano', required: false })
  @ApiQuery({ name: 'mes', required: false })
  resumoMes(@Query('ano') ano?: string, @Query('mes') mes?: string) {
    const now = new Date();
    return this.financeiroService.resumoMes(
      ano ? Number(ano) : now.getFullYear(),
      mes ? Number(mes) : now.getMonth() + 1,
    );
  }

  @Post('lancamentos')
  criar(@Body() dto: CreateLancamentoDto) {
    return this.financeiroService.criar(dto);
  }

  @Patch('lancamentos/:id')
  atualizar(
    @Param('id') id: string,
    @Body() dto: Partial<CreateLancamentoDto>,
  ) {
    return this.financeiroService.atualizar(id, dto);
  }

  @Delete('lancamentos/:id')
  remover(@Param('id') id: string) {
    return this.financeiroService.remover(id);
  }
}
