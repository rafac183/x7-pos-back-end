/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CollaboratorTimeEntriesService,
  DAILY_OVERTIME_THRESHOLD_HOURS,
} from './collaborator-time-entries.service';
import { TimeEntry } from './entities/time-entry.entity';
import { TimeEntryRevision } from './entities/time-entry-revision.entity';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { Shift } from 'src/restaurant-operations/shift/shifts/entities/shift.entity';

/**
 * Lo que estas historias añadieron al módulo: cálculo de horas netas, guardas de
 * cronología y solapamiento, y la traza inmutable de correcciones.
 */
describe('CollaboratorTimeEntriesService · punch rules & audit', () => {
  let service: CollaboratorTimeEntriesService;

  const MERCHANT_ID = 3;
  const SUPERVISOR_ID = 7;

  const at = (h: number, m = 0) => new Date(2026, 7, 30, h, m, 0);

  const entry = (over: Partial<TimeEntry> = {}): TimeEntry =>
    ({
      id: 42,
      company_id: 1,
      merchant_id: MERCHANT_ID,
      collaborator_id: 4,
      shift_id: null,
      clock_in: at(8),
      clock_out: at(16),
      break_minutes: 30,
      adjustment_reason: null,
      is_edited: false,
      edited_by_user_id: null,
      edited_at: null,
      regular_hours: 7.5,
      overtime_hours: 0,
      double_overtime_hours: 0,
      approved: false,
      created_at: at(8),
      ...over,
    }) as unknown as TimeEntry;

  const timeEntryRepo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn((v: unknown) => Promise.resolve({ id: 42, ...(v as object) })),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
  };
  const revisionRepo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn((v: unknown) => Promise.resolve(v)),
    find: jest.fn().mockResolvedValue([]),
  };
  const companyRepo = { findOne: jest.fn() };
  const merchantRepo = { findOne: jest.fn() };
  const collaboratorRepo = { findOne: jest.fn() };
  const shiftRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaboratorTimeEntriesService,
        { provide: getRepositoryToken(TimeEntry), useValue: timeEntryRepo },
        { provide: getRepositoryToken(TimeEntryRevision), useValue: revisionRepo },
        { provide: getRepositoryToken(Company), useValue: companyRepo },
        { provide: getRepositoryToken(Merchant), useValue: merchantRepo },
        { provide: getRepositoryToken(Collaborator), useValue: collaboratorRepo },
        { provide: getRepositoryToken(Shift), useValue: shiftRepo },
      ],
    }).compile();

    service = module.get(CollaboratorTimeEntriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    [timeEntryRepo.findOne, timeEntryRepo.find, timeEntryRepo.save].forEach((m) =>
      m.mockReset(),
    );
    timeEntryRepo.find.mockResolvedValue([]);
    timeEntryRepo.save.mockImplementation((v: unknown) =>
      Promise.resolve({ id: 42, ...(v as object) }),
    );
    revisionRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));
  });

  // ================= Horas netas =================

  describe('computeHours', () => {
    it('descuenta el descanso del intervalo bruto', () => {
      // 8 h de reloj menos 30 min de descanso = 7,5 h pagables.
      expect(service.computeHours(at(8), at(16), 30)).toMatchObject({
        net: 7.5,
        regular: 7.5,
        overtime: 0,
      });
    });

    it('parte las horas por el umbral diario', () => {
      // 10 h netas con umbral de 8 → 8 ordinarias + 2 extra.
      const r = service.computeHours(at(8), at(18), 0);
      expect(r.regular).toBe(DAILY_OVERTIME_THRESHOLD_HOURS);
      expect(r.overtime).toBe(2);
    });

    it('una jornada abierta todavía no computa nada', () => {
      expect(service.computeHours(at(8), null, 30)).toEqual({
        regular: 0,
        overtime: 0,
        net: 0,
      });
    });

    it('un descanso desproporcionado no deja el neto en negativo', () => {
      expect(service.computeHours(at(8), at(9), 600).net).toBe(0);
    });

    it('redondea a dos decimales, que es lo que persiste la columna', () => {
      // 7 h 20 min = 7,33…
      expect(service.computeHours(at(8), at(15, 20), 0).net).toBe(7.33);
    });
  });

  // ================= Guardas =================

  describe('guardas al crear', () => {
    const dto = {
      company_id: 1,
      merchant_id: MERCHANT_ID,
      collaborator_id: 4,
      clock_in: at(8).toISOString(),
      clock_out: at(16).toISOString(),
      break_minutes: 30,
    };

    const prime = () => {
      companyRepo.findOne.mockResolvedValue({ id: 1 });
      merchantRepo.findOne.mockResolvedValue({ id: MERCHANT_ID });
      // El servicio valida que el colaborador sea del mismo comercio.
      collaboratorRepo.findOne.mockResolvedValue({ id: 4, merchant_id: MERCHANT_ID });
    };

    it('rechaza una salida anterior a la entrada, con el mensaje de la historia', async () => {
      prime();

      await expect(
        service.create({ ...dto, clock_out: at(7).toISOString() }, MERCHANT_ID),
      ).rejects.toThrow('Clock-Out timestamp must be after Clock-In timestamp.');
    });

    it('rechaza un intervalo que solapa con otro fichaje del mismo colaborador', async () => {
      prime();
      timeEntryRepo.find.mockResolvedValue([entry({ id: 9, clock_in: at(7), clock_out: at(12) })]);

      await expect(service.create(dto, MERCHANT_ID)).rejects.toThrow(
        'overlaps time entry #TME-9',
      );
    });

    it('una jornada abierta bloquea cualquier fichaje posterior hasta cerrarla', async () => {
      prime();
      timeEntryRepo.find.mockResolvedValue([
        entry({ id: 9, clock_in: at(6), clock_out: null }),
      ]);

      await expect(service.create(dto, MERCHANT_ID)).rejects.toThrow(BadRequestException);
    });

    it('deja pasar un intervalo que no toca a los demás', async () => {
      prime();
      timeEntryRepo.find.mockResolvedValue([
        entry({ id: 9, clock_in: at(17), clock_out: at(20) }),
      ]);

      await expect(service.create(dto, MERCHANT_ID)).resolves.toBeDefined();
    });

    it('calcula las horas en el servidor, ignorando las que mande el cliente', async () => {
      prime();

      await service.create(
        { ...dto, regular_hours: 99, overtime_hours: 99 },
        MERCHANT_ID,
      );

      const saved = timeEntryRepo.save.mock.calls[0][0] as TimeEntry;
      expect(Number(saved.regular_hours)).toBe(7.5);
      expect(Number(saved.overtime_hours)).toBe(0);
    });

    it('permite un fichaje manual sin turno programado detrás', async () => {
      prime();

      await service.create(dto, MERCHANT_ID);

      const saved = timeEntryRepo.save.mock.calls[0][0] as TimeEntry;
      expect(saved.shift_id).toBeNull();
      expect(shiftRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ================= Traza de auditoría =================

  describe('corrección de un fichaje', () => {
    it('exige justificación para tocar las marcas', async () => {
      timeEntryRepo.findOne.mockResolvedValue(entry());

      await expect(
        service.update(42, { clock_out: at(17).toISOString() }, MERCHANT_ID, SUPERVISOR_ID),
      ).rejects.toThrow('An adjustment reason is required when correcting a punch.');
    });

    it('marca la fila como editada y firma quién y cuándo', async () => {
      timeEntryRepo.findOne.mockResolvedValue(entry());

      await service.update(
        42,
        { clock_out: at(17).toISOString(), adjustment_reason: 'Missed Punch' },
        MERCHANT_ID,
        SUPERVISOR_ID,
      );

      const saved = timeEntryRepo.save.mock.calls[0][0] as TimeEntry;
      expect(saved.is_edited).toBe(true);
      expect(saved.edited_by_user_id).toBe(SUPERVISOR_ID);
      expect(saved.edited_at).toBeInstanceOf(Date);
      expect(saved.adjustment_reason).toBe('Missed Punch');
    });

    it('guarda el antes y el después en el histórico', async () => {
      timeEntryRepo.findOne.mockResolvedValue(entry());

      await service.update(
        42,
        {
          clock_out: at(18).toISOString(),
          break_minutes: 60,
          adjustment_reason: 'Supervisor Authorization',
        },
        MERCHANT_ID,
        SUPERVISOR_ID,
      );

      expect(revisionRepo.save).toHaveBeenCalledTimes(1);
      const revision = revisionRepo.create.mock.calls[0][0] as TimeEntryRevision;
      expect(revision).toMatchObject({
        time_entry_id: 42,
        edited_by_user_id: SUPERVISOR_ID,
        adjustment_reason: 'Supervisor Authorization',
        previous_clock_out: at(16),
        previous_break_minutes: 30,
        new_break_minutes: 60,
      });
    });

    it('recalcula las horas tras la corrección', async () => {
      timeEntryRepo.findOne.mockResolvedValue(entry());

      await service.update(
        42,
        { clock_out: at(19).toISOString(), adjustment_reason: 'Missed Punch' },
        MERCHANT_ID,
        SUPERVISOR_ID,
      );

      const saved = timeEntryRepo.save.mock.calls[0][0] as TimeEntry;
      // 8→19 son 11 h menos 30 min = 10,5 netas → 8 ordinarias + 2,5 extra.
      expect(Number(saved.regular_hours)).toBe(8);
      expect(Number(saved.overtime_hours)).toBe(2.5);
    });

    it('aprobar un fichaje no es una corrección: ni exige motivo ni deja revisión', async () => {
      timeEntryRepo.findOne.mockResolvedValue(entry());

      await service.update(42, { approved: true }, MERCHANT_ID, SUPERVISOR_ID);

      const saved = timeEntryRepo.save.mock.calls[0][0] as TimeEntry;
      expect(saved.is_edited).toBe(false);
      expect(revisionRepo.save).not.toHaveBeenCalled();
    });

    it('la corrección no puede dejar el fichaje solapado con otro', async () => {
      timeEntryRepo.findOne.mockResolvedValue(entry());
      timeEntryRepo.find.mockResolvedValue([
        entry({ id: 9, clock_in: at(17), clock_out: at(20) }),
      ]);

      await expect(
        service.update(
          42,
          { clock_out: at(18).toISOString(), adjustment_reason: 'Missed Punch' },
          MERCHANT_ID,
          SUPERVISOR_ID,
        ),
      ).rejects.toThrow('overlaps time entry #TME-9');
    });

    it('el propio fichaje no cuenta como solapamiento consigo mismo', async () => {
      timeEntryRepo.findOne.mockResolvedValue(entry());
      timeEntryRepo.find.mockResolvedValue([entry()]);

      await expect(
        service.update(
          42,
          { clock_out: at(17).toISOString(), adjustment_reason: 'Missed Punch' },
          MERCHANT_ID,
          SUPERVISOR_ID,
        ),
      ).resolves.toBeDefined();
    });
  });

  // ================= Histórico =================

  describe('revisions', () => {
    it('devuelve el histórico de la más reciente a la más antigua', async () => {
      timeEntryRepo.findOne.mockResolvedValue(entry());
      revisionRepo.find.mockResolvedValue([{ id: 2 }, { id: 1 }]);

      const res = await service.revisions(42, MERCHANT_ID);

      expect(res.data).toHaveLength(2);
      expect(revisionRepo.find).toHaveBeenCalledWith({
        where: { time_entry_id: 42 },
        order: { created_at: 'DESC' },
      });
    });

    it('no enseña el histórico de otro comercio', async () => {
      timeEntryRepo.findOne.mockResolvedValue(entry({ merchant_id: 99 }));

      await expect(service.revisions(42, MERCHANT_ID)).rejects.toThrow(ForbiddenException);
    });

    it('falla si el fichaje no existe', async () => {
      timeEntryRepo.findOne.mockResolvedValue(null);

      await expect(service.revisions(404, MERCHANT_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
