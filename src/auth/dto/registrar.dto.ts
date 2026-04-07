import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Perfil, Plano } from '@prisma/client';

export class RegistrarDto {
  @ApiProperty({ example: 'Petshop da Maria' })
  @IsString({ message: 'O nome do petshop deve ser um texto' })
  nomePetshop: string;

  @ApiProperty({ example: 'Ana Veterinaria' })
  @IsString({ message: 'O nome completo deve ser um texto' })
  nomeCompleto: string;

  @ApiProperty({ example: 'ana@aninpet.com' })
  @IsEmail({}, { message: 'Informe um e-mail valido' })
  email: string;

  @ApiProperty({ example: '123.456.789-09' })
  @IsString({ message: 'O CPF deve ser um texto' })
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, {
    message: 'CPF inválido. Use o formato 000.000.000-00',
  })
  cpf: string;

  @ApiPropertyOptional({ example: '(11) 99999-0000' })
  @IsOptional()
  @IsString({ message: 'O telefone deve ser um texto' })
  telefone?: string;

  @ApiProperty({ example: 'senha123', minLength: 6 })
  @IsString({ message: 'A senha deve ser um texto' })
  @MinLength(6, { message: 'A senha deve ter no minimo 6 caracteres' })
  senha: string;

  @ApiPropertyOptional({ enum: Perfil, default: 'admin' })
  @IsOptional()
  @IsEnum(Perfil, { message: 'Perfil invalido. Use admin ou staff' })
  perfil?: Perfil;

  @ApiPropertyOptional({
    enum: Plano,
    default: 'basico',
    description: 'Plano contratado pelo negocio',
  })
  @IsOptional()
  @IsEnum(Plano, {
    message: 'Plano invalido. Use basico ou plus',
  })
  plano?: Plano;
}
