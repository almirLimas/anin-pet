import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FormaPagamento, TipoItemVenda } from '@prisma/client';

export class ItemVendaDto {
  @ApiProperty({ enum: TipoItemVenda })
  @IsEnum(TipoItemVenda)
  tipo!: TipoItemVenda;

  @ApiProperty()
  @IsString()
  nome!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantidade!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precoUnitario!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  produtoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servicoId?: string;
}

export class CreateVendaDto {
  @ApiProperty({ enum: FormaPagamento })
  @IsEnum(FormaPagamento)
  formaPagamento!: FormaPagamento;

  @ApiProperty({ type: [ItemVendaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemVendaDto)
  itens!: ItemVendaDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  desconto?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  valorPago?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clienteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
