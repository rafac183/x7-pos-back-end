import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoyaltyRewardsRedemtionsService } from './loyalty-rewards-redemtions.service';
import { LoyaltyRewardsRedemtionsController } from './loyalty-rewards-redemtions.controller';
import { LoyaltyRewardsRedemtion } from './entities/loyalty-rewards-redemtion.entity';
import { LoyaltyReward } from '../loyalty-reward/entities/loyalty-reward.entity';
import { LoyaltyCustomer } from '../loyalty-customer/entities/loyalty-customer.entity';
import { Order } from '../../orders/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoyaltyRewardsRedemtion, LoyaltyReward, LoyaltyCustomer, Order])],
  controllers: [LoyaltyRewardsRedemtionsController],
  providers: [LoyaltyRewardsRedemtionsService],
})
export class LoyaltyRewardsRedemtionsModule { }
