import { Module } from '@nestjs/common';
import { FinanceHrController } from './finance-hr.controller';
import { FinanceHrService } from './finance-hr.service';
import { AccountingModule } from './accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [FinanceHrController],
  providers: [FinanceHrService],
})
export class FinanceHrModule {}
