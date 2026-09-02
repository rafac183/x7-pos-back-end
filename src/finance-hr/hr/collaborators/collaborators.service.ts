import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Collaborator } from './entities/collaborator.entity';
import { CreateCollaboratorDto } from './dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import {
  CollaboratorResponseDto,
  OneCollaboratorResponseDto,
} from './dto/collaborator-response.dto';
import { GetCollaboratorsQueryDto } from './dto/get-collaborators-query.dto';
import { PaginatedCollaboratorsResponseDto } from './dto/paginated-collaborators-response.dto';
import { User } from 'src/platform-saas/users/entities/user.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { CollaboratorStatus } from './constants/collaborator-status.enum';
import { Shift } from 'src/restaurant-operations/shift/shifts/entities/shift.entity';
import { ShiftAssignment } from 'src/restaurant-operations/shift/shift-assignments/entities/shift-assignment.entity';
import { TableAssignment } from 'src/restaurant-operations/dining-system/table-assignments/entities/table-assignment.entity';
import { CashDrawer } from 'src/restaurant-operations/cashdrawer/cash-drawers/entities/cash-drawer.entity';
import { Order } from 'src/restaurant-operations/pos/orders/entities/order.entity';
import { CollaboratorSummaryResponseDto } from './dto/collaborator-summary.dto';

@Injectable()
export class CollaboratorsService {
  constructor(
    @InjectRepository(Collaborator)
    private readonly collaboratorRepo: Repository<Collaborator>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    // Sólo lectura: alimentan el resumen operativo del colaborador. Cada una de estas
    // entidades sigue perteneciendo a su propio módulo.
    @InjectRepository(ShiftAssignment)
    private readonly shiftAssignmentRepo: Repository<ShiftAssignment>,
    @InjectRepository(TableAssignment)
    private readonly tableAssignmentRepo: Repository<TableAssignment>,
    @InjectRepository(CashDrawer)
    private readonly cashDrawerRepo: Repository<CashDrawer>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly entityManager: EntityManager,
  ) {}

