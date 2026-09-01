import { IsOptional, IsNumber, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetMovementsQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination (minimum 1)',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of items per page (1-100)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'Item 1',
    description: 'Filter movements by item',
  })
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter movements by stock item ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  itemId?: number;

  @ApiPropertyOptional({ example: '2023-01-01', description: 'Filter movements starting from date' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2023-12-31', description: 'Filter movements up to date' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'TRANSFER', description: 'Filter by raw material stock movement type' })
  @IsOptional()
  @IsString()
  movementType?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filter by supply ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supplyId?: number;
}
