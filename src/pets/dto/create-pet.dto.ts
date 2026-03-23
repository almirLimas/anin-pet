import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePetDto {
  @ApiProperty()
  @IsString()
  clienteId: string;

  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty()
  @IsString()
  especie: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  raca?: string;

  @ApiPropertyOptional({ enum: ['Macho', 'Fêmea'] })
  @IsOptional()
  @IsEnum(['Macho', 'Fêmea'])
  sexo?: 'Macho' | 'Fêmea';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataNascimento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  peso?: string;

  @ApiPropertyOptional({ enum: ['Pequeno', 'Médio', 'Grande', 'Gigante'] })
  @IsOptional()
  @IsString()
  porte?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
