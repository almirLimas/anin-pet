import { Controller, Get, Header, UseGuards } from '@nestjs/common';
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
}
