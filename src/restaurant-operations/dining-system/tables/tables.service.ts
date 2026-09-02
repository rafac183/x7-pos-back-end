import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThan, Repository } from 'typeorm';
import { Table } from './entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import {
  TableResponseDto,
  OneTableResponseDto,
} from './dto/table-response.dto';
import { GetTablesQueryDto } from './dto/get-tables-query.dto';
import { PaginatedTablesResponseDto } from './dto/paginated-tables-response.dto';
import { FloorPlan } from '../floor-plan/entity/floor-plan.entity';
import { FloorZone } from '../floor-zone/entity/floor-zone.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Order } from '../../pos/orders/entities/order.entity';
import { OrderStatus } from '../../pos/orders/constants/order-status.enum';
import { OrderBusinessStatus } from '../../pos/orders/constants/order-business-status.enum';
import { TableAssignment } from '../table-assignments/entities/table-assignment.entity';
import { TableTransferLog } from './entities/table-transfer-log.entity';
import { TableStatus } from '../constants/table-status.enum';
import { TransferTableDto } from './dto/transfer-table.dto';
import { StatusDeltaQueryDto } from './dto/status-delta-query.dto';
import { DiningRealtimePublisher } from '../dining-realtime.publisher';

// Una comanda "abierta" es la que aún puede recibir cargos: ni cobrada, ni cancelada, ni
// borrada lógicamente. Es lo que convierte a una mesa en intocable.
const OPEN_ORDER_STATUSES = [
  OrderBusinessStatus.PENDING,
  OrderBusinessStatus.IN_PROGRESS,
];

// Mensaje único de la guarda de servicio vivo: lo comparten el borrado y la mudanza de
// plano/zona, y es literalmente el que la UI enseña al operador.
export const activeServiceMessage = (tableNumber: string): string =>
  `Cannot modify or remove Table ${tableNumber} while it has an active guest order or assigned server. Please close open orders first.`;
