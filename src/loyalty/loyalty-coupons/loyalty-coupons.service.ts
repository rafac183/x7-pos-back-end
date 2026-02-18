import { Injectable } from '@nestjs/common';
import { CreateLoyaltyCouponDto } from './dto/create-loyalty-coupon.dto';
import { UpdateLoyaltyCouponDto } from './dto/update-loyalty-coupon.dto';

@Injectable()
export class LoyaltyCouponsService {
  create(createLoyaltyCouponDto: CreateLoyaltyCouponDto) {
    return 'This action adds a new loyaltyCoupon';
  }

  findAll() {
    return `This action returns all loyaltyCoupons`;
  }

  findOne(id: number) {
    return `This action returns a #${id} loyaltyCoupon`;
  }

  update(id: number, updateLoyaltyCouponDto: UpdateLoyaltyCouponDto) {
    return `This action updates a #${id} loyaltyCoupon`;
  }

  remove(id: number) {
    return `This action removes a #${id} loyaltyCoupon`;
  }
}
