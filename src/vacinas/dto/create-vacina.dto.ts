import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusVacina } from '@prisma/client';

export class CreateVacinaDto {
  @ApiProperty()
  @IsString()
  petId: string;

  @ApiProperty()
  @IsString()
  nome: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fabricante?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lote?: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsString()
  dataAplicacao: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  dataReforco?: string;

  @ApiPropertyOptional({ enum: StatusVacina })
  @IsOptional()
  @IsEnum(StatusVacina)
  status?: StatusVacina;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
