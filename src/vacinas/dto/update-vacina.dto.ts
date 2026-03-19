import { PartialType } from '@nestjs/swagger';
import { CreateVacinaDto } from './create-vacina.dto';

export class UpdateVacinaDto extends PartialType(CreateVacinaDto) {}
