import { PartialType } from '@nestjs/swagger';
import { CreateLoyaltyRewardsRedemtionDto } from './create-loyalty-rewards-redemtion.dto';

export class UpdateLoyaltyRewardsRedemtionDto extends PartialType(
    CreateLoyaltyRewardsRedemtionDto,
) { }
