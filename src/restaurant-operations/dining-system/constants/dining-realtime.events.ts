// Vocabulario de eventos de sala que viaja por el gateway de tiempo real.
//
// Los nombres son un contrato con el POS y el backoffice: cambiar uno aquí deja sordas a
// las tablets hasta que se despliegue el cliente. El espejo en el front vive en
// x7-pos-backoffice/src/lib/dining-realtime.ts.

export const DINING_EVENTS = {
  TABLE_STATUS_CHANGED: 'dining:table_status_changed',
  TABLE_TRANSFERRED: 'dining:table_transferred',
  ASSIGNMENT_CHANGED: 'dining:assignment_changed',
  FLOOR_PLAN_UPDATED: 'dining:floor_plan_updated',
} as const;

export interface TableStatusChangedPayload {
  merchantId: number;
  tableId: number;
  status: string;
  parent_table_id?: number | null;
  emittedAt: string;
}

export interface TableTransferredPayload {
  merchantId: number;
  sourceTableId: number;
  targetTableId: number;
  orderId?: number | null;
  emittedAt: string;
}

export interface AssignmentChangedPayload {
  merchantId: number;
  assignmentId: number;
  tableId: number;
  shiftId: number;
  collaboratorId: number;
  action: 'assigned' | 'released' | 'reassigned';
  emittedAt: string;
}

export interface FloorPlanUpdatedPayload {
  merchantId: number;
  floorPlanId: number;
  emittedAt: string;
}
