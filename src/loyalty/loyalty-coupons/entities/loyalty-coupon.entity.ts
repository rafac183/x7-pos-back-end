import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { LoyaltyCustomer } from '../../loyalty-customer/entities/loyalty-customer.entity';
import { LoyaltyReward } from '../../loyalty-reward/entities/loyalty-reward.entity';
import { LoyaltyCouponStatus } from '../constants/loyalty-coupons-status.enum';

@Entity('loyalty_coupons')
export class LoyaltyCoupon {
    @ApiProperty({
        example: 1,
        description: 'Unique identifier for the coupon',
    })
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id: number;

    @ApiProperty({
        example: 1,
        description: 'ID of the loyalty customer who owns the coupon',
    })
    @Column({ name: 'loyalty_customer_id', type: 'bigint' })
    loyaltyCustomerId: number;

    @ManyToOne(() => LoyaltyCustomer)
    @JoinColumn({ name: 'loyalty_customer_id' })
    loyaltyCustomer: LoyaltyCustomer;

    @ApiProperty({
        example: 'COUPON123',
        description: 'Unique code for the coupon',
    })
    @Column({ type: 'varchar', length: 50, unique: true })
    code: string;

    @ApiProperty({
        example: 1,
        description: 'ID of the reward associated with the coupon',
    })
    @Column({ name: 'reward_id', type: 'bigint' })
    rewardId: number;

    @ManyToOne(() => LoyaltyReward)
    @JoinColumn({ name: 'reward_id' })
    reward: LoyaltyReward;

    @ApiProperty({
        example: 'ACTIVE',
        description: 'Status of the coupon',
        enum: LoyaltyCouponStatus,
    })
    @Column({
        type: 'enum',
        enum: LoyaltyCouponStatus,
        default: LoyaltyCouponStatus.ACTIVE,
    })
    status: LoyaltyCouponStatus;

    @ApiProperty({
        example: 10.50,
        description: 'Discount value associated with the coupon',
    })
    @Column({ name: 'discount_value', type: 'numeric', precision: 10, scale: 2 })
    discountValue: number;

    @ApiProperty({
        description: 'Expiration date of the coupon',
    })
    @Column({ name: 'expires_at', type: 'timestamp' })
    expiresAt: Date;

    @ApiProperty({
        description: 'Creation date of the coupon',
    })
    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @ApiProperty({
        description: 'Date when the coupon was redeemed',
        required: false,
    })
    @Column({ name: 'redeemed_at', type: 'timestamp', nullable: true })
    redeemedAt: Date;
}
