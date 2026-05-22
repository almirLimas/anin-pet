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
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { EstoqueService } from './estoque.service';

class ParseNfeDto {
  @IsString()
  xml: string;
}

class ImportarNfeItemDto {
  @IsOptional()
  @IsString()
  produtoId?: string;

  @IsOptional()
  @IsString()
  nomeNfe?: string;

  @IsOptional()
  @IsString()
  eanNfe?: string;

  @IsOptional()
  @IsString()
  codigoProdutoNfe?: string;

  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantidade: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precoUnitario: number;
}

class ImportarNfeDto {
  @IsOptional()
  @IsString()
  fornecedorId?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportarNfeItemDto)
  itens: ImportarNfeItemDto[];
}
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { CreateMovimentacaoDto } from './dto/create-movimentacao.dto';

import { CreateEntradaMercadoriaDto } from './dto/create-entrada-mercadoria.dto';

@ApiTags('Estoque')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoqueService: EstoqueService) {}

  // ─── Produtos ───────────────────────────────────────────────

  @Get('produtos')
  @ApiQuery({ name: 'busca', required: false })
  @ApiQuery({ name: 'alertas', required: false, type: Boolean })
  findAllProdutos(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('busca') busca?: string,
    @Query('alertas') alertas?: string,
  ) {
    return this.estoqueService.findAllProdutos(
      usuario.tenantId,
      busca,
      alertas === 'true',
    );
  }

  @Get('produtos/:id')
  findOneProduto(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.estoqueService.findOneProduto(usuario.tenantId, id);
  }

  @Post('produtos')
  createProduto(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: CreateProdutoDto,
  ) {
    return this.estoqueService.createProduto(usuario.tenantId, dto);
  }

  @Patch('produtos/:id')
  updateProduto(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: UpdateProdutoDto,
  ) {
    return this.estoqueService.updateProduto(usuario.tenantId, id, dto);
  }

  @Delete('produtos/:id')
  removeProduto(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.estoqueService.removeProduto(usuario.tenantId, id);
  }

  // ─── Movimentações ──────────────────────────────────────────

  @Get('movimentacoes')
  @ApiQuery({ name: 'produtoId', required: false })
  findAllMovimentacoes(
    @UsuarioAtual() usuario: { tenantId: string },
    @Query('produtoId') produtoId?: string,
  ) {
    return this.estoqueService.findAllMovimentacoes(
      usuario.tenantId,
      produtoId,
    );
  }

  @Post('movimentacoes')
  createMovimentacao(
    @Body() dto: CreateMovimentacaoDto,
    @UsuarioAtual() usuario: { id: string; tenantId: string },
  ) {
    return this.estoqueService.createMovimentacao(
      usuario.tenantId,
      dto,
      usuario.id,
    );
  }

  // ─── Alertas de estoque mínimo ───────────────────────────

  @Get('alertas')
  findAlertasEstoque(@UsuarioAtual() usuario: { tenantId: string }) {
    return this.estoqueService.findAlertasEstoque(usuario.tenantId);
  }

  // ─── Entradas de Mercadoria ───────────────────────────

  @Get('entradas')
  findAllEntradas(@UsuarioAtual() usuario: { tenantId: string }) {
    return this.estoqueService.findAllEntradas(usuario.tenantId);
  }

  @Get('entradas/:id')
  findOneEntrada(
    @UsuarioAtual() usuario: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.estoqueService.findOneEntrada(usuario.tenantId, id);
  }

  @Post('entradas/parse-xml')
  parseNfeXml(
    @Body() dto: ParseNfeDto,
    @UsuarioAtual() usuario: { tenantId: string },
  ) {
    return this.estoqueService.parseNfeXml(usuario.tenantId, dto.xml);
  }

  @Post('entradas/importar-nfe')
  importarNfe(
    @Body() dto: ImportarNfeDto,
    @UsuarioAtual() usuario: { id: string; tenantId: string },
  ) {
    return this.estoqueService.importarNfe(usuario.tenantId, usuario.id, dto);
  }

  @Post('entradas')
  criarEntrada(
    @Body() dto: CreateEntradaMercadoriaDto,
    @UsuarioAtual() usuario: { id: string; tenantId: string },
  ) {
    return this.estoqueService.criarEntrada(usuario.tenantId, usuario.id, dto);
  }
}
