import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';

import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Table } from './entities/table.entity';
import { TableTransferLog } from './entities/table-transfer-log.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { IsUniqueField } from 'src/validators/is-unique-field.validator';
import { FloorPlan } from '../floor-plan/entity/floor-plan.entity';
import { FloorZone } from '../floor-zone/entity/floor-zone.entity';
import { Order } from '../../pos/orders/entities/order.entity';
import { TableAssignment } from '../table-assignments/entities/table-assignment.entity';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { DiningRealtimePublisher } from '../dining-realtime.publisher';
import { TableGroupReleaseListener } from './table-group-release.listener';

@Module({
  imports: [
    AuthModule,
    // Order y TableAssignment se registran en solo lectura desde aquí: las mesas necesitan
    // saber si hay comanda abierta o camarero asignado para no dejarse borrar, y re-vincular
    // ambos al transferir. Sus módulos siguen siendo los dueños de su ciclo de vida.
    TypeOrmModule.forFeature([
      Table,
      TableTransferLog,
      Merchant,
      FloorPlan,
      FloorZone,
      Order,
      TableAssignment,
    ]),
    RealtimeModule,
  ],
  controllers: [TablesController],
  providers: [
    TablesService,
    DiningRealtimePublisher,
    TableGroupReleaseListener,
    IsUniqueField,
  ],
  exports: [IsUniqueField, TablesService],
})
export class TablesModule {}
