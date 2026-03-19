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
    @Query('busca') busca?: string,
    @Query('alertas') alertas?: string,
  ) {
    return this.estoqueService.findAllProdutos(busca, alertas === 'true');
  }

  @Get('produtos/:id')
  findOneProduto(@Param('id') id: string) {
    return this.estoqueService.findOneProduto(id);
  }

  @Post('produtos')
  createProduto(@Body() dto: CreateProdutoDto) {
    return this.estoqueService.createProduto(dto);
  }

  @Patch('produtos/:id')
  updateProduto(@Param('id') id: string, @Body() dto: UpdateProdutoDto) {
    return this.estoqueService.updateProduto(id, dto);
  }

  @Delete('produtos/:id')
  removeProduto(@Param('id') id: string) {
    return this.estoqueService.removeProduto(id);
  }

  // ─── Movimentações ──────────────────────────────────────────

  @Get('movimentacoes')
  @ApiQuery({ name: 'produtoId', required: false })
  findAllMovimentacoes(@Query('produtoId') produtoId?: string) {
    return this.estoqueService.findAllMovimentacoes(produtoId);
  }

  @Post('movimentacoes')
  createMovimentacao(
    @Body() dto: CreateMovimentacaoDto,
    @UsuarioAtual() usuario: { id: string },
  ) {
    return this.estoqueService.createMovimentacao(dto, usuario.id);
  }
}
