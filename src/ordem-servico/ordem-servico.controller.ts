import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { OrdemServicoService } from './ordem-servico.service';
import { AddItemOsDto } from './dto/add-item-os.dto';
import { FinalizarOsDto } from './dto/finalizar-os.dto';

@ApiTags('Ordem de Serviço')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ordem-servico')
export class OrdemServicoController {
  constructor(private readonly os: OrdemServicoService) {}

  /** Abre (ou retorna já existente) a OS de um agendamento */
  @Post('agendamento/:agendamentoId')
  criar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('agendamentoId') agendamentoId: string,
  ) {
    return this.os.criarParaAgendamento(usuario.tenantId, agendamentoId);
  }

  /** Busca a OS de um agendamento sem criar */
  @Get('agendamento/:agendamentoId')
  findByAgendamento(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('agendamentoId') agendamentoId: string,
  ) {
    return this.os.findByAgendamento(usuario.tenantId, agendamentoId);
  }

  /** Adiciona produto extra à OS */
  @Post(':id/itens')
  addItem(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: AddItemOsDto,
  ) {
    return this.os.addItem(usuario.tenantId, id, dto);
  }

  /** Remove produto extra da OS */
  @Delete(':id/itens/:itemId')
  removeItem(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.os.removeItem(usuario.tenantId, id, itemId);
  }

  /** Finaliza a OS: desconta estoque, cria lançamento, conclui agendamento */
  @Post(':id/finalizar')
  finalizar(
    @UsuarioAtual() usuario: { tenantId: string; id: string },
    @Param('id') id: string,
    @Body() dto: FinalizarOsDto,
  ) {
    return this.os.finalizar(usuario.tenantId, id, usuario.id, dto);
  }
}
