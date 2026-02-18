import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from '../../../common/dtos/success-response.dto';
import { LoyaltyRewardsRedemtionResponseDto } from './loyalty-rewards-redemtion-response.dto';
import { Type } from 'class-transformer';

export class AllPaginatedLoyaltyRewardsRedemtionDto extends SuccessResponse {
    @ApiProperty({ type: [LoyaltyRewardsRedemtionResponseDto] })
    @Type(() => LoyaltyRewardsRedemtionResponseDto)
    data: LoyaltyRewardsRedemtionResponseDto[];

    @ApiProperty({
        example: 100,
        description: 'Total number of items',
    })
    total: number;

    @ApiProperty({
        example: 1,
        description: 'Current page number',
    })
    page: number;

    @ApiProperty({
        example: 10,
        description: 'Number of items per page',
    })
    limit: number;

    @ApiProperty({
        example: 3,
        description: 'Total number of pages',
    })
    totalPages: number;

    @ApiProperty({
        example: true,
        description: 'Whether there is a next page',
    })
    hasNext: boolean;

    @ApiProperty({
        example: false,
        description: 'Whether there is a previous page',
    })
    hasPrev: boolean;
}
