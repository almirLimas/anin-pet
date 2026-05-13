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
import { CuponsService } from './cupons.service';
import { CreateCupomDto } from './dto/create-cupom.dto';
import { UpdateCupomDto } from './dto/update-cupom.dto';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class ValidarCupomDto {
  @ApiProperty()
  @IsString()
  codigo: string;
}

@ApiTags('Cupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cupons')
export class CuponsController {
  constructor(private readonly cuponsService: CuponsService) {}

  @Get()
  findAll(@UsuarioAtual() usuario: { tenantId: string }) {
    return this.cuponsService.findAll(usuario.tenantId);
  }

  @Get(':id')
  findOne(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.cuponsService.findOne(usuario.tenantId, id);
  }

  @Post()
  create(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreateCupomDto,
  ) {
    return this.cuponsService.create(usuario.tenantId, dto);
  }

  @Patch(':id')
  update(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: UpdateCupomDto,
  ) {
    return this.cuponsService.update(usuario.tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.cuponsService.remove(usuario.tenantId, id);
  }

  // Validar cupom no PDV (retorna desconto calculado)
  @Post('validar')
  @ApiQuery({ name: 'subtotal', type: Number })
  validar(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: ValidarCupomDto,
    @Query('subtotal') subtotal: string,
  ) {
    return this.cuponsService.validar(
      usuario.tenantId,
      dto.codigo,
      parseFloat(subtotal) || 0,
    );
  }
}
