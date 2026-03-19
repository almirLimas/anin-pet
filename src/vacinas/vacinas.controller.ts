import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VacinasService } from './vacinas.service';
import { CreateVacinaDto } from './dto/create-vacina.dto';
import { UpdateVacinaDto } from './dto/update-vacina.dto';

@ApiTags('Vacinas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vacinas')
export class VacinasController {
  constructor(private readonly vacinasService: VacinasService) {}

  @Get()
  @ApiQuery({ name: 'petId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['Aplicada', 'Pendente', 'Atrasada'],
  })
  findAll(@Query('petId') petId?: string, @Query('status') status?: string) {
    return this.vacinasService.findAll(petId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vacinasService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateVacinaDto) {
    return this.vacinasService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVacinaDto) {
    return this.vacinasService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vacinasService.remove(id);
  }
}
