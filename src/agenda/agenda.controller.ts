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
import { AgendaService } from './agenda.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto';
import { CreateAgendamentoRecorrenteDto } from './dto/create-agendamento-recorrente.dto';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { StatusGaiola } from '@prisma/client';

class AtualizarStatusGaiolaDto {
  @IsEnum(StatusGaiola)
  statusGaiola!: StatusGaiola;

  @IsOptional()
  @IsString()
  formaPagamento?: string;

  @IsOptional()
  @IsBoolean()
  clienteJaBuscou?: boolean;
}

@ApiTags('Agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get()
  @ApiQuery({ name: 'data', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('data') data?: string,
    @Query('status') status?: string,
  ) {
    return this.agendaService.findAll(usuario.tenantId, data, status);
  }

  @Get('pendentes')
  findPendentes(@UsuarioAtual() usuario: { tenantId: string }) {
    return this.agendaService.findPendentes(usuario.tenantId);
  }

  @Get('gaiolas')
  @ApiQuery({ name: 'data', required: true, description: 'YYYY-MM-DD' })
  buscarGaiolas(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('data') data: string,
  ) {
    return this.agendaService.buscarGaiolas(usuario.tenantId, data);
  }

  @Patch(':id/status-gaiola')
  atualizarStatusGaiola(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: AtualizarStatusGaiolaDto,
  ) {
    return this.agendaService.atualizarStatusGaiola(
      usuario.tenantId,
      id,
      dto.statusGaiola,
      dto.formaPagamento,
      dto.clienteJaBuscou,
    );
  }

  @Get('concluidos')
  concluidosSemanaEMes(@UsuarioAtual() usuario: { tenantId: string }) {
    return this.agendaService.concluidosSemanaEMes(usuario.tenantId);
  }

  @Get('resumo-mes')
  @ApiQuery({ name: 'mes', required: true, description: 'YYYY-MM' })
  resumoMes(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('mes') mes: string,
  ) {
    return this.agendaService.resumoMes(usuario.tenantId, mes);
  }

  @Get(':id')
  findOne(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.agendaService.findOne(usuario.tenantId, id);
  }

  @Post()
  create(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreateAgendamentoDto,
  ) {
    return this.agendaService.create(usuario.tenantId, dto);
  }

  @Post('recorrente')
  criarRecorrente(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreateAgendamentoRecorrenteDto,
  ) {
    return this.agendaService.criarRecorrente(usuario.tenantId, dto);
  }

  @Patch(':id')
  update(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: UpdateAgendamentoDto,
  ) {
    return this.agendaService.update(usuario.tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.agendaService.remove(usuario.tenantId, id);
  }
}
