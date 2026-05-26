import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
    description: 'Foto de perfil como data URL (base64) ou URL pública',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  fotoPerfil?: string | null;

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
