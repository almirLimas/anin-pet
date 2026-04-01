import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EsqueceuSenhaDto {
  @ApiProperty({ example: 'usuario@email.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;
}
