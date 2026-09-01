//src/restaurant-operations/dining-system/floor-plan/dto/update-floor-plan.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateFloorPlanDto } from './create-floor-plan.dto';

// PartialType hereda los validadores de CreateFloorPlanDto, así que `status` acepta aquí el mismo
// conjunto: 'active' | 'draft' | 'archived' es el vocabulario del backoffice, e 'inactive' /
// 'deleted' se conservan por compatibilidad con los clientes antiguos.
export class UpdateFloorPlanDto extends PartialType(CreateFloorPlanDto) {}
