import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyCouponsController } from './loyalty-coupons.controller';
import { LoyaltyCouponsService } from './loyalty-coupons.service';

describe('LoyaltyCouponsController', () => {
  let controller: LoyaltyCouponsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoyaltyCouponsController],
      providers: [LoyaltyCouponsService],
    }).compile();

    controller = module.get<LoyaltyCouponsController>(LoyaltyCouponsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
