import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusCliente } from '@prisma/client';

const toOptionalString = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class PetEmbutidoDto {
  @IsString()
  nome: string;

  @IsString()
  especie: string;

  @IsOptional()
  @IsString()
  raca?: string;

  @IsOptional()
  @IsEnum(['Macho', 'Fêmea'])
  sexo?: 'Macho' | 'Fêmea';

  @IsOptional()
  @IsString()
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value !== null && value !== undefined && value !== ''
      ? String(value)
      : undefined,
  )
  @IsString()
  peso?: string;

  @IsOptional()
  @IsString()
  porte?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class CreateClienteDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/, {
    message: 'Nome não pode conter números ou caracteres especiais',
  })
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

  @ApiPropertyOptional({ description: 'Cliente mensalista (plano mensal)' })
  @IsOptional()
  @IsBoolean()
  mensalista?: boolean;

  @ApiPropertyOptional({ description: 'Valor mensal cobrado (R$)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  valorMensal?: number;

  @ApiPropertyOptional({ description: 'Dia do vencimento (1-31)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  @Type(() => Number)
  diaVencimento?: number;

  @ApiPropertyOptional({ enum: StatusCliente, default: StatusCliente.Ativo })
  @IsOptional()
  @IsEnum(StatusCliente)
  status?: StatusCliente;

  @ApiPropertyOptional({ type: [PetEmbutidoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PetEmbutidoDto)
  pets?: PetEmbutidoDto[];
}
