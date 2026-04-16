import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';

export class MensagemDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content: string;
}

export class ChatIaDto {
  @ApiProperty({ type: [MensagemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MensagemDto)
  mensagens: MensagemDto[];
}
