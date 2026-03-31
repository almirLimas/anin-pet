import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class AtualizarPerfilDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomeCompleto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional({
    description: 'Senha atual (obrigatória para trocar senha)',
  })
  @IsOptional()
  @IsString()
  senhaAtual?: string;

  @ApiPropertyOptional({ minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  novaSenha?: string;
}
