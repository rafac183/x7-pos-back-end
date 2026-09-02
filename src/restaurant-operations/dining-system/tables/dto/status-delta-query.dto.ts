import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class StatusDeltaQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-19T12:00:00.000Z',
    description:
      'Only tables touched after this instant. Omit it to get the whole floor, which is what a terminal booting from scratch needs.',
  })
  @IsOptional()
  @IsISO8601()
  since?: string;
}
