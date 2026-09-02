import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaboratorContract } from './entities/collaborator-contract.entity';
import { CollaboratorContractRevision } from './entities/collaborator-contract-revision.entity';
import { CreateCollaboratorContractDto } from './dto/create-collaborator-contract.dto';
import { UpdateCollaboratorContractDto } from './dto/update-collaborator-contract.dto';
import { GetCollaboratorContractQueryDto } from './dto/get-collaborator-contract-query.dto';
import {
  CollaboratorContractResponseDto,
  ContractRevisionResponseDto,
  ContractRevisionsResponseDto,
  OneCollaboratorContractResponseDto,
} from './dto/collaborator-contract-response.dto';
import { PaginatedCollaboratorContractsResponseDto } from './dto/paginated-collaborator-contracts-response.dto';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { ContractType } from './constants/contract-type.enum';
import { EmploymentType } from './constants/employment-type.enum';
import { PayFrequency } from './constants/pay-frequency.enum';

/** Términos cuyo cambio queda registrado en la bitácora de enmiendas. */
const AUDITED_FIELDS = [
  'employment_type',
  'contract_type',
  'pay_frequency',
  'base_salary',
  'hourly_rate',
  'working_hours_per_week',
  'overtime_multiplier',
  'double_overtime_multiplier',
  'tips_included_in_payroll',
  'active',
  'start_date',
  'end_date',
  'document_url',
] as const;

type AuditedField = (typeof AUDITED_FIELDS)[number];

@Injectable()
export class CollaboratorContractsService {
  constructor(
    @InjectRepository(CollaboratorContract)
    private readonly contractRepo: Repository<CollaboratorContract>,
    @InjectRepository(CollaboratorContractRevision)
    private readonly revisionRepo: Repository<CollaboratorContractRevision>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepo: Repository<Collaborator>,
  ) {}

  private toDateOnly(value: Date | string | null): string | null {
    if (!value) return null;
    return value instanceof Date
      ? value.toISOString().split('T')[0]
      : String(value).split('T')[0];
  }

  /**
   * Tarifa pactada según el periodo.
   *
   * La nómina sigue leyendo `hourly_rate` y `base_salary`, así que el importe único que
   * maneja RRHH se guarda en uno u otro y se reconstruye aquí. Sin esto la parrilla tendría
   * que adivinar cuál de los dos campos mirar en cada fila.
   */
  private wageRateOf(c: CollaboratorContract): number {
    return c.pay_frequency === PayFrequency.HOURLY
      ? Number(c.hourly_rate)
      : Number(c.base_salary);
  }

  private toResponseDto(
    c: CollaboratorContract,
  ): CollaboratorContractResponseDto {
    return {
      id: c.id,
      company_id: c.company_id,
      merchant_id: c.merchant_id,
      collaborator_id: c.collaborator_id,
      contract_type: c.contract_type,
      employment_type: c.employment_type ?? EmploymentType.FULL_TIME,
      pay_frequency: c.pay_frequency ?? PayFrequency.MONTHLY,
      wage_rate: this.wageRateOf(c),
      working_hours_per_week: Number(c.working_hours_per_week ?? 0),
      document_url: c.document_url ?? null,
      document_name: c.document_name ?? null,
      base_salary: Number(c.base_salary),
      hourly_rate: Number(c.hourly_rate),
      overtime_multiplier: Number(c.overtime_multiplier),
      double_overtime_multiplier: Number(c.double_overtime_multiplier),
      tips_included_in_payroll: c.tips_included_in_payroll,
      active: c.active,
      start_date: this.toDateOnly(c.start_date) ?? '',
      end_date: this.toDateOnly(c.end_date),
      created_at: c.created_at?.toISOString() ?? '',
      updated_at: c.updated_at?.toISOString() ?? c.created_at?.toISOString() ?? '',
      collaborator: c.collaborator
        ? {
            id: c.collaborator.id,
            name: c.collaborator.name,
            role: c.collaborator.role,
          }
        : null,
    };
  }

  private toRevisionDto(
    r: CollaboratorContractRevision,
  ): ContractRevisionResponseDto {
    return {
      id: r.id,
      contract_id: r.contract_id,
      field: r.field,
      previous_value: r.previous_value,
      new_value: r.new_value,
      changed_by_user_id: r.changed_by_user_id,
      created_at: r.created_at?.toISOString() ?? '',
    };
  }

