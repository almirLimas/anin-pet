import { PartialType } from '@nestjs/swagger';
import { CreateCupomDto } from './create-cupom.dto';

export class UpdateCupomDto extends PartialType(CreateCupomDto) {}
