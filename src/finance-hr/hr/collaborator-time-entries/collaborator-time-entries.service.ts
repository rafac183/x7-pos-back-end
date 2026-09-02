import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { TimeEntry } from './entities/time-entry.entity';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { GetTimeEntryQueryDto } from './dto/get-time-entry-query.dto';
import {
  TimeEntryResponseDto,
  OneTimeEntryResponseDto,
} from './dto/time-entry-response.dto';
import { PaginatedTimeEntriesResponseDto } from './dto/paginated-time-entries-response.dto';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { Shift } from 'src/restaurant-operations/shift/shifts/entities/shift.entity';
import { TimeEntryRevision } from './entities/time-entry-revision.entity';

/**
 * Umbral diario a partir del cual las horas cuentan como extra.
 *
 * El módulo `core/configuration/merchant-overtime-rule` es el dueño natural de este número
 * (tiene `thresholdHours` por comercio); mientras no se enganche aquí, se usa la jornada
 * estándar de 8 h para no inventar una regla de negocio que ya existe en otro sitio.
 */
export const DAILY_OVERTIME_THRESHOLD_HOURS = 8;
@Injectable()
export class CollaboratorTimeEntriesService {
  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntryRepo: Repository<TimeEntry>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepo: Repository<Collaborator>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(TimeEntryRevision)
    private readonly revisionRepo: Repository<TimeEntryRevision>,
  ) {}

  // ================= Reglas del fichaje =================

  /**
   * Horas pagables: el intervalo bruto menos el descanso no retribuido, partido en
   * ordinarias y extra por el umbral diario. Un fichaje sin salida todavía no computa:
   * la jornada está abierta y cualquier número sería una invención.
   */
  computeHours(
    clockIn: Date,
    clockOut: Date | null,
    breakMinutes: number,
  ): { regular: number; overtime: number; net: number } {
    if (!clockOut) return { regular: 0, overtime: 0, net: 0 };
    const rawHours = (clockOut.getTime() - clockIn.getTime()) / 3_600_000;
    // El descanso nunca puede dejar el neto en negativo, por mucho que se teclee.
    const net = Math.max(0, rawHours - Math.max(0, breakMinutes) / 60);
    const regular = Math.min(net, DAILY_OVERTIME_THRESHOLD_HOURS);
    return {
      regular: Number(regular.toFixed(2)),
      overtime: Number(Math.max(0, net - DAILY_OVERTIME_THRESHOLD_HOURS).toFixed(2)),
      net: Number(net.toFixed(2)),
    };
  }

  private assertChronology(clockIn: Date, clockOut: Date | null): void {
    if (clockOut && clockOut <= clockIn) {
      throw new BadRequestException(
        'Clock-Out timestamp must be after Clock-In timestamp.',
      );
    }
  }

  /**
   * Nadie puede estar fichado en dos sitios a la vez.
   *
   * Dos intervalos se solapan si cada uno empieza antes de que el otro acabe. Una jornada
   * abierta (sin salida) se trata como "hasta el infinito": mientras no se cierre, cualquier
   * fichaje posterior del mismo colaborador choca con ella, que es justo la incidencia que
   * el supervisor tiene que resolver antes de seguir.
   */
  private async assertNoOverlap(
    collaboratorId: number,
    clockIn: Date,
    clockOut: Date | null,
    excludeId?: number,
  ): Promise<void> {
    const siblings = await this.timeEntryRepo.find({
      where: { collaborator_id: collaboratorId },
    });
    const end = clockOut ?? new Date(8_640_000_000_000_000);
    const clash = siblings.find((other) => {
      if (excludeId != null && other.id === excludeId) return false;
      const otherIn = new Date(other.clock_in);
      const otherEnd = other.clock_out
        ? new Date(other.clock_out)
        : new Date(8_640_000_000_000_000);
      return clockIn < otherEnd && otherIn < end;
    });
    if (clash) {
      throw new BadRequestException(
        `This time range overlaps time entry #TME-${clash.id} for the same collaborator.`,
      );
    }
  }

  private toResponseDto(e: TimeEntry): TimeEntryResponseDto {
    return {
      id: e.id,
      company_id: e.company_id,
      merchant_id: e.merchant_id,
      collaborator_id: e.collaborator_id,
      shift_id: e.shift_id,
      clock_in: e.clock_in?.toISOString() ?? '',
      clock_out: e.clock_out ? e.clock_out.toISOString() : null,
      regular_hours: Number(e.regular_hours),
      overtime_hours: Number(e.overtime_hours),
      double_overtime_hours: Number(e.double_overtime_hours),
      approved: e.approved,
      created_at: e.created_at?.toISOString() ?? '',
      break_minutes: Number(e.break_minutes ?? 0),
      adjustment_reason: e.adjustment_reason ?? null,
      is_edited: Boolean(e.is_edited),
      edited_by_user_id: e.edited_by_user_id ?? null,
      edited_at: e.edited_at ? e.edited_at.toISOString() : null,
      collaborator: e.collaborator
        ? {
            id: e.collaborator.id,
            name: e.collaborator.name,
            role: e.collaborator.role,
          }
        : null,
      shift: e.shift
        ? {
            id: e.shift.id,
            role: e.shift.role ?? null,
            startTime: e.shift.startTime
              ? new Date(e.shift.startTime).toISOString()
              : null,
            endTime: e.shift.endTime
              ? new Date(e.shift.endTime).toISOString()
              : null,
          }
        : null,
    };
  }

  async create(
    dto: CreateTimeEntryDto,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<OneTimeEntryResponseDto> {
    if (
      authenticatedUserMerchantId != null &&
      dto.merchant_id !== authenticatedUserMerchantId
    ) {
      throw new ForbiddenException(
        'You can only create time entries for your own merchant',
      );
    }

    const company = await this.companyRepo.findOne({
      where: { id: dto.company_id },
    });
    if (!company)
      throw new NotFoundException(
        `Company with ID ${dto.company_id} not found`,
      );

    const merchant = await this.merchantRepo.findOne({
      where: { id: dto.merchant_id },
    });
    if (!merchant)
      throw new NotFoundException(
        `Merchant with ID ${dto.merchant_id} not found`,
      );

    const collaborator = await this.collaboratorRepo.findOne({
      where: { id: dto.collaborator_id },
    });
    if (!collaborator)
      throw new NotFoundException(
        `Collaborator with ID ${dto.collaborator_id} not found`,
      );
    if (collaborator.merchant_id !== dto.merchant_id) {
      throw new BadRequestException(
        'Collaborator does not belong to the given merchant',
      );
    }

    // El turno es opcional: un fichaje manual por olvido puede no tener ninguno detrás.
    if (dto.shift_id != null) {
      const shift = await this.shiftRepo.findOne({ where: { id: dto.shift_id } });
      if (!shift)
        throw new NotFoundException(`Shift with ID ${dto.shift_id} not found`);
      if (shift.merchantId !== dto.merchant_id) {
        throw new BadRequestException(
          'Shift does not belong to the given merchant',
        );
      }
    }

    const clockIn = new Date(dto.clock_in);
    const clockOut = dto.clock_out ? new Date(dto.clock_out) : null;
    this.assertChronology(clockIn, clockOut);
    await this.assertNoOverlap(dto.collaborator_id, clockIn, clockOut);

    const breakMinutes = dto.break_minutes ?? 0;
    // Las horas se calculan aquí y no se aceptan del cliente: son el dato que va a nómina.
    const hours = this.computeHours(clockIn, clockOut, breakMinutes);

    const entry = this.timeEntryRepo.create({
      company_id: dto.company_id,
      merchant_id: dto.merchant_id,
      collaborator_id: dto.collaborator_id,
      shift_id: dto.shift_id ?? null,
      clock_in: clockIn,
      clock_out: clockOut,
      break_minutes: breakMinutes,
      adjustment_reason: dto.adjustment_reason?.trim() || null,
      regular_hours: hours.regular,
      overtime_hours: hours.overtime,
      double_overtime_hours: dto.double_overtime_hours ?? 0,
      approved: dto.approved ?? false,
    });

    const saved = await this.timeEntryRepo.save(entry);
    return {
      statusCode: 201,
      message: 'Time entry created successfully',
      data: this.toResponseDto(saved),
    };
  }

  async findAll(
    query: GetTimeEntryQueryDto,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<PaginatedTimeEntriesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.timeEntryRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.collaborator', 'collaborator')
      .leftJoinAndSelect('entry.shift', 'shift')
      .orderBy('entry.clock_in', 'DESC');

    if (authenticatedUserMerchantId != null) {
      qb.andWhere('entry.merchant_id = :merchantId', {
        merchantId: authenticatedUserMerchantId,
      });
    }
    if (query.company_id != null)
      qb.andWhere('entry.company_id = :companyId', {
        companyId: query.company_id,
      });
    if (query.merchant_id != null)
      qb.andWhere('entry.merchant_id = :merchantId', {
        merchantId: query.merchant_id,
      });
    if (query.collaborator_id != null) {
      qb.andWhere('entry.collaborator_id = :collaboratorId', {
        collaboratorId: query.collaborator_id,
      });
    }
    if (query.shift_id != null)
      qb.andWhere('entry.shift_id = :shiftId', { shiftId: query.shift_id });
    if (query.approved !== undefined)
      qb.andWhere('entry.approved = :approved', { approved: query.approved });
    if (query.from_date) {
      qb.andWhere('entry.clock_in >= :fromDate', { fromDate: query.from_date });
    }
    if (query.to_date) {
      qb.andWhere('entry.clock_in <= :toDate', {
        toDate: query.to_date + 'T23:59:59.999Z',
      });
    }

    const total = await qb.getCount();
    const entries = await qb.skip(skip).take(limit).getMany();

    const totalPages = Math.ceil(total / limit);
    return {
      statusCode: 200,
      message: 'Time entries retrieved successfully',
      data: entries.map((e) => this.toResponseDto(e)),
      paginationMeta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(
    id: number,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<OneTimeEntryResponseDto> {
    if (!id || id <= 0) throw new BadRequestException('Invalid time entry ID');

    const entry = await this.timeEntryRepo.findOne({
      where: { id },
      relations: ['collaborator', 'shift'],
    });
    if (!entry)
      throw new NotFoundException(`Time entry with ID ${id} not found`);

    if (
      authenticatedUserMerchantId != null &&
      entry.merchant_id !== authenticatedUserMerchantId
    ) {
      throw new ForbiddenException(
        'You can only view time entries from your own merchant',
      );
    }

    return {
      statusCode: 200,
      message: 'Time entry retrieved successfully',
      data: this.toResponseDto(entry),
    };
  }

  async update(
    id: number,
    dto: UpdateTimeEntryDto,
    authenticatedUserMerchantId: number | undefined,
    editedByUserId?: number,
  ): Promise<OneTimeEntryResponseDto> {
    if (!id || id <= 0) throw new BadRequestException('Invalid time entry ID');

    const entry = await this.timeEntryRepo.findOne({
      where: { id },
      relations: ['collaborator', 'shift'],
    });
    if (!entry)
      throw new NotFoundException(`Time entry with ID ${id} not found`);

    if (
      authenticatedUserMerchantId != null &&
      entry.merchant_id !== authenticatedUserMerchantId
    ) {
      throw new ForbiddenException(
        'You can only update time entries from your own merchant',
      );
    }

    // Fotografía del estado previo: es lo que la revisión guardará como "antes".
    const before = {
      clock_in: entry.clock_in,
      clock_out: entry.clock_out,
      break_minutes: entry.break_minutes,
    };

    if (dto.company_id != null) {
      const company = await this.companyRepo.findOne({
        where: { id: dto.company_id },
      });
      if (!company)
        throw new NotFoundException(
          `Company with ID ${dto.company_id} not found`,
        );
      entry.company_id = dto.company_id;
    }
    if (dto.merchant_id != null) {
      const merchant = await this.merchantRepo.findOne({
        where: { id: dto.merchant_id },
      });
      if (!merchant)
        throw new NotFoundException(
          `Merchant with ID ${dto.merchant_id} not found`,
        );
      entry.merchant_id = dto.merchant_id;
    }
    if (dto.collaborator_id != null) {
      const collaborator = await this.collaboratorRepo.findOne({
        where: { id: dto.collaborator_id },
      });
      if (!collaborator)
        throw new NotFoundException(
          `Collaborator with ID ${dto.collaborator_id} not found`,
        );
      entry.collaborator_id = dto.collaborator_id;
    }
    if (dto.shift_id != null) {
      const shift = await this.shiftRepo.findOne({
        where: { id: dto.shift_id },
      });
      if (!shift)
        throw new NotFoundException(`Shift with ID ${dto.shift_id} not found`);
      entry.shift_id = dto.shift_id;
    }
    if (dto.clock_in != null) entry.clock_in = new Date(dto.clock_in);
    if (dto.clock_out !== undefined)
      entry.clock_out = dto.clock_out ? new Date(dto.clock_out) : null;
    if (dto.break_minutes != null) entry.break_minutes = dto.break_minutes;
    if (dto.double_overtime_hours != null)
      entry.double_overtime_hours = dto.double_overtime_hours as any;
    if (dto.approved !== undefined) entry.approved = dto.approved;

    // ¿Se ha tocado el fichaje en sí? El resto de campos (aprobación, turno) no exige
    // justificación; corregir las marcas o el descanso sí, porque cambia lo que se paga.
    const punchChanged =
      dto.clock_in != null ||
      dto.clock_out !== undefined ||
      dto.break_minutes != null;

    if (punchChanged) {
      const reason = dto.adjustment_reason?.trim();
      if (!reason) {
        throw new BadRequestException(
          'An adjustment reason is required when correcting a punch.',
        );
      }
      this.assertChronology(entry.clock_in, entry.clock_out);
      await this.assertNoOverlap(
        entry.collaborator_id,
        entry.clock_in,
        entry.clock_out,
        entry.id,
      );

      // Las horas se recalculan siempre: aceptarlas del cliente permitiría cuadrar la
      // nómina a mano sin que las marcas lo respalden.
      const hours = this.computeHours(
        entry.clock_in,
        entry.clock_out,
        entry.break_minutes,
      );
      entry.regular_hours = hours.regular as unknown as number;
      entry.overtime_hours = hours.overtime as unknown as number;

      entry.adjustment_reason = reason;
      entry.is_edited = true;
      entry.edited_by_user_id = editedByUserId ?? entry.edited_by_user_id;
      entry.edited_at = new Date();
    }

    const saved = await this.timeEntryRepo.save(entry);

    // La revisión se inserta DESPUÉS de guardar: si el guardado falla, no queda una línea
    // de histórico describiendo un cambio que nunca ocurrió.
    if (punchChanged) {
      await this.revisionRepo.save(
        this.revisionRepo.create({
          time_entry_id: saved.id,
          edited_by_user_id: editedByUserId ?? 0,
          adjustment_reason: saved.adjustment_reason ?? '',
          previous_clock_in: before.clock_in ?? null,
          previous_clock_out: before.clock_out ?? null,
          previous_break_minutes: before.break_minutes ?? null,
          new_clock_in: saved.clock_in ?? null,
          new_clock_out: saved.clock_out ?? null,
          new_break_minutes: saved.break_minutes ?? null,
        }),
      );
    }

    return {
      statusCode: 200,
      message: 'Time entry updated successfully',
      data: this.toResponseDto(saved),
    };
  }

  /** Histórico de correcciones de un fichaje, de la más reciente a la más antigua. */
  async revisions(
    id: number,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<{ statusCode: number; message: string; data: TimeEntryRevision[] }> {
    if (!id || id <= 0) throw new BadRequestException('Invalid time entry ID');

    const entry = await this.timeEntryRepo.findOne({
      where: { id },
      relations: ['collaborator', 'shift'],
    });
    if (!entry)
      throw new NotFoundException(`Time entry with ID ${id} not found`);
    if (
      authenticatedUserMerchantId != null &&
      entry.merchant_id !== authenticatedUserMerchantId
    ) {
      throw new ForbiddenException(
        'You can only read time entries from your own merchant',
      );
    }

    return {
      statusCode: 200,
      message: 'Revisions retrieved successfully',
      data: await this.revisionRepo.find({
        where: { time_entry_id: id },
        order: { created_at: 'DESC' },
      }),
    };
  }

  async remove(
    id: number,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<OneTimeEntryResponseDto> {
    if (!id || id <= 0) throw new BadRequestException('Invalid time entry ID');

    const entry = await this.timeEntryRepo.findOne({
      where: { id },
      relations: ['collaborator', 'shift'],
    });
    if (!entry)
      throw new NotFoundException(`Time entry with ID ${id} not found`);

    if (
      authenticatedUserMerchantId != null &&
      entry.merchant_id !== authenticatedUserMerchantId
    ) {
      throw new ForbiddenException(
        'You can only delete time entries from your own merchant',
      );
    }

    await this.timeEntryRepo.remove(entry);
    return {
      statusCode: 200,
      message: 'Time entry deleted successfully',
      data: this.toResponseDto(entry),
    };
  }
}
