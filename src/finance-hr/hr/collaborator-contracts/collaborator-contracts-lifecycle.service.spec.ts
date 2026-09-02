/**
 * Reglas de negocio del directorio de contratos: solape de vigencias, derivación de la
 * retribución hacia los campos que consume la nómina y bitácora de enmiendas.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CollaboratorContractsService } from './collaborator-contracts.service';
import { CollaboratorContract } from './entities/collaborator-contract.entity';
import { CollaboratorContractRevision } from './entities/collaborator-contract-revision.entity';
import { Company } from '../../../platform-saas/companies/entities/company.entity';
import { Merchant } from '../../../platform-saas/merchants/entities/merchant.entity';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { ContractType } from './constants/contract-type.enum';
import { EmploymentType } from './constants/employment-type.enum';
import { PayFrequency } from './constants/pay-frequency.enum';

const MERCHANT_ID = 7;
const COLLABORATOR_ID = 4;

function dateOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function contractFixture(
  overrides: Partial<CollaboratorContract> = {},
): CollaboratorContract {
  return {
    id: 12,
    company_id: 1,
    merchant_id: MERCHANT_ID,
    collaborator_id: COLLABORATOR_ID,
    contract_type: ContractType.HOURLY,
    employment_type: EmploymentType.FULL_TIME,
    pay_frequency: PayFrequency.HOURLY,
    working_hours_per_week: 40,
    document_url: null,
    document_name: null,
    base_salary: 0,
    hourly_rate: 22.5,
    overtime_multiplier: 1.5,
    double_overtime_multiplier: 2,
    tips_included_in_payroll: false,
    active: true,
    start_date: new Date('2026-01-01'),
    end_date: null,
    created_at: new Date('2026-01-01T09:00:00Z'),
    updated_at: new Date('2026-01-01T09:00:00Z'),
    collaborator: { id: COLLABORATOR_ID, name: 'Juan Pérez', role: 'waiter' },
    ...overrides,
  } as CollaboratorContract;
}

describe('CollaboratorContractsService — lifecycle', () => {
  let service: CollaboratorContractsService;
  let contractRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let revisionRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let collaboratorRepo: { findOne: jest.Mock };
  let queryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getMany: jest.fn().mockResolvedValue([contractFixture()]),
    };
    contractRepo = {
      create: jest.fn((v: Partial<CollaboratorContract>) => v),
      save: jest.fn((v: CollaboratorContract) => Promise.resolve(v)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    revisionRepo = {
      create: jest.fn((v: Partial<CollaboratorContractRevision>) => v),
      save: jest.fn((v: unknown) => Promise.resolve(v)),
      find: jest.fn().mockResolvedValue([]),
    };
    collaboratorRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: COLLABORATOR_ID,
        merchant_id: MERCHANT_ID,
        name: 'Juan Pérez',
        role: 'waiter',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaboratorContractsService,
        {
          provide: getRepositoryToken(CollaboratorContract),
          useValue: contractRepo,
        },
        {
          provide: getRepositoryToken(CollaboratorContractRevision),
          useValue: revisionRepo,
        },
        {
          provide: getRepositoryToken(Company),
          useValue: { findOne: jest.fn().mockResolvedValue({ id: 1 }) },
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: MERCHANT_ID }),
          },
        },
        { provide: getRepositoryToken(Collaborator), useValue: collaboratorRepo },
      ],
    }).compile();

    service = module.get(CollaboratorContractsService);
  });

  const baseCreateDto = {
    company_id: 1,
    merchant_id: MERCHANT_ID,
    collaborator_id: COLLABORATOR_ID,
    start_date: '2026-01-01',
  };

  describe('overlap guard', () => {
    it('rejects a second contract while the current one is still in force', async () => {
      contractRepo.find.mockResolvedValue([contractFixture({ end_date: null })]);

      await expect(
        service.create({ ...baseCreateDto }, MERCHANT_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when the current contract ends in the future', async () => {
      contractRepo.find.mockResolvedValue([
        contractFixture({ end_date: dateOffset(45) }),
      ]);

      await expect(
        service.create({ ...baseCreateDto }, MERCHANT_ID),
      ).rejects.toThrow(/already has an active contract/);
    });

    // La renovación es justo el caso que RRHH necesita: el contrato viejo sigue marcado
    // como activo pero su fecha de fin ya pasó, así que no debe estorbar al siguiente.
    it('allows a renewal when the previous contract already expired', async () => {
      contractRepo.find.mockResolvedValue([
        contractFixture({ end_date: dateOffset(-1) }),
      ]);

      const res = await service.create({ ...baseCreateDto }, MERCHANT_ID);
      expect(res.statusCode).toBe(201);
    });

    it('allows registering an already terminated contract without checking overlap', async () => {
      contractRepo.find.mockResolvedValue([contractFixture()]);

      const res = await service.create(
        { ...baseCreateDto, active: false },
        MERCHANT_ID,
      );
      expect(res.statusCode).toBe(201);
      expect(contractRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('compensation derivation', () => {
    it('stores an hourly wage on hourly_rate and tags the payroll model', async () => {
      const res = await service.create(
        {
          ...baseCreateDto,
          pay_frequency: PayFrequency.HOURLY,
          wage_rate: 22.5,
        },
        MERCHANT_ID,
      );

      expect(res.data.hourly_rate).toBe(22.5);
      expect(res.data.base_salary).toBe(0);
      expect(res.data.contract_type).toBe(ContractType.HOURLY);
      expect(res.data.wage_rate).toBe(22.5);
    });

    it('stores a periodic wage on base_salary', async () => {
      const res = await service.create(
        {
          ...baseCreateDto,
          pay_frequency: PayFrequency.MONTHLY,
          wage_rate: 3500,
        },
        MERCHANT_ID,
      );

      expect(res.data.base_salary).toBe(3500);
      expect(res.data.hourly_rate).toBe(0);
      expect(res.data.contract_type).toBe(ContractType.SALARY);
      expect(res.data.wage_rate).toBe(3500);
    });

    it('keeps honouring legacy payloads that send contract_type and the raw fields', async () => {
      const res = await service.create(
        {
          ...baseCreateDto,
          contract_type: ContractType.MIXED,
          base_salary: 1200,
          hourly_rate: 9,
        },
        MERCHANT_ID,
      );

      expect(res.data.contract_type).toBe(ContractType.MIXED);
      expect(res.data.base_salary).toBe(1200);
      expect(res.data.hourly_rate).toBe(9);
    });

    it('defaults employment type and weekly hours', async () => {
      const res = await service.create({ ...baseCreateDto }, MERCHANT_ID);

      expect(res.data.employment_type).toBe(EmploymentType.FULL_TIME);
      expect(res.data.working_hours_per_week).toBe(40);
    });

    it('keeps the stored wage when an amendment only touches other terms', async () => {
      contractRepo.findOne.mockResolvedValue(
        contractFixture({ hourly_rate: 22.5 }),
      );

      const res = await service.update(
        12,
        { working_hours_per_week: 32 },
        MERCHANT_ID,
      );

      expect(res.data.wage_rate).toBe(22.5);
      expect(res.data.working_hours_per_week).toBe(32);
    });

    it('moves the amount across fields when the pay frequency changes', async () => {
      contractRepo.findOne.mockResolvedValue(
        contractFixture({ hourly_rate: 22.5 }),
      );

      const res = await service.update(
        12,
        { pay_frequency: PayFrequency.MONTHLY, wage_rate: 3600 },
        MERCHANT_ID,
      );

      expect(res.data.base_salary).toBe(3600);
      expect(res.data.pay_frequency).toBe(PayFrequency.MONTHLY);
    });
  });

  describe('date sequence', () => {
    it('rejects an end date that is not after the start date', async () => {
      await expect(
        service.create(
          { ...baseCreateDto, start_date: '2026-05-01', end_date: '2026-05-01' },
          MERCHANT_ID,
        ),
      ).rejects.toThrow('end_date must be after start_date');
    });

    it('accepts an open-ended contract', async () => {
      const res = await service.create({ ...baseCreateDto }, MERCHANT_ID);
      expect(res.data.end_date).toBeNull();
    });

    it('rejects an amendment that inverts the range', async () => {
      contractRepo.findOne.mockResolvedValue(
        contractFixture({ start_date: new Date('2026-03-01') }),
      );

      await expect(
        service.update(12, { end_date: '2026-02-01' }, MERCHANT_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('amendment log', () => {
    it('records one row per amended term, with author', async () => {
      contractRepo.findOne.mockResolvedValue(contractFixture());

      await service.update(
        12,
        { wage_rate: 25, working_hours_per_week: 32 },
        MERCHANT_ID,
        99,
      );

      const saved = revisionRepo.save.mock.calls[0][0] as Array<{
        field: string;
        previous_value: string | null;
        new_value: string | null;
        changed_by_user_id: number | null;
      }>;
      expect(saved.map((r) => r.field).sort()).toEqual([
        'hourly_rate',
        'working_hours_per_week',
      ]);
      const wage = saved.find((r) => r.field === 'hourly_rate')!;
      expect(wage.previous_value).toBe('22.5');
      expect(wage.new_value).toBe('25');
      expect(wage.changed_by_user_id).toBe(99);
    });

    it('writes nothing when the amendment changes no term', async () => {
      contractRepo.findOne.mockResolvedValue(contractFixture());

      await service.update(12, {}, MERCHANT_ID);

      expect(revisionRepo.save).not.toHaveBeenCalled();
    });

    it('logs the document attachment too', async () => {
      contractRepo.findOne.mockResolvedValue(contractFixture());

      const res = await service.attachDocument(
        12,
        { url: '/uploads/contracts/c-1.pdf', name: 'firmado.pdf' },
        MERCHANT_ID,
        99,
      );

      expect(res.data.document_url).toBe('/uploads/contracts/c-1.pdf');
      expect(res.data.document_name).toBe('firmado.pdf');
      const saved = revisionRepo.save.mock.calls[0][0] as Array<{
        field: string;
      }>;
      expect(saved.map((r) => r.field)).toEqual(['document_url']);
    });

    it('returns the log newest first', async () => {
      contractRepo.findOne.mockResolvedValue(contractFixture());
      revisionRepo.find.mockResolvedValue([
        {
          id: 2,
          contract_id: 12,
          field: 'hourly_rate',
          previous_value: '22.5',
          new_value: '25',
          changed_by_user_id: 99,
          created_at: new Date('2026-06-01T10:00:00Z'),
        },
      ]);

      const res = await service.revisions(12, MERCHANT_ID);

      expect(res.data).toHaveLength(1);
      expect(res.data[0].new_value).toBe('25');
      expect(revisionRepo.find).toHaveBeenCalledWith({
        where: { contract_id: 12 },
        order: { created_at: 'DESC', id: 'DESC' },
      });
    });
  });

  describe('scoping and hydration', () => {
    it('hydrates the collaborator so the grid can render name and role', async () => {
      const res = await service.findAll({}, MERCHANT_ID);

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'contract.collaborator',
        'collaborator',
      );
      expect(res.data[0].collaborator).toEqual({
        id: COLLABORATOR_ID,
        name: 'Juan Pérez',
        role: 'waiter',
      });
    });

    it('narrows to contracts expiring inside the requested window', async () => {
      await service.findAll({ expiring_within_days: 30 }, MERCHANT_ID);

      const clauses = queryBuilder.andWhere.mock.calls.map(
        (c) => c[0] as string,
      );
      expect(clauses).toContain('contract.end_date IS NOT NULL');
      expect(clauses).toContain('contract.end_date <= :horizon');
    });

    it('refuses a contract from another merchant', async () => {
      contractRepo.findOne.mockResolvedValue(
        contractFixture({ merchant_id: 99 }),
      );

      await expect(service.findOne(12, MERCHANT_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuses to create for a collaborator of another merchant', async () => {
      collaboratorRepo.findOne.mockResolvedValue({
        id: COLLABORATOR_ID,
        merchant_id: 99,
      });

      await expect(
        service.create({ ...baseCreateDto }, MERCHANT_ID),
      ).rejects.toThrow('Collaborator does not belong to the given merchant');
    });

    it('reports a missing contract', async () => {
      contractRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(404, MERCHANT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
