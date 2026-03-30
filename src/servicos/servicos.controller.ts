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
import { ServicosService } from './servicos.service';
import { CreateServicoDto } from './dto/create-servico.dto';
import { UpdateServicoDto } from './dto/update-servico.dto';

@ApiTags('Serviços')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('servicos')
export class ServicosController {
  constructor(private readonly servicosService: ServicosService) {}

  @Get()
  @ApiQuery({ name: 'ativos', required: false, type: Boolean })
  findAll(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('ativos') ativos?: string,
  ) {
    return this.servicosService.findAll(usuario.tenantId, ativos === 'true');
  }

  @Get(':id')
  findOne(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.servicosService.findOne(usuario.tenantId, id);
  }

  @Post()
  create(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreateServicoDto,
  ) {
    return this.servicosService.create(usuario.tenantId, dto);
  }

  @Patch(':id')
  update(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: UpdateServicoDto,
  ) {
    return this.servicosService.update(usuario.tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.servicosService.remove(usuario.tenantId, id);
  }
}
