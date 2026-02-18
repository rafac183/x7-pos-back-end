import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LoyaltyCouponsService } from './loyalty-coupons.service';
import { CreateLoyaltyCouponDto } from './dto/create-loyalty-coupon.dto';
import { UpdateLoyaltyCouponDto } from './dto/update-loyalty-coupon.dto';

@Controller('loyalty-coupons')
export class LoyaltyCouponsController {
  constructor(private readonly loyaltyCouponsService: LoyaltyCouponsService) {}

  @Post()
  create(@Body() createLoyaltyCouponDto: CreateLoyaltyCouponDto) {
    return this.loyaltyCouponsService.create(createLoyaltyCouponDto);
  }

  @Get()
  findAll() {
    return this.loyaltyCouponsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loyaltyCouponsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLoyaltyCouponDto: UpdateLoyaltyCouponDto) {
    return this.loyaltyCouponsService.update(+id, updateLoyaltyCouponDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loyaltyCouponsService.remove(+id);
  }
}