// import { IsUniqueField } from '../validators/is-unique-field.validator';
@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,

    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,

    @InjectRepository(FloorZone)
    private readonly floorZoneRepo: Repository<FloorZone>,

    @InjectRepository(FloorPlan)
    private readonly floorPlanRepo: Repository<FloorPlan>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(TableAssignment)
    private readonly assignmentRepo: Repository<TableAssignment>,

    @InjectRepository(TableTransferLog)
    private readonly transferLogRepo: Repository<TableTransferLog>,

    private readonly dataSource: DataSource,

    private readonly realtime: DiningRealtimePublisher,
  ) {}

  // ================= Guardas de servicio vivo =================

  /** Comandas todavía abiertas sobre la mesa. */
  private async countOpenOrders(
    tableId: number,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager ? manager.getRepository(Order) : this.orderRepo;
    return repo.count({
      where: {
        table_id: tableId,
        status: In(OPEN_ORDER_STATUSES),
        logical_status: OrderStatus.ACTIVE,
      },
    });
  }

  /** Camareros que tienen la mesa a su cargo ahora mismo (sin releasedAt). */
  private async countActiveAssignments(
    tableId: number,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(TableAssignment)
      : this.assignmentRepo;
    return repo
      .createQueryBuilder('assignment')
      .where('assignment.tableId = :tableId', { tableId })
      .andWhere('assignment.releasedAt IS NULL')
      .getCount();
  }

  /**
   * Bloquea tocar una mesa que está dando servicio. Se aplica al borrado y a la mudanza de
   * plano o zona: mover de sitio una mesa con comanda abierta deja al POS sin saber dónde
   * está esa cuenta. Renombrarla o recolocarla dentro del mismo lienzo sí se permite.
   */
  private async assertNoActiveService(
    table: Table,
    manager?: EntityManager,
  ): Promise<void> {
    if (table.status === TableStatus.OCCUPIED) {
      throw new ConflictException(activeServiceMessage(table.number));
    }
    const [openOrders, activeAssignments] = await Promise.all([
      this.countOpenOrders(table.id, manager),
      this.countActiveAssignments(table.id, manager),
    ]);
    if (openOrders > 0 || activeAssignments > 0) {
      throw new ConflictException(activeServiceMessage(table.number));
    }
  }

  async create(
    dto: CreateTableDto,
    authenticatedUserMerchantId: number,
  ): Promise<OneTableResponseDto> {
    // 1. Validate that the authenticated user has merchant_id
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to create tables',
      );
    }

    // 2. Validate that the user can only create tables for their own merchant
    const dtoMerchantId = Number(dto.merchant_id);
    const userMerchantId = Number(authenticatedUserMerchantId);

    if (dtoMerchantId !== userMerchantId) {
      throw new ForbiddenException(
        'You can only create tables for your own merchant',
      );
    }

    // 3. Validate that the merchant exists
    const merchant = await this.merchantRepo.findOne({
      where: { id: dto.merchant_id },
    });
    if (!merchant) {
      throw new NotFoundException(
        `Merchant with ID ${dto.merchant_id} not found`,
      );
    }

    const floorZone = await this.floorZoneRepo.findOne({
      where: { id: dto.floorZone },
      relations: ['floorPlan'],
    });

    if (!floorZone) {
      throw new NotFoundException('FloorZone not found');
    }

    const floorPlan = await this.floorPlanRepo.findOne({
      where: { id: dto.floorPlan },
      relations: ['merchant'],
    });

    if (!floorPlan) {
      throw new NotFoundException('FloorPlan not found');
    }

    if (floorZone.floorPlan.id !== floorPlan.id) {
      throw new BadRequestException(
        'FloorZone does not belong to the given FloorPlan',
      );
    }

    if (floorPlan.merchant.id !== merchant.id) {
      throw new BadRequestException(
        'FloorPlan does not belong to the Merchant',
      );
    }

    let parentTable: Table | null = null;

    if (dto.parent_table_id) {
      parentTable = await this.tableRepo.findOne({
        where: { id: dto.parent_table_id },
      });

      if (!parentTable) {
        throw new NotFoundException('Parent table not found');
      }
    }

    // 4. Validate uniqueness of table number within the merchant
    const existingTable = await this.tableRepo
      .createQueryBuilder('table')
      .where('table.number = :number', { number: dto.number })
      .andWhere('table.merchant = :merchantId', { merchantId: dto.merchant_id })
      .getOne();

    if (existingTable) {
      throw new ConflictException(
        `Table number '${dto.number}' already exists for merchant ${dto.merchant_id}`,
      );
    }

    // 5. Business rule validations
    if (dto.capacity <= 0) {
      throw new BadRequestException('Table capacity must be greater than 0');
    }

    // 6. Create the table
    const table = this.tableRepo.create({
      merchant: { id: dto.merchant_id } as Merchant,
      number: dto.number,
      capacity: dto.capacity,
      status: dto.status,
      location: dto.location,
      rotation: dto.rotation,
      shape: dto.shape,
      width: dto.width ?? null,
      height: dto.height ?? null,
      pos_x: dto.pos_x,
      pos_y: dto.pos_y,
      floorZone: { id: dto.floorZone } as FloorZone,
      floorPlan: { id: dto.floorPlan } as FloorPlan,
      parentTable: parentTable,
    } as Partial<Table>);

    const savedTable = await this.tableRepo.save(table);

    // 6.1 Una mesa nueva aparece en los planos abiertos en otras terminales sin recargar.
    this.realtime.tableStatusChanged({
      merchantId: savedTable.merchant_id,
      tableId: savedTable.id,
      status: savedTable.status,
      parent_table_id: savedTable.parentTable?.id ?? null,
    });

    // 7. Return response with merchant information (without dates)
    return {
      statusCode: 201,
      message: 'Table created successfully',
      data: {
        id: savedTable.id,
        merchant_id: savedTable.merchant_id,
        number: savedTable.number,
        capacity: savedTable.capacity,
        status: savedTable.status,
        location: savedTable.location,
        rotation: savedTable.rotation,
        shape: savedTable.shape,
        width: savedTable.width ?? null,
        height: savedTable.height ?? null,
        pos_x: savedTable.pos_x,
        pos_y: savedTable.pos_y,
        merchant: {
          id: merchant.id,
          name: merchant.name,
        },
        floorZone: {
          id: floorZone.id,
          name: floorZone.name,
        },
        floorPlan: {
          id: floorPlan.id,
          name: floorPlan.name,
        },
        parent_table: savedTable.parentTable
          ? {
              id: savedTable.parentTable.id,
              number: savedTable.parentTable.number,
            }
          : null,
      },
    };
  }

  async findAll(
    query: GetTablesQueryDto,
    authenticatedUserMerchantId: number,
  ): Promise<PaginatedTablesResponseDto> {
    // 1. Validate that the authenticated user has merchant_id
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to view tables',
      );
    }

    // 2. Validate that the merchant exists
    const merchant = await this.merchantRepo.findOne({
      where: { id: authenticatedUserMerchantId },
    });
    if (!merchant) {
      throw new NotFoundException(
        `Merchant with ID ${authenticatedUserMerchantId} not found`,
      );
    }

    // 3. Configure pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // 4. Build query with filters
    const queryBuilder = this.tableRepo
      .createQueryBuilder('table')
      .leftJoinAndSelect('table.merchant', 'merchant')
      .leftJoinAndSelect('table.floorZone', 'floorZone')
      .leftJoinAndSelect('table.floorPlan', 'floorPlan')
      .leftJoinAndSelect('table.parentTable', 'parentTable')
      .where('merchant.id = :merchantId', {
        merchantId: authenticatedUserMerchantId,
      });

    // 5. Apply optional filters
    if (query.status) {
      queryBuilder.andWhere('table.status = :status', { status: query.status });
    }

    if (query.minCapacity !== undefined) {
      queryBuilder.andWhere('table.capacity >= :minCapacity', {
        minCapacity: query.minCapacity,
      });
    }

    if (query.maxCapacity !== undefined) {
      queryBuilder.andWhere('table.capacity <= :maxCapacity', {
        maxCapacity: query.maxCapacity,
      });
    }

    // 6. Validate that minCapacity is not greater than maxCapacity
    if (query.minCapacity !== undefined && query.maxCapacity !== undefined) {
      if (query.minCapacity > query.maxCapacity) {
        throw new BadRequestException(
          'Minimum capacity cannot be greater than maximum capacity',
        );
      }
    }

    // 7. Get total records
    const total = await queryBuilder.getCount();

    // 8. Apply pagination and sorting
    const tables = await queryBuilder
      .orderBy('table.number', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();

    // 9. Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // 10. Map to TableResponseDto (without dates, with merchant info)
    const data: TableResponseDto[] = tables.map((table) => ({
      id: table.id,
      merchant_id: table.merchant_id,
      number: table.number,
      capacity: table.capacity,
      status: table.status,
      location: table.location,
      rotation: table.rotation,
      shape: table.shape,
      width: table.width ?? null,
      height: table.height ?? null,
      pos_x: table.pos_x,
      pos_y: table.pos_y,
      merchant: {
        id: table.merchant.id,
        name: table.merchant.name,
      },
      floorZone: table.floorZone,
      floorPlan: table.floorPlan,
      parent_table: table.parentTable
        ? {
            id: table.parentTable.id,
            number: table.parentTable.number,
          }
        : null,
    }));

    return {
      statusCode: 200,
      message: 'Tables retrieved successfully',
      data,
      paginationMeta: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    };
  }

  async findOne(
    id: number,
    authenticatedUserMerchantId: number,
  ): Promise<OneTableResponseDto> {
    // 1. Validate that the authenticated user has merchant_id
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to view tables',
      );
    }

    // 2. Validate that the ID is valid
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid table ID');
    }

    // 3. Search for the table
    const table = await this.tableRepo.findOne({
      where: { id },
      relations: ['merchant', 'floorZone', 'floorPlan', 'parentTable'],
    });

    if (!table) {
      throw new NotFoundException(`Table ${id} not found`);
    }

    // 4. Validate that the user can only see tables from their own merchant
    if (table.merchant.id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only view tables from your own merchant',
      );
    }

    // 4. Validate that the merchant exists (we already know that table.merchant = authenticatedUserMerchantId)
    const merchant = await this.merchantRepo.findOne({
      where: { id: authenticatedUserMerchantId },
    });

    if (!merchant) {
      throw new NotFoundException(
        `Merchant with ID ${authenticatedUserMerchantId} not found`,
      );
    }

    // 7. Return response with merchant information (without dates)
    return {
      statusCode: 200,
      message: 'Table retrieved successfully',
      data: {
        id: table.id,
        merchant_id: table.merchant_id,
        number: table.number,
        capacity: table.capacity,
        status: table.status,
        location: table.location,
        rotation: table.rotation,
        shape: table.shape,
      width: table.width ?? null,
      height: table.height ?? null,
        pos_x: table.pos_x,
        pos_y: table.pos_y,
        merchant: {
          id: table.merchant.id,
          name: table.merchant.name,
        },
        floorZone: table.floorZone,
        floorPlan: table.floorPlan,
        parent_table: table.parentTable
          ? {
              id: table.parentTable.id,
              number: table.parentTable.number,
            }
          : null,
      },
    };
  }

  async update(
    id: number,
    dto: UpdateTableDto,
    authenticatedUserMerchantId: number,
  ): Promise<OneTableResponseDto> {
    // 0. Validate DTO
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Update data is required');
    }

    // 0.1 Valid fields
    const validFields = [
      'number',
      'capacity',
      'status',
      'location',
      'rotation',
      'shape',
      'width',
      'height',
      'pos_x',
      'pos_y',
      'floorZone',
      'floorPlan',
      'parent_table_id',
    ];

    const hasValidField = validFields.some((field) => dto[field] !== undefined);

    if (!hasValidField) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    // 1. Auth validation
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to update tables',
      );
    }

    // 2. ID validation
    if (!id || id <= 0 || !Number.isInteger(id)) {
      throw new BadRequestException('Invalid table ID');
    }

    // 3. Find table
    const table = await this.tableRepo.findOne({
      where: { id },
      // floorZone/floorPlan hacen falta para distinguir "me mudo de sala" de "me reenvían
      // la misma zona en el DTO", que no es un cambio y no debe disparar la guarda.
      relations: ['merchant', 'parentTable', 'floorZone', 'floorPlan'],
    });

    if (!table) {
      throw new NotFoundException(`Table ${id} not found`);
    }

    // 4. Ownership validation
    if (table.merchant.id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only update tables from your own merchant',
      );
    }

    // 4.1 Guarda de servicio vivo. Sólo aplica a la mudanza de sala: renombrar la mesa o
    // recolocarla dentro de su propio lienzo no rompe el vínculo con la comanda abierta.
    const movingLayout =
      (dto.floorZone !== undefined && dto.floorZone !== table.floorZone?.id) ||
      (dto.floorPlan !== undefined && dto.floorPlan !== table.floorPlan?.id);
    if (movingLayout) {
      await this.assertNoActiveService(table);
    }

    const previousStatus = table.status;

    // 5. Field validations
    if (dto.capacity !== undefined) {
      if (!Number.isInteger(dto.capacity) || dto.capacity <= 0) {
        throw new BadRequestException(
          'Table capacity must be a positive integer',
        );
      }
    }

    if (dto.number !== undefined) {
      if (typeof dto.number !== 'string' || dto.number.trim() === '') {
        throw new BadRequestException(
          'Table number must be a non-empty string',
        );
      }
    }

    if (dto.status !== undefined) {
      if (typeof dto.status !== 'string' || dto.status.trim() === '') {
        throw new BadRequestException('Status must be a non-empty string');
      }
    }

    if (dto.location !== undefined) {
      if (typeof dto.location !== 'string' || dto.location.trim() === '') {
        throw new BadRequestException('Location must be a non-empty string');
      }
    }

    // 6. Unique number validation
    if (dto.number !== undefined && dto.number !== table.number) {
      const existingTable = await this.tableRepo
        .createQueryBuilder('table')
        .leftJoin('table.merchant', 'merchant')
        .where('table.number = :number', { number: dto.number })
        .andWhere('merchant.id = :merchantId', {
          merchantId: table.merchant.id,
        })
        .getOne();

      if (existingTable && existingTable.id !== id) {
        throw new ConflictException(
          `Table number '${dto.number}' already exists`,
        );
      }
    }

    // 7. Relaciones: FloorZone
    if (dto.floorZone !== undefined) {
      const floorZone = await this.floorZoneRepo.findOne({
        where: { id: dto.floorZone },
        relations: ['floorPlan'],
      });

      if (!floorZone) {
        throw new NotFoundException('FloorZone not found');
      }

      table.floorZone = floorZone;
    }

    // 8. Relaciones: FloorPlan
    if (dto.floorPlan !== undefined) {
      const floorPlan = await this.floorPlanRepo.findOne({
        where: { id: dto.floorPlan },
        relations: ['merchant'],
      });

      if (!floorPlan) {
        throw new NotFoundException('FloorPlan not found');
      }

      table.floorPlan = floorPlan;
    }

    if (dto.parent_table_id !== undefined) {
      // evitar self-parent
      if (dto.parent_table_id === id) {
        throw new BadRequestException('A table cannot be its own parent');
      }

      if (dto.parent_table_id === null) {
        table.parentTable = null;
      } else {
        const parent = await this.tableRepo.findOne({
          where: { id: dto.parent_table_id },
        });

        if (!parent) {
          throw new NotFoundException('Parent table not found');
        }

        // evitar ciclo simple
        if (parent.parent_table_id === id) {
          throw new BadRequestException('Circular relationship detected');
        }

        table.parentTable = parent;
      }
    }

    // 10. Campos simples
    if (dto.number !== undefined) table.number = dto.number.trim();
    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    if (dto.status !== undefined) table.status = dto.status.trim();
    if (dto.location !== undefined) table.location = dto.location.trim();
    if (dto.rotation !== undefined) table.rotation = dto.rotation;
    if (dto.shape !== undefined) table.shape = dto.shape;
    if (dto.width !== undefined) table.width = dto.width ?? null;
    if (dto.height !== undefined) table.height = dto.height ?? null;
    if (dto.pos_x !== undefined) table.pos_x = dto.pos_x;
    if (dto.pos_y !== undefined) table.pos_y = dto.pos_y;

    // 11. Save
    const updatedTable = await this.tableRepo.save(table);

    // 12. Recargar con relaciones
    const updated = await this.tableRepo.findOne({
      where: { id: updatedTable.id },
      relations: ['merchant', 'parentTable', 'floorZone', 'floorPlan'],
    });

    if (!updated) {
      throw new NotFoundException('Updated table not found');
    }

    // 12.1 El estado cambió: se arrastra a las hijas y se anuncia a las tablets.
    if (updated.status !== previousStatus) {
      await this.cascadeStatusToChildren(updated);
      this.realtime.tableStatusChanged({
        merchantId: updated.merchant_id,
        tableId: updated.id,
        status: updated.status,
        parent_table_id: updated.parentTable?.id ?? null,
      });
    }

    // 13. Response
    return {
      statusCode: 200,
      message: 'Table updated successfully',
      data: {
        id: updated.id,
        merchant_id: updated.merchant_id,
        number: updated.number,
        capacity: updated.capacity,
        status: updated.status,
        location: updated.location,
        rotation: updated.rotation,
        shape: updated.shape,
        width: updated.width ?? null,
        height: updated.height ?? null,
        pos_x: updated.pos_x,
        pos_y: updated.pos_y,
        merchant: {
          id: updated.merchant.id,
          name: updated.merchant.name,
        },
        floorZone: updated.floorZone,
        floorPlan: updated.floorPlan,
        parent_table: updated.parentTable
          ? {
              id: updated.parentTable.id,
              number: updated.parentTable.number,
            }
          : null,
      },
    };
  }

  async remove(
    id: number,
    authenticatedUserMerchantId: number,
  ): Promise<OneTableResponseDto> {
    // 1. Auth validation
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to delete tables',
      );
    }

    // 2. ID validation
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid table ID');
    }

    // 3. Find table con relaciones
    const table = await this.tableRepo.findOne({
      where: { id },
      relations: [
        'merchant',
        'parentTable',
        'childTables',
        'floorZone',
        'floorPlan',
      ],
    });

    if (!table) {
      throw new NotFoundException(`Table ${id} not found`);
    }

    // 4. Ownership validation
    if (table.merchant.id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only delete tables from your own merchant',
      );
    }

    // 5. Already deleted
    if (table.status === 'deleted') {
      throw new ConflictException('Table is already deleted');
    }

    // 6. 🔥 Manejar relaciones hijas
    if (table.childTables && table.childTables.length > 0) {
      for (const child of table.childTables) {
        child.parentTable = null;
        await this.tableRepo.save(child);
      }
    }

    // 7. Servicio vivo: una mesa con comensales, comanda abierta o camarero asignado no se
    // borra. Antes esto era un TODO comentado y el borrado se llevaba la comanda por delante.
    await this.assertNoActiveService(table);

    // 8. Soft delete
    table.status = 'deleted';
    const updatedTable = await this.tableRepo.save(table);

    // 9. Recargar con relaciones
    const updated = await this.tableRepo.findOne({
      where: { id: updatedTable.id },
      relations: ['merchant', 'parentTable', 'floorZone', 'floorPlan'],
    });

    if (!updated) {
      throw new NotFoundException('Updated table not found');
    }

    // 9.1 Las tablets tienen que hacer desaparecer la mesa de su plano.
    this.realtime.tableStatusChanged({
      merchantId: updated.merchant_id,
      tableId: updated.id,
      status: updated.status,
      parent_table_id: null,
    });

    // 10. Response
    return {
      statusCode: 200,
      message: 'Table deleted successfully',
      data: {
        id: updated.id,
        merchant_id: updated.merchant_id,
        number: updated.number,
        capacity: updated.capacity,
        status: updated.status,
        location: updated.location,
        rotation: updated.rotation,
        shape: updated.shape,
        width: updated.width ?? null,
        height: updated.height ?? null,
        pos_x: updated.pos_x,
        pos_y: updated.pos_y,
        merchant: {
          id: updated.merchant.id,
          name: updated.merchant.name,
        },
        floorZone: updated.floorZone,
        floorPlan: updated.floorPlan,
        parent_table: updated.parentTable
          ? {
              id: updated.parentTable.id,
              number: updated.parentTable.number,
            }
          : null,
      },
    };
  }

  // ================= Herencia de estado en un grupo unido =================

  /**
   * Una mesa madre que se ocupa arrastra a sus hijas.
   *
   * Un grupo unido es UNA unidad de servicio: si la madre tiene comensales, ofrecer una de
   * sus hijas como libre acaba con dos parejas sentadas en la misma mesa larga. Sólo se
   * propaga hacia abajo y sólo cuando la madre pasa a ocupada; devolverlas a disponible es
   * cosa del cierre de cuenta, que además las desune.
   */
  private async cascadeStatusToChildren(
    parent: Table,
    manager?: EntityManager,
  ): Promise<void> {
    if (parent.status !== TableStatus.OCCUPIED) return;

    const repo = manager ? manager.getRepository(Table) : this.tableRepo;
    const children = await repo.find({
      where: { parent_table_id: parent.id },
    });

    for (const child of children) {
      if (child.status === parent.status || child.status === 'deleted') continue;
      child.status = parent.status;
      await repo.save(child);
      this.realtime.tableStatusChanged({
        merchantId: child.merchant_id,
        tableId: child.id,
        status: child.status,
        parent_table_id: parent.id,
      });
    }
  }

  /**
   * Suelta el grupo unido a una mesa madre y lo devuelve a limpieza.
   *
   * Es lo que ocurre al cobrar: las hijas dejan de colgar de nadie y ni madre ni hijas
   * quedan 'occupied' con la sala ya vacía. Público porque lo invoca el listener de comanda
   * pagada, que es un evento y no tiene usuario autenticado detrás.
   */
  async releaseJoinedGroup(
    parentTableId: number,
    releaseStatus: TableStatus = TableStatus.CLEANING,
  ): Promise<void> {
    const parent = await this.tableRepo.findOne({
      where: { id: parentTableId },
    });
    if (!parent || parent.status === 'deleted') return;

    const children = await this.tableRepo.find({
      where: { parent_table_id: parent.id },
    });

    for (const child of children) {
      if (child.status === 'deleted') continue;
      child.parentTable = null;
      child.parent_table_id = null as unknown as number;
      child.status = releaseStatus;
      await this.tableRepo.save(child);
      this.realtime.tableStatusChanged({
        merchantId: child.merchant_id,
        tableId: child.id,
        status: child.status,
        parent_table_id: null,
      });
    }

    if (parent.status !== releaseStatus) {
      parent.status = releaseStatus;
      await this.tableRepo.save(parent);
      this.realtime.tableStatusChanged({
        merchantId: parent.merchant_id,
        tableId: parent.id,
        status: parent.status,
        parent_table_id: parent.parent_table_id ?? null,
      });
    }
  }

  // ================= Traslado de comensales =================

  /**
   * Muda a los comensales de una mesa a otra sin cerrar la cuenta.
   *
   * Todo va en UNA transacción a propósito: media transferencia es peor que ninguna. Si
   * fallara el re-vínculo de la comanda después de liberar el origen, quedaría una cuenta
   * apuntando a una mesa vacía y nadie sabría a quién cobrarle.
   */
  async transfer(
    dto: TransferTableDto,
    authenticatedUserMerchantId: number,
    userId: number,
  ): Promise<OneTableResponseDto> {
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to transfer tables',
      );
    }

    if (dto.sourceTableId === dto.targetTableId) {
      throw new BadRequestException(
        'Source and target tables must be different',
      );
    }

    const outcome = await this.dataSource.transaction(async (manager) => {
      const tableRepo = manager.getRepository(Table);

      const [source, target] = await Promise.all([
        tableRepo.findOne({
          where: { id: dto.sourceTableId },
          relations: ['merchant', 'parentTable', 'floorZone', 'floorPlan'],
        }),
        tableRepo.findOne({
          where: { id: dto.targetTableId },
          relations: ['merchant', 'parentTable', 'floorZone', 'floorPlan'],
        }),
      ]);

      if (!source) {
        throw new NotFoundException(`Table ${dto.sourceTableId} not found`);
      }
      if (!target) {
        throw new NotFoundException(`Table ${dto.targetTableId} not found`);
      }

      // Aislamiento multi-tenant: nadie mueve comensales a la sala de otro comercio.
      if (
        source.merchant_id !== authenticatedUserMerchantId ||
        target.merchant_id !== authenticatedUserMerchantId
      ) {
        throw new ForbiddenException(
          'You can only transfer tables within your own merchant',
        );
      }

      if (source.status !== TableStatus.OCCUPIED) {
        throw new ConflictException(
          `Table ${source.number} has no seated party to transfer.`,
        );
      }

      if (target.status !== TableStatus.AVAILABLE) {
        throw new ConflictException(
          `Target Table [${target.number}] is currently occupied or unavailable for transfer.`,
        );
      }

      // 1. La comanda abierta se re-vincula al destino. Puede no haberla (mesa marcada a
      //    mano como ocupada antes de tomar nota) y la mudanza sigue siendo válida.
      const orderRepo = manager.getRepository(Order);
      const openOrder = await orderRepo.findOne({
        where: {
          table_id: source.id,
          status: In(OPEN_ORDER_STATUSES),
          logical_status: OrderStatus.ACTIVE,
        },
        order: { id: 'DESC' },
      });
      if (openOrder) {
        openOrder.table_id = target.id;
        await orderRepo.save(openOrder);
      }

      // 2. El camarero se lleva la mesa: su cobertura viva viaja al destino en vez de
      //    cerrarse, para no perder de vista quién atiende a esos comensales.
      const assignmentRepo = manager.getRepository(TableAssignment);
      const liveAssignments = await assignmentRepo
        .createQueryBuilder('assignment')
        .where('assignment.tableId = :tableId', { tableId: source.id })
        .andWhere('assignment.releasedAt IS NULL')
        .getMany();
      for (const assignment of liveAssignments) {
        assignment.tableId = target.id;
        await assignmentRepo.save(assignment);
      }

      // 3. Origen a limpieza, destino ocupado.
      source.status = TableStatus.CLEANING;
      target.status = TableStatus.OCCUPIED;
      await tableRepo.save(source);
      await tableRepo.save(target);

      // 4. Rastro de auditoría dentro de la misma transacción: si el traslado se deshace,
      //    el registro tampoco queda.
      await manager.getRepository(TableTransferLog).save({
        merchant_id: authenticatedUserMerchantId,
        source_table_id: source.id,
        target_table_id: target.id,
        order_id: openOrder?.id ?? null,
        user_id: userId,
      });

      const moved = await tableRepo.findOne({
        where: { id: target.id },
        relations: ['merchant', 'parentTable', 'floorZone', 'floorPlan'],
      });

      return {
        source,
        target: moved ?? target,
        orderId: openOrder?.id ?? null,
        assignments: liveAssignments,
      };
    });

    // Los avisos salen DESPUÉS del commit: anunciar una mesa ocupada que luego revierte
    // dejaría a las tablets pintando un estado que no existe.
    this.realtime.tableTransferred({
      merchantId: authenticatedUserMerchantId,
      sourceTableId: outcome.source.id,
      targetTableId: outcome.target.id,
      orderId: outcome.orderId,
    });
    this.realtime.tableStatusChanged({
      merchantId: authenticatedUserMerchantId,
      tableId: outcome.source.id,
      status: outcome.source.status,
      parent_table_id: outcome.source.parent_table_id ?? null,
    });
    this.realtime.tableStatusChanged({
      merchantId: authenticatedUserMerchantId,
      tableId: outcome.target.id,
      status: outcome.target.status,
      parent_table_id: outcome.target.parent_table_id ?? null,
    });
    for (const assignment of outcome.assignments) {
      this.realtime.assignmentChanged({
        merchantId: authenticatedUserMerchantId,
        assignmentId: assignment.id,
        tableId: outcome.target.id,
        shiftId: assignment.shiftId,
        collaboratorId: assignment.collaboratorId,
        action: 'reassigned',
      });
    }

    return {
      statusCode: 200,
      message: 'Table transferred successfully',
      data: this.toResponse(outcome.target),
    };
  }

  // ================= Reconciliación tras una caída de red =================

  /**
   * Lo que ha cambiado en la sala desde un instante dado.
   *
   * Una tablet que recupera el wifi no necesita repintar el local entero: pide sólo las
   * mesas tocadas mientras estuvo sorda. Las borradas viajan también —con status 'deleted'—
   * porque el cliente tiene que quitarlas de su plano, y filtrarlas aquí las dejaría
   * inmortales en la pantalla.
   */
  async statusDelta(
    query: StatusDeltaQueryDto,
    authenticatedUserMerchantId: number,
  ): Promise<{ statusCode: number; message: string; data: TableResponseDto[] }> {
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to read table status',
      );
    }

    const since = query.since ? new Date(query.since) : null;
    if (since && Number.isNaN(since.getTime())) {
      throw new BadRequestException('Invalid `since` timestamp');
    }

    const tables = await this.tableRepo.find({
      where: {
        merchant_id: authenticatedUserMerchantId,
        ...(since ? { updated_at: MoreThan(since) } : {}),
      },
      relations: ['merchant', 'parentTable', 'floorZone', 'floorPlan'],
      order: { updated_at: 'ASC' },
    });

    return {
      statusCode: 200,
      message: 'Table status delta retrieved successfully',
      data: tables.map((t) => this.toResponse(t)),
    };
  }

  /** Forma de respuesta compartida por los endpoints nuevos. */
  private toResponse(table: Table): TableResponseDto {
    return {
      id: table.id,
      merchant_id: table.merchant_id,
      number: table.number,
      capacity: table.capacity,
      status: table.status,
      location: table.location,
      rotation: table.rotation,
      shape: table.shape,
      width: table.width ?? null,
      height: table.height ?? null,
      pos_x: table.pos_x,
      pos_y: table.pos_y,
      merchant: {
        id: table.merchant?.id ?? table.merchant_id,
        name: table.merchant?.name,
      },
      floorZone: table.floorZone,
      floorPlan: table.floorPlan,
      parent_table: table.parentTable
        ? { id: table.parentTable.id, number: table.parentTable.number }
        : null,
    } as TableResponseDto;
  }
}
