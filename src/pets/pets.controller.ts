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
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@ApiTags('Pets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get()
  @ApiQuery({ name: 'clienteId', required: false })
  findAll(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('clienteId') clienteId?: string,
  ) {
    return this.petsService.findAll(usuario.tenantId, clienteId);
  }

  @Get(':id')
  findOne(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.petsService.findOne(usuario.tenantId, id);
  }

  @Post()
  create(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreatePetDto,
  ) {
    return this.petsService.create(usuario.tenantId, dto);
  }

  @Patch(':id')
  update(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: UpdatePetDto,
  ) {
    return this.petsService.update(usuario.tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.petsService.remove(usuario.tenantId, id);
  }
}
