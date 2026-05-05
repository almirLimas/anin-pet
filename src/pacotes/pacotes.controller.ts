import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { PacotesService } from './pacotes.service';
import { CreatePacoteDto } from './dto/create-pacote.dto';
import { UpdatePacoteDto } from './dto/update-pacote.dto';
import { AtivarPacoteDto } from './dto/ativar-pacote.dto';

@ApiTags('Pacotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pacotes')
export class PacotesController {
  constructor(private readonly pacotesService: PacotesService) {}

  // ── Templates de pacote ──────────────────────────────────────────────────

  @Get()
  @ApiQuery({ name: 'ativos', required: false, type: Boolean })
  findAll(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('ativos') ativos?: string,
  ) {
    return this.pacotesService.findAll(usuario.tenantId, ativos === 'true');
  }

  @Get(':id')
  findOne(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.pacotesService.findOne(usuario.tenantId, id);
  }

  @Post()
  create(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreatePacoteDto,
  ) {
    return this.pacotesService.create(usuario.tenantId, dto);
  }

  @Patch(':id')
  update(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: UpdatePacoteDto,
  ) {
    return this.pacotesService.update(usuario.tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.pacotesService.remove(usuario.tenantId, id);
  }

  @Post(':id/enviar-whatsapp')
  @HttpCode(HttpStatus.OK)
  enviarWhatsapp(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body('clienteId') clienteId: string,
  ) {
    return this.pacotesService.enviarWhatsapp(usuario.tenantId, id, clienteId);
  }

  // ── Pacotes ativos de clientes ───────────────────────────────────────────

  @Get('clientes/ativos')
  findTodosAtivos(@UsuarioAtual() usuario: { tenantId: string }) {
    return this.pacotesService.findTodosPacotesAtivos(usuario.tenantId);
  }

  @Get('clientes/:clienteId')
  findPacotesCliente(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('clienteId') clienteId: string,
  ) {
    return this.pacotesService.findPacotesCliente(usuario.tenantId, clienteId);
  }

  @Post('ativar')
  ativar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: AtivarPacoteDto,
  ) {
    return this.pacotesService.ativar(usuario.tenantId, dto);
  }

  @Patch('uso/:pacoteClienteId')
  registrarUso(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('pacoteClienteId') pacoteClienteId: string,
  ) {
    return this.pacotesService.registrarUso(usuario.tenantId, pacoteClienteId);
  }

  @Patch('cancelar/:pacoteClienteId')
  cancelar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('pacoteClienteId') pacoteClienteId: string,
  ) {
    return this.pacotesService.cancelar(usuario.tenantId, pacoteClienteId);
  }
}
