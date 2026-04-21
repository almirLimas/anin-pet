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
