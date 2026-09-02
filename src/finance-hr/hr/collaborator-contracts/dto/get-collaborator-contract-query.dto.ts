import {
  IsOptional,
  IsNumber,
  IsBoolean,
  IsPositive,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EmploymentType } from '../constants/employment-type.enum';

export class GetCollaboratorContractQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Items per page',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filter by company ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  company_id?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filter by merchant ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  merchant_id?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filter by collaborator ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  collaborator_id?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    example: EmploymentType.FULL_TIME,
    enum: EmploymentType,
    description: 'Filter by employment relationship',
  })
  @IsOptional()
  @IsEnum(EmploymentType)
  employment_type?: EmploymentType;

  @ApiPropertyOptional({
    example: 30,
    description:
      'Only contracts whose end_date falls within the next N days (open-ended contracts are excluded)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365)
  expiring_within_days?: number;
}
