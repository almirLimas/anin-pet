import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiSecurity('x-admin-key')
@UseGuards(AdminApiKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('google-ads-csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="google-ads-clientes.csv"',
  )
  @ApiOperation({
    summary:
      'Exporta lista de clientes (admins) em CSV para Customer Match do Google Ads',
  })
  async googleAdsCsv(): Promise<string> {
    return this.adminService.gerarGoogleAdsCsv();
  }

  @Post('tenants/:id/ativar-aviso-pix')
  @ApiOperation({ summary: 'Ativa banner de cobrança PIX para um tenant' })
  ativarAvisoPix(@Param('id') id: string, @Query('horas') horas?: string) {
    return this.adminService.ativarAvisoPix(id, horas ? Number(horas) : 48);
  }

  @Delete('tenants/:id/ativar-aviso-pix')
  @ApiOperation({ summary: 'Remove banner de cobrança PIX de um tenant' })
  desativarAvisoPix(@Param('id') id: string) {
    return this.adminService.desativarAvisoPix(id);
  }
}
