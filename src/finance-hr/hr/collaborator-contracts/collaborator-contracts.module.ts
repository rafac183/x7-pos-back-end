import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';

import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaboratorContract } from './entities/collaborator-contract.entity';
import { CollaboratorContractRevision } from './entities/collaborator-contract-revision.entity';
import { CollaboratorContractsService } from './collaborator-contracts.service';
import { CollaboratorContractsController } from './collaborator-contracts.controller';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Collaborator } from '../collaborators/entities/collaborator.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      CollaboratorContract,
      CollaboratorContractRevision,
      Company,
      Merchant,
      Collaborator,
    ]),
  ],
  controllers: [CollaboratorContractsController],
  providers: [CollaboratorContractsService],
  exports: [CollaboratorContractsService],
})
export class CollaboratorContractsModule {}