  /**
   * Contrato vigente que impediría abrir otro para el mismo colaborador.
   *
   * Un contrato marcado como activo pero ya caducado no bloquea: la renovación es
   * justamente el caso en el que RRHH necesita dar de alta el siguiente. Sólo estorba el que
   * sigue en vigor —sin fecha de fin, o con una que aún no ha llegado—.
   */
  private async blockingActiveContract(
    collaboratorId: number,
    excludeContractId?: number,
  ): Promise<CollaboratorContract | null> {
    const candidates = await this.contractRepo.find({
      where: { collaborator_id: collaboratorId, active: true },
    });
    const today = this.toDateOnly(new Date())!;
    return (
      candidates.find((c) => {
        if (excludeContractId != null && c.id === excludeContractId)
          return false;
        const end = this.toDateOnly(c.end_date);
        return end === null || end >= today;
      }) ?? null
    );
  }

  private assertNoOverlap(
    existing: CollaboratorContract | null,
    collaboratorId: number,
  ): void {
    if (!existing) return;
    throw new ConflictException(
      `Collaborator with ID ${collaboratorId} already has an active contract. A collaborator can only have one active contract at a time.`,
    );
  }

  /**
   * Reparte el importe único del formulario entre los campos que consume la nómina.
   *
   * RRHH pacta "22,50 por hora" o "3.500 al mes"; el motor de pagos necesita saber en cuál
   * de los dos campos vive esa cifra y con qué modelo (`contract_type`) calcular. Se deriva
   * aquí para que el formulario no tenga que conocer el modelo de nómina.
   */
  private resolveCompensation(
    dto: Pick<
      CreateCollaboratorContractDto,
      | 'pay_frequency'
      | 'wage_rate'
      | 'contract_type'
      | 'base_salary'
      | 'hourly_rate'
    >,
    current?: CollaboratorContract,
  ): {
    pay_frequency: PayFrequency;
    contract_type: ContractType;
    base_salary: number;
    hourly_rate: number;
  } {
    const payFrequency =
      dto.pay_frequency ??
      current?.pay_frequency ??
      (dto.contract_type === ContractType.HOURLY
        ? PayFrequency.HOURLY
        : PayFrequency.MONTHLY);

    const hourly = payFrequency === PayFrequency.HOURLY;
    const fallbackWage = current
      ? hourly
        ? Number(current.hourly_rate)
        : Number(current.base_salary)
      : 0;
    const wage = dto.wage_rate ?? (hourly ? dto.hourly_rate : dto.base_salary);

    return {
      pay_frequency: payFrequency,
      contract_type:
        dto.contract_type ??
        current?.contract_type ??
        (hourly ? ContractType.HOURLY : ContractType.SALARY),
      hourly_rate: hourly
        ? (wage ?? fallbackWage)
        : (dto.hourly_rate ?? Number(current?.hourly_rate ?? 0)),
      base_salary: hourly
        ? (dto.base_salary ?? Number(current?.base_salary ?? 0))
        : (wage ?? fallbackWage),
    };
  }

