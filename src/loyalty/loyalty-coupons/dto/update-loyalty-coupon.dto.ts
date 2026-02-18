import { PartialType } from '@nestjs/swagger';
import { CreateLoyaltyCouponDto } from './create-loyalty-coupon.dto';

export class UpdateLoyaltyCouponDto extends PartialType(CreateLoyaltyCouponDto) {}
