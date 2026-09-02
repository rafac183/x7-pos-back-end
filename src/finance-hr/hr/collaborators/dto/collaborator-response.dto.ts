import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';
import { ShiftRole } from '../constants/shift-role.enum';
import { CollaboratorStatus } from '../constants/collaborator-status.enum';

export class CollaboratorResponseDto {
  @ApiProperty({
    example: 1,
    description: 'Unique identifier of the Collaborator',
  })
  id: number;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the User associated with the Collaborator',
  })
  user_id: number;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Merchant owning the Collaborator',
  })
  merchant_id: number;

  @ApiProperty({
    example: 'Juan Pérez',
    description: 'Name of the Collaborator',
  })
  name: string;

  @ApiProperty({
    example: ShiftRole.WAITER,
    enum: ShiftRole,
    description: 'Role of the Collaborator',
  })
  role: ShiftRole;

  @ApiProperty({
    example: CollaboratorStatus.ACTIVE,
    enum: CollaboratorStatus,
    description: 'Status of the Collaborator',
  })
  status: CollaboratorStatus;

  @ApiProperty({
    description: 'Basic merchant information',
    example: {
      id: 1,
      name: 'Restaurant ABC',
    },
  })
  merchant: {
    id: number;
    name: string;
  };

  @ApiProperty({
    description:
      'Basic user information. `firstname`/`lastname` are kept for backwards compatibility with the original mapping (they carried username/email); `username` and `email` are the honest fields.',
    example: {
      id: 1,
      firstname: 'jperez',
      lastname: 'juan@store.com',
      username: 'jperez',
      email: 'juan@store.com',
    },
  })
  user: {
    id: number;
    firstname: string;
    lastname: string;
    username: string;
    email: string;
  };

  @ApiProperty({
    example: 3,
    nullable: true,
    description: 'Recurring shift the collaborator is attached to; null when unassigned',
  })
  shift_id: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'Shift summary, null when the collaborator has no recurring shift. The shift entity has no name column, so callers compose the label from role + startTime.',
    example: {
      id: 3,
      role: 'waiter',
      startTime: '2026-08-24T11:00:00Z',
      endTime: null,
      status: 'active',
    },
  })
  shift: {
    id: number;
    role?: string | null;
    startTime?: Date | null;
    endTime?: Date | null;
    status?: string | null;
  } | null;

  @ApiProperty({
    example: 'ADM-014',
    nullable: true,
    description: 'Merchant-issued employee code',
  })
  employeeId: string | null;

  @ApiProperty({
    example: 'Front of house',
    nullable: true,
    description: 'Department the collaborator belongs to',
  })
  department: string | null;

  @ApiProperty({
    example: '2026-08-24T10:00:00Z',
    description: 'Registration timestamp',
  })
  created_at: Date;
}

export class OneCollaboratorResponseDto extends SuccessResponse {
  @ApiProperty({ type: CollaboratorResponseDto })
  data: CollaboratorResponseDto;
}