  async create(
    dto: CreateCollaboratorContractDto,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<OneCollaboratorContractResponseDto> {
    if (
      authenticatedUserMerchantId != null &&
      dto.merchant_id !== authenticatedUserMerchantId
    ) {
      throw new ForbiddenException(
        'You can only create contracts for your own merchant',
      );
    }

    const company = await this.companyRepo.findOne({
      where: { id: dto.company_id },
    });
    if (!company)
      throw new NotFoundException(`Company with ID ${dto.company_id} not found`);

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

    if (dto.active !== false) {
      this.assertNoOverlap(
        await this.blockingActiveContract(dto.collaborator_id),
        dto.collaborator_id,
      );
    }

    const startDate = new Date(dto.start_date);
    const endDate = dto.end_date ? new Date(dto.end_date) : null;
    if (endDate && endDate <= startDate) {
      throw new BadRequestException('end_date must be after start_date');
    }

    const compensation = this.resolveCompensation(dto);

    const contract = this.contractRepo.create({
      company_id: dto.company_id,
      merchant_id: dto.merchant_id,
      collaborator_id: dto.collaborator_id,
      employment_type: dto.employment_type ?? EmploymentType.FULL_TIME,
      working_hours_per_week: dto.working_hours_per_week ?? 40,
      document_url: dto.document_url ?? null,
      document_name: dto.document_name ?? null,
      overtime_multiplier: dto.overtime_multiplier ?? 1.5,
      double_overtime_multiplier: dto.double_overtime_multiplier ?? 2.0,
      tips_included_in_payroll: dto.tips_included_in_payroll ?? false,
      active: dto.active ?? true,
      start_date: startDate,
      end_date: endDate,
      ...compensation,
    });

    const saved = await this.contractRepo.save(contract);
    saved.collaborator = saved.collaborator ?? collaborator;
    return {
      statusCode: 201,
      message: 'Collaborator contract created successfully',
      data: this.toResponseDto(saved),
    };
  }

  async findAll(
    query: GetCollaboratorContractQueryDto,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<PaginatedCollaboratorContractsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    // La ficha del colaborador viaja con el contrato: la parrilla muestra nombre y rol en
    // cada fila y sin el join tendría que pedirlos uno a uno.
    const qb = this.contractRepo
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.collaborator', 'collaborator')
      .orderBy('contract.created_at', 'DESC');

    if (authenticatedUserMerchantId != null) {
      qb.andWhere('contract.merchant_id = :merchantId', {
        merchantId: authenticatedUserMerchantId,
      });
    }
    if (query.company_id != null)
      qb.andWhere('contract.company_id = :companyId', {
        companyId: query.company_id,
      });
    if (query.merchant_id != null)
      qb.andWhere('contract.merchant_id = :merchantId', {
        merchantId: query.merchant_id,
      });
    if (query.collaborator_id != null) {
      qb.andWhere('contract.collaborator_id = :collaboratorId', {
        collaboratorId: query.collaborator_id,
      });
    }
    if (query.active !== undefined)
      qb.andWhere('contract.active = :active', { active: query.active });
    if (query.employment_type != null) {
      qb.andWhere('contract.employment_type = :employmentType', {
        employmentType: query.employment_type,
      });
    }
    if (query.expiring_within_days != null) {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + query.expiring_within_days);
      qb.andWhere('contract.end_date IS NOT NULL')
        .andWhere('contract.end_date <= :horizon', {
          horizon: this.toDateOnly(horizon),
        })
        .andWhere('contract.end_date >= :today', {
          today: this.toDateOnly(new Date()),
        });
    }

    const total = await qb.getCount();
    const contracts = await qb.skip(skip).take(limit).getMany();

    const totalPages = Math.ceil(total / limit);
    return {
      statusCode: 200,
      message: 'Collaborator contracts retrieved successfully',
      data: contracts.map((c) => this.toResponseDto(c)),
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

  private async loadOwned(
    id: number,
    authenticatedUserMerchantId: number | undefined,
    action: 'view' | 'update' | 'delete',
  ): Promise<CollaboratorContract> {
    if (!id || id <= 0) throw new BadRequestException('Invalid contract ID');

    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['collaborator'],
    });
    if (!contract)
      throw new NotFoundException(
        `Collaborator contract with ID ${id} not found`,
      );

    if (
      authenticatedUserMerchantId != null &&
      contract.merchant_id !== authenticatedUserMerchantId
    ) {
      throw new ForbiddenException(
        `You can only ${action} contracts from your own merchant`,
      );
    }
    return contract;
  }