  async create(
    dto: CreateCollaboratorDto,
    authenticatedUserMerchantId: number,
  ): Promise<OneCollaboratorResponseDto> {
    // 1. Validar que el usuario autenticado tiene merchant_id
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to create collaborators',
      );
    }

    // 2. Validar que el usuario solo puede crear colaboradores para su propio merchant
    const dtoMerchantId = Number(dto.merchant_id);
    const userMerchantId = Number(authenticatedUserMerchantId);

    if (dtoMerchantId !== userMerchantId) {
      throw new ForbiddenException(
        'You can only create collaborators for your own merchant',
      );
    }

    // 3. Validar que el merchant existe
    const merchant = await this.merchantRepo.findOne({
      where: { id: dto.merchant_id },
    });
    if (!merchant) {
      throw new NotFoundException(
        `Merchant with ID ${dto.merchant_id} not found`,
      );
    }

    // 4. Validar que el usuario existe
    const user = await this.userRepo.findOne({ where: { id: dto.user_id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${dto.user_id} not found`);
    }

    // 5. Validar unicidad del user_id (un usuario solo puede ser colaborador de un merchant)
    const existingCollaborator = await this.collaboratorRepo.findOne({
      where: { user_id: dto.user_id },
    });

    if (existingCollaborator) {
      throw new ConflictException(
        `User with ID '${dto.user_id}' is already a collaborator. A user can only be a collaborator for one merchant.`,
      );
    }

    // 6. Validaciones de reglas de negocio
    if (dto.name.trim().length === 0) {
      throw new BadRequestException('Collaborator name cannot be empty');
    }

    if (dto.name.length > 150) {
      throw new BadRequestException(
        'Collaborator name cannot exceed 150 characters',
      );
    }

    // 7. Crear el colaborador
    // El turno es opcional y tiene que ser del MISMO comercio: sin esta comprobación se
    // podría enganchar a un empleado al turno de otro local pasando un id a mano.
    const shift = await this.resolveShift(dto.shift_id, dto.merchant_id);

    const collaborator = this.collaboratorRepo.create({
      user_id: dto.user_id,
      merchant_id: dto.merchant_id,
      name: dto.name.trim(),
      role: dto.role,
      status: dto.status,
      shift_id: shift?.id ?? null,
    } as Partial<Collaborator>);

    const savedCollaborator = await this.collaboratorRepo.save(collaborator);

    // 8. Return response with merchant and user information (without dates)
    return {
      statusCode: 201,
      message: 'Collaborator created successfully',
      data: this.toResponse(savedCollaborator, merchant, user, shift),
    };
  }

  /**
   * Turno del colaborador. Devuelve null tanto si no se pidió ninguno como si se pidió
   * desengancharlo (null explícito), y revienta si el turno es de otro comercio.
   */
  private async resolveShift(
    shiftId: number | null | undefined,
    merchantId: number,
  ): Promise<Shift | null> {
    if (shiftId === undefined || shiftId === null) return null;
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }
    if (shift.merchantId !== merchantId) {
      throw new ForbiddenException(
        'You can only assign shifts that belong to your own merchant',
      );
    }
    return shift;
  }

  /**
   * Forma única de la respuesta.
   *
   * `firstname`/`lastname` se conservan porque el mapeo original metía ahí el username y el
   * email —cualquier cliente que ya lea esos campos seguiría funcionando— pero se añaden
   * `username` y `email` con su nombre real: buscar empleados por correo requería adivinar
   * que el correo viajaba en el apellido.
   */
  private toResponse(
    collaborator: Collaborator,
    merchant: { id: number; name: string },
    user: { id: number; username?: string; email?: string },
    shift?: Shift | null,
  ): CollaboratorResponseDto {
    const resolvedShift = shift ?? collaborator.shift ?? null;
    return {
      id: collaborator.id,
      user_id: collaborator.user_id,
      merchant_id: collaborator.merchant_id,
      name: collaborator.name,
      role: collaborator.role,
      status: collaborator.status,
      employeeId: collaborator.employeeId ?? null,
      department: collaborator.department ?? null,
      created_at: collaborator.created_at,
      shift_id: resolvedShift?.id ?? collaborator.shift_id ?? null,
      shift: resolvedShift
        ? {
            id: resolvedShift.id,
            role: resolvedShift.role ?? null,
            startTime: resolvedShift.startTime ?? null,
            endTime: resolvedShift.endTime ?? null,
            status: resolvedShift.status ?? null,
          }
        : null,
      merchant: { id: merchant.id, name: merchant.name },
      user: {
        id: user.id,
        firstname: user.username || '',
        lastname: user.email || '',
        username: user.username || '',
        email: user.email || '',
      },
    };
  }

  async findAll(
    query: GetCollaboratorsQueryDto,
    authenticatedUserMerchantId: number,
  ): Promise<PaginatedCollaboratorsResponseDto> {
    // 1. Validar que el usuario autenticado tiene merchant_id
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to view collaborators',
      );
    }

    // 2. Validar que el merchant existe
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

    // 4. Construir query con filtros
    const queryBuilder = this.collaboratorRepo
      .createQueryBuilder('collaborator')
      .leftJoinAndSelect('collaborator.user', 'user')
      .leftJoinAndSelect('collaborator.merchant', 'merchant')
      .leftJoinAndSelect('collaborator.shift', 'shift')
      .where('merchant.id = :merchantId', {
        merchantId: authenticatedUserMerchantId,
      });

    // 5. Aplicar filtros opcionales
    if (query.status) {
      queryBuilder.andWhere('collaborator.status = :status', {
        status: query.status,
      });
    }

    // 6. Obtener total de registros
    const total = await queryBuilder.getCount();

    // 7. Apply pagination and sorting
    const collaborators = await queryBuilder
      .orderBy('collaborator.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();

    // 8. Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // 9. Mapear a CollaboratorResponseDto (sin fechas, con info del merchant y user)
    const data: CollaboratorResponseDto[] = collaborators.map((collaborator) =>
      this.toResponse(collaborator, collaborator.merchant, collaborator.user),
    );

    return {
      statusCode: 200,
      message: 'Collaborators retrieved successfully',
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
  ): Promise<OneCollaboratorResponseDto> {
    // 1. Validar que el usuario autenticado tiene merchant_id
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to view collaborators',
      );
    }

    // 2. Validate that the ID is valid
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid collaborator ID');
    }

    // 3. Buscar el colaborador
    const collaborator = await this.collaboratorRepo.findOne({
      where: { id },
      relations: ['user', 'merchant', 'shift'],
    });

    if (!collaborator) {
      throw new NotFoundException(`Collaborator ${id} not found`);
    }

    // 4. Validar que el usuario solo puede ver colaboradores de su propio merchant
    if (collaborator.merchant_id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only view collaborators from your own merchant',
      );
    }

    // 5. Validar que el merchant existe
    const merchant = await this.merchantRepo.findOne({
      where: { id: collaborator.merchant_id },
    });
    if (!merchant) {
      throw new NotFoundException(
        `Merchant with ID ${collaborator.merchant_id} not found`,
      );
    }

    // 6. Validar que el usuario existe
    const user = await this.userRepo.findOne({
      where: { id: collaborator.user_id },
    });
    if (!user) {
      throw new NotFoundException(
        `User with ID ${collaborator.user_id} not found`,
      );
    }

    // 7. Return response with merchant and user information (without dates)
    return {
      statusCode: 200,
      message: 'Collaborator retrieved successfully',
      data: this.toResponse(collaborator, merchant, user),
    };
  }

  async update(
    id: number,
    dto: UpdateCollaboratorDto,
    authenticatedUserMerchantId: number,
  ): Promise<OneCollaboratorResponseDto> {
    // 0. Validate that the DTO exists and is not empty
    if (!dto || (typeof dto === 'object' && Object.keys(dto).length === 0)) {
      throw new BadRequestException('Update data is required');
    }

    // 0.1. Validate that at least one valid field is present
    const validFields = ['user_id', 'name', 'role', 'status'];
    const hasValidField = validFields.some((field) => dto[field] !== undefined);

    if (!hasValidField) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    // 1. Validar que el usuario autenticado tiene merchant_id
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to update collaborators',
      );
    }

    // 2. Validate that the ID is valid
    if (!id || id <= 0 || !Number.isInteger(id)) {
      throw new BadRequestException('Invalid collaborator ID');
    }

    // 3. Buscar el colaborador existente
    const collaborator = await this.collaboratorRepo.findOne({
      where: { id },
      relations: ['user', 'merchant', 'shift'],
    });

    if (!collaborator) {
      throw new NotFoundException(`Collaborator ${id} not found`);
    }

    // 4. Validar que el usuario solo puede modificar colaboradores de su propio merchant
    if (collaborator.merchant_id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only update collaborators from your own merchant',
      );
    }

    // 5. Validar campos y tipos
    if (dto.name !== undefined) {
      if (typeof dto.name !== 'string' || dto.name.trim() === '') {
        throw new BadRequestException('Name must be a non-empty string');
      }
      if (dto.name.length > 150) {
        throw new BadRequestException('Name cannot exceed 150 characters');
      }
    }

    if (dto.user_id !== undefined) {
      if (!Number.isInteger(dto.user_id) || dto.user_id <= 0) {
        throw new BadRequestException('User ID must be a positive integer');
      }
    }

    // 6. Validate uniqueness if updating the user_id
    if (dto.user_id !== undefined && dto.user_id !== collaborator.user_id) {
      const existingCollaborator = await this.collaboratorRepo.findOne({
        where: { user_id: dto.user_id },
      });

      if (existingCollaborator && existingCollaborator.id !== id) {
        throw new ConflictException(
          `User with ID '${dto.user_id}' is already a collaborator. A user can only be a collaborator for one merchant.`,
        );
      }
    }

    // 7. Validate that the user exists if updating
    if (dto.user_id !== undefined) {
      const user = await this.userRepo.findOne({ where: { id: dto.user_id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${dto.user_id} not found`);
      }
    }

    // 8. Validar que el merchant existe
    const merchant = await this.merchantRepo.findOne({
      where: { id: collaborator.merchant_id },
    });
    if (!merchant) {
      throw new NotFoundException(
        `Merchant with ID ${collaborator.merchant_id} not found`,
      );
    }

    // 9. Preparar datos para actualizar
    const updateData: any = {};
    if (dto.user_id !== undefined) updateData.user_id = dto.user_id;
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.status !== undefined) updateData.status = dto.status;
    // null explícito = desenganchar del turno. `undefined` (campo ausente) lo deja como está,
    // que es lo que espera cualquier cliente que mande sólo los campos que tocó.
    if (dto.shift_id !== undefined) {
      const shift = await this.resolveShift(dto.shift_id, collaborator.merchant_id);
      updateData.shift_id = shift?.id ?? null;
    }

    // 10. Verificar que hay al menos un campo para actualizar
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    // 11. Actualizar el colaborador
    Object.assign(collaborator, updateData);
    const updatedCollaborator = await this.collaboratorRepo.save(collaborator);

    // 12. Get user information for the response
    const user = await this.userRepo.findOne({
      where: { id: updatedCollaborator.user_id },
    });
    if (!user) {
      throw new NotFoundException(
        `User with ID ${updatedCollaborator.user_id} not found`,
      );
    }

    // 13. Return response with merchant and user information (without dates)
    return {
      statusCode: 200,
      message: 'Collaborator updated successfully',
      data: this.toResponse(updatedCollaborator, merchant, user),
    };
  }

  async remove(
    id: number,
    authenticatedUserMerchantId: number,
  ): Promise<OneCollaboratorResponseDto> {
    // 1. Validar que el usuario autenticado tiene merchant_id
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to delete collaborators',
      );
    }

    // 2. Validate that the ID is valid
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid collaborator ID');
    }

    // 3. Buscar el colaborador
    const collaborator = await this.collaboratorRepo.findOne({
      where: { id },
      relations: ['user', 'merchant', 'shift'],
    });

    if (!collaborator) {
      throw new NotFoundException(`Collaborator ${id} not found`);
    }

    // 4. Validar que el usuario solo puede eliminar colaboradores de su propio merchant

    if (collaborator.merchant_id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only delete collaborators from your own merchant',
      );
    }

    // 5. Validate that the collaborator is not already deleted
    if (collaborator.status === CollaboratorStatus.DELETED) {
      throw new ConflictException('Collaborator is already deleted');
    }

    // 6. Validate dependencies (here you can add specific validations)
    // For example, check if there are active shifts, orders, etc.
    // const activeShifts = await this.shiftRepo.count({ where: { collaborator_id: id, status: 'active' } });
    // if (activeShifts > 0) {
    //   throw new ConflictException('Cannot delete collaborator with active shifts');
    // }

    // 7. Validar que el merchant existe
    const merchant = await this.merchantRepo.findOne({
      where: { id: collaborator.merchant_id },
    });
    if (!merchant) {
      throw new NotFoundException(
        `Merchant with ID ${collaborator.merchant_id} not found`,
      );
    }

    // 8. Validar que el usuario existe
    const user = await this.userRepo.findOne({
      where: { id: collaborator.user_id },
    });
    if (!user) {
      throw new NotFoundException(
        `User with ID ${collaborator.user_id} not found`,
      );
    }

    // 9. Soft delete - cambiar status a 'deleted'
    collaborator.status = CollaboratorStatus.DELETED;
    const updatedCollaborator = await this.collaboratorRepo.save(collaborator);

    // 10. Return response with merchant and user information (without dates)
    return {
      statusCode: 200,
      message: 'Collaborator deleted successfully',
      data: this.toResponse(updatedCollaborator, merchant, user),
    };
  }

  /**
   * Resumen operativo del colaborador: turnos, mesas, cajas y comandas.
   *
   * Los contadores salen de cinco COUNT en paralelo en vez de traerse las colecciones y
   * medirlas en memoria: un camarero veterano acumula miles de comandas y el cajón sólo
   * necesita el número y las últimas cinco.
   */
  async summary(
    id: number,
    authenticatedUserMerchantId: number,
  ): Promise<CollaboratorSummaryResponseDto> {
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant to view collaborators',
      );
    }
    if (!id || id <= 0 || !Number.isInteger(id)) {
      throw new BadRequestException('Invalid collaborator ID');
    }

    const collaborator = await this.collaboratorRepo.findOne({ where: { id } });
    if (!collaborator) {
      throw new NotFoundException(`Collaborator with ID ${id} not found`);
    }
    // Aislamiento multi-tenant: el resumen de un empleado ajeno no se enseña ni por id.
    if (collaborator.merchant_id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only view collaborators from your own merchant',
      );
    }

    const [
      shiftAssignments,
      tableAssignments,
      openedCashDrawers,
      closedCashDrawers,
      orders,
    ] = await Promise.all([
      this.shiftAssignmentRepo.count({ where: { collaboratorId: id } }),
      this.tableAssignmentRepo.count({ where: { collaboratorId: id } }),
      this.cashDrawerRepo.count({ where: { opened_by: id } }),
      this.cashDrawerRepo.count({ where: { closed_by: id } }),
      this.orderRepo.count({ where: { collaborator_id: id } }),
    ]);

    const [recentShifts, recentTables, recentOpened, recentClosed, recentOrders] =
      await Promise.all([
        this.shiftAssignmentRepo.find({
          where: { collaboratorId: id },
          order: { id: 'DESC' },
          take: 5,
        }),
        this.tableAssignmentRepo.find({
          where: { collaboratorId: id },
          order: { id: 'DESC' },
          take: 5,
        }),
        this.cashDrawerRepo.find({
          where: { opened_by: id },
          order: { id: 'DESC' },
          take: 5,
        }),
        this.cashDrawerRepo.find({
          where: { closed_by: id },
          order: { id: 'DESC' },
          take: 5,
        }),
        this.orderRepo.find({
          where: { collaborator_id: id },
          order: { id: 'DESC' },
          take: 5,
        }),
      ]);

    // El volumen se suma en la base: traerse todas las comandas para sumarlas aquí sería
    // pasear el histórico entero por la red para obtener un número.
    const totalRow = await this.orderRepo
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.total), 0)', 'sum')
      .where('order.collaborator_id = :id', { id })
      .getRawOne<{ sum: string }>();

    return {
      statusCode: 200,
      message: 'Collaborator summary retrieved successfully',
      data: {
        collaborator_id: id,
        counts: {
          shiftAssignments,
          tableAssignments,
          openedCashDrawers,
          closedCashDrawers,
          orders,
        },
        ordersTotal: Number(totalRow?.sum ?? 0),
        recentShiftAssignments: recentShifts.map((a) => ({
          id: a.id,
          shiftId: a.shiftId,
          startTime: a.startTime ?? null,
          endTime: a.endTime ?? null,
          status: a.status ?? null,
        })),
        recentTableAssignments: recentTables.map((a) => ({
          id: a.id,
          tableId: a.tableId,
          // `table` es eager en TableAssignment, así que el número viene sin pedir join.
          tableNumber: a.table?.number ?? null,
          zoneName: a.table?.floorZone?.name ?? null,
          assignedAt: a.assignedAt ?? null,
          releasedAt: a.releasedAt ?? null,
        })),
        recentCashDrawers: [
          ...recentOpened.map((d) => ({
            id: d.id,
            custody: 'opened' as const,
            status: d.status ?? null,
            createdAt: d.created_at ?? null,
            updatedAt: d.updated_at ?? null,
          })),
          ...recentClosed.map((d) => ({
            id: d.id,
            custody: 'closed' as const,
            status: d.status ?? null,
            createdAt: d.created_at ?? null,
            updatedAt: d.updated_at ?? null,
          })),
        ].slice(0, 5),
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          order_number: o.order_number ?? null,
          total: Number(o.total ?? 0),
          status: o.status ?? null,
          created_at: o.created_at ?? null,
        })),
      },
    };
  }
}
