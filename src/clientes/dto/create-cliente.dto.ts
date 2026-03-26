import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusCliente } from '@prisma/client';

const toOptionalString = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class CreateClienteDto {
  @ApiProperty()
  @IsString()
  nome: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  cpf?: string;

  @ApiProperty()
  @IsString()
  telefonePrincipal: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  telefoneSecundario?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @Transform(toOptionalString)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  cep?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  rua?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  complemento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  bairro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  cidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  dataNascimento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  comoConheceu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(toOptionalString)
  observacoes?: string;

  @ApiPropertyOptional({ enum: StatusCliente, default: StatusCliente.Ativo })
  @IsOptional()
  @IsEnum(StatusCliente)
  status?: StatusCliente;
}