  async findOne(
    id: number,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<OneCollaboratorContractResponseDto> {
    const contract = await this.loadOwned(
      id,
      authenticatedUserMerchantId,
      'view',
    );
    return {
      statusCode: 200,
      message: 'Collaborator contract retrieved successfully',
      data: this.toResponseDto(contract),
    };
  }

  private snapshot(c: CollaboratorContract): Record<AuditedField, string> {
    const out = {} as Record<AuditedField, string>;
    for (const field of AUDITED_FIELDS) {
      const value = c[field] as unknown;
      out[field] =
        value == null
          ? ''
          : value instanceof Date
            ? (this.toDateOnly(value) ?? '')
            : String(value);
    }
    return out;
  }

  private async recordRevisions(
    contractId: number,
    before: Record<AuditedField, string>,
    after: Record<AuditedField, string>,
    changedByUserId: number | null,
  ): Promise<void> {
    const rows = AUDITED_FIELDS.filter(
      (field) => before[field] !== after[field],
    ).map((field) =>
      this.revisionRepo.create({
        contract_id: contractId,
        field,
        previous_value: before[field] || null,
        new_value: after[field] || null,
        changed_by_user_id: changedByUserId,
      }),
    );
    if (rows.length > 0) await this.revisionRepo.save(rows);
  }

  async update(
    id: number,
    dto: UpdateCollaboratorContractDto,
    authenticatedUserMerchantId: number | undefined,
    changedByUserId: number | null = null,
  ): Promise<OneCollaboratorContractResponseDto> {
    const contract = await this.loadOwned(
      id,
      authenticatedUserMerchantId,
      'update',
    );
    const before = this.snapshot(contract);

    if (dto.company_id != null) {
      const company = await this.companyRepo.findOne({
        where: { id: dto.company_id },
      });
      if (!company)
        throw new NotFoundException(
          `Company with ID ${dto.company_id} not found`,
        );
      contract.company_id = dto.company_id;
    }
    if (dto.merchant_id != null) {
      const merchant = await this.merchantRepo.findOne({
        where: { id: dto.merchant_id },
      });
      if (!merchant)
        throw new NotFoundException(
          `Merchant with ID ${dto.merchant_id} not found`,
        );
      contract.merchant_id = dto.merchant_id;
    }
    if (dto.collaborator_id != null) {
      const collaborator = await this.collaboratorRepo.findOne({
        where: { id: dto.collaborator_id },
      });
      if (!collaborator)
        throw new NotFoundException(
          `Collaborator with ID ${dto.collaborator_id} not found`,
        );
      this.assertNoOverlap(
        await this.blockingActiveContract(dto.collaborator_id, id),
        dto.collaborator_id,
      );
      contract.collaborator_id = dto.collaborator_id;
      contract.collaborator = collaborator;
    }

    const compensation = this.resolveCompensation(dto, contract);
    contract.pay_frequency = compensation.pay_frequency;
    contract.contract_type = compensation.contract_type;
    contract.base_salary = compensation.base_salary;
    contract.hourly_rate = compensation.hourly_rate;

    if (dto.employment_type != null)
      contract.employment_type = dto.employment_type;
    if (dto.working_hours_per_week != null)
      contract.working_hours_per_week = dto.working_hours_per_week;
    if (dto.document_url !== undefined)
      contract.document_url = dto.document_url ?? null;
    if (dto.document_name !== undefined)
      contract.document_name = dto.document_name ?? null;
    if (dto.overtime_multiplier != null)
      contract.overtime_multiplier = dto.overtime_multiplier;
    if (dto.double_overtime_multiplier != null)
      contract.double_overtime_multiplier = dto.double_overtime_multiplier;
    if (dto.tips_included_in_payroll !== undefined)
      contract.tips_included_in_payroll = dto.tips_included_in_payroll;
    if (dto.active !== undefined) {
      if (dto.active === true && !contract.active) {
        this.assertNoOverlap(
          await this.blockingActiveContract(contract.collaborator_id, id),
          contract.collaborator_id,
        );
      }
      contract.active = dto.active;
    }
    if (dto.start_date != null) contract.start_date = new Date(dto.start_date);
    if (dto.end_date !== undefined)
      contract.end_date = dto.end_date ? new Date(dto.end_date) : null;

    if (
      contract.end_date &&
      contract.start_date &&
      new Date(contract.end_date) <= new Date(contract.start_date)
    ) {
      throw new BadRequestException('end_date must be after start_date');
    }

    const saved = await this.contractRepo.save(contract);
    await this.recordRevisions(
      id,
      before,
      this.snapshot(saved),
      changedByUserId,
    );

    return {
      statusCode: 200,
      message: 'Collaborator contract updated successfully',
      data: this.toResponseDto(saved),
    };
  }

  /** Enlaza el documento firmado ya almacenado y lo deja anotado en la bitácora. */
  async attachDocument(
    id: number,
    document: { url: string; name: string },
    authenticatedUserMerchantId: number | undefined,
    changedByUserId: number | null = null,
  ): Promise<OneCollaboratorContractResponseDto> {
    const contract = await this.loadOwned(
      id,
      authenticatedUserMerchantId,
      'update',
    );
    const before = this.snapshot(contract);

    contract.document_url = document.url;
    contract.document_name = document.name;

    const saved = await this.contractRepo.save(contract);
    await this.recordRevisions(
      id,
      before,
      this.snapshot(saved),
      changedByUserId,
    );

    return {
      statusCode: 200,
      message: 'Contract document uploaded successfully',
      data: this.toResponseDto(saved),
    };
  }

  async revisions(
    id: number,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<ContractRevisionsResponseDto> {
    await this.loadOwned(id, authenticatedUserMerchantId, 'view');
    const rows = await this.revisionRepo.find({
      where: { contract_id: id },
      order: { created_at: 'DESC', id: 'DESC' },
    });
    return {
      statusCode: 200,
      message: 'Contract revisions retrieved successfully',
      data: rows.map((r) => this.toRevisionDto(r)),
    };
  }

  async remove(
    id: number,
    authenticatedUserMerchantId: number | undefined,
  ): Promise<OneCollaboratorContractResponseDto> {
    const contract = await this.loadOwned(
      id,
      authenticatedUserMerchantId,
      'delete',
    );
    const snapshot = this.toResponseDto(contract);
    await this.contractRepo.remove(contract);
    return {
      statusCode: 200,
      message: 'Collaborator contract deleted successfully',
      data: snapshot,
    };
  }
}
