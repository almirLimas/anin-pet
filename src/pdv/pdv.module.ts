import { Module } from '@nestjs/common';
import { PdvController } from './pdv.controller';
import { PdvService } from './pdv.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PdvController],
  providers: [PdvService],
})
export class PdvModule {}
