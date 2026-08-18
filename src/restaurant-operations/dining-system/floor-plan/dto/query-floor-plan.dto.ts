//src/restaurant-operations/dining-system/floor-plan/dto/query-floor-plan.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFloorPlanDto {
  // 'active' | 'draft' | 'archived' es el vocabulario del backoffice; 'inactive' y 'deleted'
  // se mantienen porque otros clientes (POS, portal) siguen filtrando por ellos.
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['active', 'inactive', 'draft', 'archived', 'deleted'],
    example: 'active',
  })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive', 'draft', 'archived', 'deleted'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Column to sort by',
    enum: ['id'],
    example: 'id',
  })
  @IsOptional()
  @IsIn(['id'])
  sortBy?: 'id';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
