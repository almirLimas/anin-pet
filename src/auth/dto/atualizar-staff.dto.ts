import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PerfilStaff } from './criar-staff.dto';

export class AtualizarStaffDto {
  @ApiPropertyOptional({ example: 'Maria Silva' })
  @IsOptional()
  @IsString()
  nomeCompleto?: string;

  @ApiPropertyOptional({ example: '(11) 99999-0000' })
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional({ enum: PerfilStaff })
  @IsOptional()
  @IsEnum(PerfilStaff, {
    message: 'Perfil inválido. Use gerente, atendente, caixa ou motoboy',
  })
  perfil?: PerfilStaff;

  @ApiPropertyOptional({ example: 'novaSenha123', minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A nova senha deve ter no mínimo 6 caracteres' })
  novaSenha?: string;
}
