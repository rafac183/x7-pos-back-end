import { Module } from '@nestjs/common';
import { LedgerAccountsController } from './ledger-accounts.controller';
import { JournalEntriesController } from './journal-entries.controller';

@Module({
  controllers: [LedgerAccountsController, JournalEntriesController],
  exports: [],
})
export class AccountingModule {}
