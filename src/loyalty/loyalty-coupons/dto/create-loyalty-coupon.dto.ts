import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsNumber, Min, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { LoyaltyCouponStatus } from '../constants/loyalty-coupons-status.enum';

export class CreateLoyaltyCouponDto {
    @ApiProperty({
        example: 1,
        description: 'ID of the loyalty customer who owns the coupon',
    })
    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    loyalty_customer_id: number;

    @ApiProperty({
        example: 'COUPON123',
        description: 'Unique code for the coupon',
    })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({
        example: 1,
        description: 'ID of the reward associated with the coupon',
    })
    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    reward_id: number;

    @ApiPropertyOptional({
        example: 'ACTIVE',
        description: 'Status of the coupon',
        enum: LoyaltyCouponStatus,
        default: LoyaltyCouponStatus.ACTIVE,
    })
    @IsOptional()
    @IsEnum(LoyaltyCouponStatus)
    status?: LoyaltyCouponStatus;

    @ApiProperty({
        example: 10.50,
        description: 'Discount value associated with the coupon',
    })
    @IsNumber()
    @Min(0)
    @IsNotEmpty()
    @Type(() => Number)
    discount_value: number;

    @ApiProperty({
        description: 'Expiration date of the coupon',
        example: '2024-12-31T23:59:59Z',
    })
    @IsDateString()
    @IsNotEmpty()
    expires_at: Date;
}
