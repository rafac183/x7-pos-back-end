import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';

/**
 * Resumen operativo de un colaborador: con qué está enredado ahora mismo y cuánto ha
 * movido. Alimenta el cajón de detalle del directorio de RR. HH.
 *
 * Devuelve CONTADORES más una muestra corta de cada relación, no el histórico entero: el
 * cajón enseña "12 turnos" y los últimos, no doce meses de filas que nadie va a leer ahí.
 */
export class CollaboratorSummaryCountsDto {
  @ApiProperty({ example: 12 })
  shiftAssignments: number;

  @ApiProperty({ example: 4 })
  tableAssignments: number;

  @ApiProperty({ example: 7 })
  openedCashDrawers: number;

  @ApiProperty({ example: 6 })
  closedCashDrawers: number;

  @ApiProperty({ example: 143 })
  orders: number;
}

export class CollaboratorSummaryDto {
  @ApiProperty({ example: 4 })
  collaborator_id: number;

  @ApiProperty({ type: CollaboratorSummaryCountsDto })
  counts: CollaboratorSummaryCountsDto;

  @ApiProperty({
    example: 15420.5,
    description: 'Sum of the totals of every order taken by this collaborator',
  })
  ordersTotal: number;

  @ApiProperty({
    isArray: true,
    description: 'Most recent shift assignments (up to 5)',
  })
  recentShiftAssignments: Array<{
    id: number;
    shiftId: number;
    startTime: Date | null;
    endTime: Date | null;
    status: string | null;
  }>;

  @ApiProperty({
    isArray: true,
    description: 'Most recent table assignments (up to 5)',
  })
  recentTableAssignments: Array<{
    id: number;
    tableId: number;
    tableNumber: string | null;
    zoneName: string | null;
    assignedAt: Date | null;
    releasedAt: Date | null;
  }>;

  @ApiProperty({
    isArray: true,
    description: 'Most recent cash drawer sessions in this collaborator custody (up to 5)',
  })
  // La entidad CashDrawer no guarda marcas propias de apertura y cierre: sólo created_at /
  // updated_at. Se exponen tal cual en vez de disfrazarlas de openedAt/closedAt, que sería
  // afirmar una precisión que el dato no tiene.
  recentCashDrawers: Array<{
    id: number;
    custody: 'opened' | 'closed';
    status: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  }>;

  @ApiProperty({
    isArray: true,
    description: 'Most recent orders taken (up to 5)',
  })
  recentOrders: Array<{
    id: number;
    order_number: string | null;
    total: number;
    status: string | null;
    created_at: Date | null;
  }>;
}

export class CollaboratorSummaryResponseDto extends SuccessResponse {
  @ApiProperty({ type: CollaboratorSummaryDto })
  data: CollaboratorSummaryDto;
}
