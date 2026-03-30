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
import { EstoqueService } from './estoque.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { CreateMovimentacaoDto } from './dto/create-movimentacao.dto';

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
}
