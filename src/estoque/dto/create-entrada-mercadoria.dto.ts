import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ItemEntradaDto {
  @ApiProperty()
  @IsString()
  produtoId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantidade: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precoUnitario: number;
}

export class CreateEntradaMercadoriaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fornecedorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;

  @ApiProperty({ type: [ItemEntradaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemEntradaDto)
  itens: ItemEntradaDto[];
}
