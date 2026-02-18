import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LoyaltyRewardsRedemtionsService } from './loyalty-rewards-redemtions.service';
import { CreateLoyaltyRewardsRedemtionDto } from './dto/create-loyalty-rewards-redemtion.dto';
import { UpdateLoyaltyRewardsRedemtionDto } from './dto/update-loyalty-rewards-redemtion.dto';

@Controller('loyalty-rewards-redemtions')
export class LoyaltyRewardsRedemtionsController {
  constructor(private readonly loyaltyRewardsRedemtionsService: LoyaltyRewardsRedemtionsService) {}

  @Post()
  create(@Body() createLoyaltyRewardsRedemtionDto: CreateLoyaltyRewardsRedemtionDto) {
    return this.loyaltyRewardsRedemtionsService.create(createLoyaltyRewardsRedemtionDto);
  }

  @Get()
  findAll() {
    return this.loyaltyRewardsRedemtionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loyaltyRewardsRedemtionsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLoyaltyRewardsRedemtionDto: UpdateLoyaltyRewardsRedemtionDto) {
    return this.loyaltyRewardsRedemtionsService.update(+id, updateLoyaltyRewardsRedemtionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loyaltyRewardsRedemtionsService.remove(+id);
  }
}
