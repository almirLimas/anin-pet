import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CategoriaEstoque } from '@prisma/client';

export class CreateProdutoDto {
  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty({ enum: CategoriaEstoque })
  @IsEnum(CategoriaEstoque)
  categoria: CategoriaEstoque;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigoBarras?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unidade?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precoCompra: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precoVenda: number;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantidadeAtual: number;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estoqueMinimo: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  ativo?: boolean;
}
