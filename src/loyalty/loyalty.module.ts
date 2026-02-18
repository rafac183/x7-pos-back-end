import { Module } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyProgramsModule } from './loyalty-programs/loyalty-programs.module';
import { LoyaltyTierModule } from './loyalty-tier/loyalty-tier.module';
import { LoyaltyCustomerModule } from './loyalty-customer/loyalty-customer.module';
import { LoyaltyPointsTransactionModule } from './loyalty-points-transaction/loyalty-points-transaction.module';
import { LoyaltyRewardModule } from './loyalty-reward/loyalty-reward.module';
import { LoyaltyRewardsRedemtionsModule } from './loyalty-rewards-redemtions/loyalty-rewards-redemtions.module';
import { LoyaltyCouponsModule } from './loyalty-coupons/loyalty-coupons.module';

@Module({
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  imports: [
    LoyaltyProgramsModule,
    LoyaltyTierModule,
    LoyaltyCustomerModule,
    LoyaltyPointsTransactionModule,
    LoyaltyPointsTransactionModule,
    LoyaltyRewardModule,
    LoyaltyRewardsRedemtionsModule,
    LoyaltyCouponsModule,
  ],
})
export class LoyaltyModule {}
