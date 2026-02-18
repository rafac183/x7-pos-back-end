import { Module } from '@nestjs/common';
import { LoyaltyCouponsService } from './loyalty-coupons.service';
import { LoyaltyCouponsController } from './loyalty-coupons.controller';

@Module({
  controllers: [LoyaltyCouponsController],
  providers: [LoyaltyCouponsService],
})
export class LoyaltyCouponsModule {}
