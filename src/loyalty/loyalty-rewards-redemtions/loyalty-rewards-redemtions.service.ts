import { Injectable } from '@nestjs/common';
import { CreateLoyaltyRewardsRedemtionDto } from './dto/create-loyalty-rewards-redemtion.dto';
import { UpdateLoyaltyRewardsRedemtionDto } from './dto/update-loyalty-rewards-redemtion.dto';

@Injectable()
export class LoyaltyRewardsRedemtionsService {
  create(createLoyaltyRewardsRedemtionDto: CreateLoyaltyRewardsRedemtionDto) {
    return 'This action adds a new loyaltyRewardsRedemtion';
  }

  findAll() {
    return `This action returns all loyaltyRewardsRedemtions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} loyaltyRewardsRedemtion`;
  }

  update(id: number, updateLoyaltyRewardsRedemtionDto: UpdateLoyaltyRewardsRedemtionDto) {
    return `This action updates a #${id} loyaltyRewardsRedemtion`;
  }

  remove(id: number) {
    return `This action removes a #${id} loyaltyRewardsRedemtion`;
  }
}
