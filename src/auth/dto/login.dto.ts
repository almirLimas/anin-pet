import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@aninpet.com' })
  @IsEmail({}, { message: 'Informe um e-mail valido' })
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString({ message: 'A senha deve ser um texto' })
  @MinLength(6, { message: 'A senha deve ter no minimo 6 caracteres' })
  senha: string;
}
