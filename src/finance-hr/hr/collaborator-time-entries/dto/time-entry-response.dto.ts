import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';

export class TimeEntryResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  company_id: number;

  @ApiProperty({ example: 1 })
  merchant_id: number;

  @ApiProperty({ example: 1 })
  collaborator_id: number;

  @ApiProperty({ example: 1 })
  shift_id: number | null;

  @ApiProperty({ example: '2024-01-15T08:00:00.000Z' })
  clock_in: string;

  @ApiProperty({ example: '2024-01-15T16:00:00.000Z', nullable: true })
  clock_out: string | null;

  @ApiProperty({ example: 8 })
  regular_hours: number;

  @ApiProperty({ example: 0 })
  overtime_hours: number;

  @ApiProperty({ example: 0 })
  double_overtime_hours: number;

  @ApiProperty({ example: false })
  approved: boolean;

  @ApiProperty()
  created_at: string;

  @ApiProperty({ example: 45, description: 'Unpaid break minutes inside the interval' })
  break_minutes: number;

  @ApiProperty({ nullable: true, description: 'Why the punch was logged or corrected' })
  adjustment_reason: string | null;

  @ApiProperty({ example: false, description: 'Whether a supervisor corrected the punch' })
  is_edited: boolean;

  @ApiProperty({ nullable: true, description: 'User who made the last correction' })
  edited_by_user_id: number | null;

  @ApiProperty({ nullable: true, description: 'When the last correction happened' })
  edited_at: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Collaborator behind the punch, hydrated so the grid needs no second call',
    example: { id: 4, name: 'Juan Pérez', role: 'waiter' },
  })
  collaborator: { id: number; name: string; role: string } | null;

  @ApiProperty({
    nullable: true,
    description:
      'Scheduled shift, hydrated to contrast the actual punch against its schedule. The Shift entity has no name column, so callers compose the label from role + startTime.',
    example: { id: 7, role: 'waiter', startTime: '2026-08-30T08:00:00Z', endTime: null },
  })
  shift: {
    id: number;
    role?: string | null;
    startTime?: string | null;
    endTime?: string | null;
  } | null;
}

export class OneTimeEntryResponseDto extends SuccessResponse {
  @ApiProperty({ type: TimeEntryResponseDto })
  data: TimeEntryResponseDto;
}
