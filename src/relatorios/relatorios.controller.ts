import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RelatoriosService } from './relatorios.service';

@ApiTags('Relatórios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get('resumo')
  @ApiQuery({ name: 'mes', required: false, type: String, example: '2026-03' })
  resumoMes(@Query('mes') mes?: string) {
    const mesAtual = mes ?? new Date().toISOString().substring(0, 7);
    return this.relatoriosService.resumoMes(mesAtual);
  }

  @Get('clientes-nao-voltaram')
  @ApiQuery({ name: 'dias', required: false, type: Number, example: 30 })
  clientesNaoVoltaram(@Query('dias') dias?: string) {
    return this.relatoriosService.clientesNaoVoltaram(dias ? Number(dias) : 30);
  }

  @Get('servicos-populares')
  @ApiQuery({ name: 'mes', required: false, type: String, example: '2026-03' })
  servicosPopulares(@Query('mes') mes?: string) {
    const mesAtual = mes ?? new Date().toISOString().substring(0, 7);
    return this.relatoriosService.servicosPopulares(mesAtual);
  }
}
