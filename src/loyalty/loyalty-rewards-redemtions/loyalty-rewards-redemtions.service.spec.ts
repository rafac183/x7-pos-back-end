import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyRewardsRedemtionsService } from './loyalty-rewards-redemtions.service';

describe('LoyaltyRewardsRedemtionsService', () => {
  let service: LoyaltyRewardsRedemtionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoyaltyRewardsRedemtionsService],
    }).compile();

    service = module.get<LoyaltyRewardsRedemtionsService>(LoyaltyRewardsRedemtionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
