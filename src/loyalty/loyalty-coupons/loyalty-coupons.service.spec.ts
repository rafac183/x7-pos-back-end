import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyCouponsService } from './loyalty-coupons.service';

describe('LoyaltyCouponsService', () => {
  let service: LoyaltyCouponsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoyaltyCouponsService],
    }).compile();

    service = module.get<LoyaltyCouponsService>(LoyaltyCouponsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
