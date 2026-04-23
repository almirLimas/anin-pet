import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { FechamentoService } from './fechamento.service';
import { FecharCaixaDto } from './dto/fechar-caixa.dto';

@ApiTags('Fechamento de Caixa')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('fechamento')
export class FechamentoController {
  constructor(private readonly fechamentoService: FechamentoService) {}

  @Post()
  fechar(
    @UsuarioAtual() usuario: { tenantId: string; id: string },
    @Body() dto: FecharCaixaDto,
    @Query('data') data?: string,
  ) {
    return this.fechamentoService.fechar(
      usuario.tenantId,
      usuario.id,
      dto,
      data,
    );
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  listar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('page') page?: string,
  ) {
    return this.fechamentoService.listar(
      usuario.tenantId,
      page ? Number(page) : 1,
    );
  }

  @Get('status-dia')
  @ApiQuery({ name: 'data', required: false })
  statusDia(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('data') data?: string,
  ) {
    return this.fechamentoService.statusDia(usuario.tenantId, data);
  }

  @Get('resumo-dia')
  @ApiQuery({ name: 'data', required: false })
  resumoDia(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('data') data?: string,
  ) {
    return this.fechamentoService.resumoDia(usuario.tenantId, data);
  }

  @Get(':id')
  buscarUm(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.fechamentoService.buscarUm(usuario.tenantId, id);
  }
}
