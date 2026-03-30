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
import { VacinasService } from './vacinas.service';
import { CreateVacinaDto } from './dto/create-vacina.dto';
import { UpdateVacinaDto } from './dto/update-vacina.dto';

@ApiTags('Vacinas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vacinas')
export class VacinasController {
  constructor(private readonly vacinasService: VacinasService) {}

  @Get()
  @ApiQuery({ name: 'petId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['Aplicada', 'Pendente', 'Atrasada'],
  })
  findAll(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('petId') petId?: string,
    @Query('status') status?: string,
  ) {
    return this.vacinasService.findAll(usuario.tenantId, petId, status);
  }

  @Get(':id')
  findOne(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.vacinasService.findOne(usuario.tenantId, id);
  }

  @Post()
  create(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreateVacinaDto,
  ) {
    return this.vacinasService.create(usuario.tenantId, dto);
  }

  @Patch(':id')
  update(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: UpdateVacinaDto,
  ) {
    return this.vacinasService.update(usuario.tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.vacinasService.remove(usuario.tenantId, id);
  }
}
