import { Test, TestingModule } from '@nestjs/testing';
import { SupplierPaymentAllocationsService } from './supplier_payment_allocations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SupplierPaymentAllocation } from './entities/supplier_payment_allocation.entity';
import { SupplierPayment } from '../supplier-payments/entities/supplier-payment.entity';
import { Supplier } from '../../../core/business-partners/suppliers/entities/supplier.entity';
import { SupplierCreditNote } from '../supplier-credit-notes/entities/supplier-credit-note.entity';
import { SupplierInvoice } from '../supplier-invoices/entities/supplier-invoice.entity';

describe('SupplierPaymentAllocationsService', () => {
  let service: SupplierPaymentAllocationsService;

  const allocationRepoMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const paymentRepoMock = { findOne: jest.fn(), save: jest.fn() };
  const supplierRepoMock = { findOne: jest.fn() };
  const creditNoteRepoMock = { findOne: jest.fn(), save: jest.fn() };
  const invoiceRepoMock = { find: jest.fn(), save: jest.fn() };

  /** Stubs the SUM query builders used by every recompute helper. */
  const stubSum = (sum = 0) => {
    allocationRepoMock.createQueryBuilder.mockReturnValue({
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sum: String(sum) }),
    });
  };

  const baseDto = {
    supplier_id: 5,
    document_number: 'INV-2026-001',
    document_type: 'invoice',
    allocated_amount: 100,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierPaymentAllocationsService,
        {
          provide: getRepositoryToken(SupplierPaymentAllocation),
          useValue: allocationRepoMock,
        },
        {
          provide: getRepositoryToken(SupplierPayment),
          useValue: paymentRepoMock,
        },
        { provide: getRepositoryToken(Supplier), useValue: supplierRepoMock },
        {
          provide: getRepositoryToken(SupplierCreditNote),
          useValue: creditNoteRepoMock,
        },
        {
          provide: getRepositoryToken(SupplierInvoice),
          useValue: invoiceRepoMock,
        },
      ],
    }).compile();

    service = module.get<SupplierPaymentAllocationsService>(
      SupplierPaymentAllocationsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('funding source mutual exclusion', () => {
    const XOR_MESSAGE =
      'An allocation must be funded by exactly one source: either a payment or a credit note.';

    it('rejects an allocation funded by both a payment and a credit note', async () => {
      await expect(
        service.create({ ...baseDto, payment_id: 1, credit_note_id: 2 }),
      ).rejects.toThrow(XOR_MESSAGE);
      expect(allocationRepoMock.save).not.toHaveBeenCalled();
    });

    it('rejects an allocation with no funding source at all', async () => {
      await expect(service.create({ ...baseDto })).rejects.toThrow(XOR_MESSAGE);
      expect(allocationRepoMock.save).not.toHaveBeenCalled();
    });

    it('accepts a payment-funded allocation and leaves credit_note_id null', async () => {
      paymentRepoMock.findOne.mockResolvedValue({
        id: 1,
        company_id: 3,
        total_amount: 500,
        status: 'draft',
      });
      supplierRepoMock.findOne.mockResolvedValue({ id: 5 });
      allocationRepoMock.create.mockImplementation((v: object) => v);
      allocationRepoMock.save.mockImplementation((v: object) =>
        Promise.resolve({ id: 11, created_at: new Date(), ...v }),
      );
      paymentRepoMock.save.mockImplementation((v: object) =>
        Promise.resolve(v),
      );
      invoiceRepoMock.find.mockResolvedValue([]);
      stubSum(100);

      const res = await service.create({ ...baseDto, payment_id: 1 });

      expect(res.statusCode).toBe(201);
      expect(res.data.payment_id).toBe(1);
      expect(res.data.credit_note_id).toBeNull();
    });

    it('accepts a credit-note-funded allocation with a null payment_id', async () => {
      creditNoteRepoMock.findOne.mockResolvedValue({
        id: 2,
        company_id: 3,
        total_amount: 500,
        applied_amount: 0,
        status: 'issued',
      });
      supplierRepoMock.findOne.mockResolvedValue({ id: 5 });
      allocationRepoMock.create.mockImplementation((v: object) => v);
      allocationRepoMock.save.mockImplementation((v: object) =>
        Promise.resolve({ id: 12, created_at: new Date(), ...v }),
      );
      creditNoteRepoMock.save.mockImplementation((v: object) =>
        Promise.resolve(v),
      );
      invoiceRepoMock.find.mockResolvedValue([]);
      stubSum(100);

      const res = await service.create({ ...baseDto, credit_note_id: 2 });

      expect(res.statusCode).toBe(201);
      expect(res.data.payment_id).toBeNull();
      expect(res.data.credit_note_id).toBe(2);
      // No payment to recompute — the credit note is the one that gets re-aggregated.
      expect(paymentRepoMock.save).not.toHaveBeenCalled();
      expect(creditNoteRepoMock.save).toHaveBeenCalled();
    });

    it('scopes a credit-note-funded allocation by the credit note company', async () => {
      creditNoteRepoMock.findOne.mockResolvedValue({ id: 2, company_id: 99 });
      supplierRepoMock.findOne.mockResolvedValue({ id: 5 });

      await expect(
        service.create({ ...baseDto, credit_note_id: 2 }, 3),
      ).rejects.toThrow('Supplier credit note with ID 2 not found');
    });
  });

  describe('credit-note-funded cascade', () => {
    it('recomputes the target invoice using the credit note company', async () => {
      const invoice = {
        id: 40,
        total_amount: 500,
        paid_amount: 0,
        balance_due: 500,
        status: 'pending',
      };
      creditNoteRepoMock.findOne.mockResolvedValue({
        id: 2,
        company_id: 3,
        total_amount: 500,
        applied_amount: 0,
        status: 'issued',
      });
      supplierRepoMock.findOne.mockResolvedValue({ id: 5 });
      allocationRepoMock.create.mockImplementation((v: object) => v);
      allocationRepoMock.save.mockImplementation((v: object) =>
        Promise.resolve({ id: 13, created_at: new Date(), ...v }),
      );
      creditNoteRepoMock.save.mockImplementation((v: object) =>
        Promise.resolve(v),
      );
      invoiceRepoMock.find.mockResolvedValue([invoice]);
      invoiceRepoMock.save.mockImplementation((v: object) =>
        Promise.resolve(v),
      );
      stubSum(200);

      await service.create({ ...baseDto, credit_note_id: 2 });

      expect(invoiceRepoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ company_id: 3 }),
        }),
      );
      expect(invoice.paid_amount).toBe(200);
      expect(invoice.balance_due).toBe(300);
      expect(invoice.status).toBe('partially_paid');
    });
  });
});
