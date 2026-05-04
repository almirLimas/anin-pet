import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PerfilStaff {
  gerente = 'gerente',
  atendente = 'atendente',
  caixa = 'caixa',
  motoboy = 'motoboy',
}

export class CriarStaffDto {
  @ApiProperty({ example: 'Maria Caixa' })
  @IsString()
  nomeCompleto: string;

  @ApiProperty({ example: 'maria@petshop.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;

  @ApiProperty({ example: 'senha123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  senha: string;

  @ApiProperty({ enum: PerfilStaff, example: 'caixa' })
  @IsEnum(PerfilStaff, {
    message: 'Perfil inválido. Use gerente, atendente, caixa ou motoboy',
  })
  perfil: PerfilStaff;

  @ApiPropertyOptional({ example: '(11) 99999-0000' })
  @IsOptional()
  @IsString()
  telefone?: string;
}
