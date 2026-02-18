import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyRewardsRedemtionsController } from './loyalty-rewards-redemtions.controller';
import { LoyaltyRewardsRedemtionsService } from './loyalty-rewards-redemtions.service';

describe('LoyaltyRewardsRedemtionsController', () => {
  let controller: LoyaltyRewardsRedemtionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoyaltyRewardsRedemtionsController],
      providers: [LoyaltyRewardsRedemtionsService],
    }).compile();

    controller = module.get<LoyaltyRewardsRedemtionsController>(LoyaltyRewardsRedemtionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
