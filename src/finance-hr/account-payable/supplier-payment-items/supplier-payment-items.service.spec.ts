import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { SupplierPaymentItemsService } from './supplier-payment-items.service';
import { SupplierPaymentItem } from './entities/supplier-payment-item.entity';
import { SupplierPayment } from '../supplier-payments/entities/supplier-payment.entity';
import { SupplierPaymentStatus } from '../supplier-payments/constants/supplier-payment-status.enum';

describe('SupplierPaymentItemsService', () => {
  let service: SupplierPaymentItemsService;

  const itemRepoMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const paymentRepoMock = {
    findOne: jest.fn(),
  };

  /** Stubs the items SUM query used by the parent-total guard. */
  const stubItemsSum = (sum: number) => {
    itemRepoMock.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sum: String(sum) }),
    });
  };

  const draftPayment = (overrides: Partial<SupplierPayment> = {}) =>
    ({
      id: 1,
      company_id: 3,
      total_amount: 1000,
      allocated_amount: 0,
      status: SupplierPaymentStatus.DRAFT,
      deleted_at: null,
      ...overrides,
    }) as SupplierPayment;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierPaymentItemsService,
        {
          provide: getRepositoryToken(SupplierPaymentItem),
          useValue: itemRepoMock,
        },
        {
          provide: getRepositoryToken(SupplierPayment),
          useValue: paymentRepoMock,
        },
      ],
    }).compile();

    service = module.get<SupplierPaymentItemsService>(
      SupplierPaymentItemsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parent amount enforcement', () => {
    it('creates an item when the cumulative total stays within the payment total', async () => {
      paymentRepoMock.findOne.mockResolvedValue(draftPayment());
      stubItemsSum(400);
      itemRepoMock.create.mockImplementation((v: object) => v);
      itemRepoMock.save.mockImplementation((v: object) =>
        Promise.resolve({ id: 9, ...v }),
      );

      const res = await service.create({
        payment_id: 1,
        document_number: 'INV-1',
        document_type: 'invoice',
        amount: 600,
      });

      expect(res.statusCode).toBe(201);
      expect(itemRepoMock.save).toHaveBeenCalled();
    });

    it('rejects a create whose cumulative total exceeds the parent voucher total', async () => {
      paymentRepoMock.findOne.mockResolvedValue(draftPayment());
      stubItemsSum(400);

      await expect(
        service.create({
          payment_id: 1,
          document_number: 'INV-2',
          document_type: 'invoice',
          amount: 700,
        }),
      ).rejects.toThrow(
        'The total amount of payment items ($1100.00) cannot exceed the parent payment voucher total ($1000.00).',
      );
      expect(itemRepoMock.save).not.toHaveBeenCalled();
    });

    it('excludes the edited item from the sum so an unchanged update passes', async () => {
      itemRepoMock.findOne.mockResolvedValue({
        id: 5,
        payment_id: 1,
        document_number: 'INV-1',
        document_type: 'invoice',
        amount: 600,
        deleted_at: null,
      });
      paymentRepoMock.findOne.mockResolvedValue(draftPayment());
      // 400 is the sum of the OTHER items — the edited item's own 600 is excluded.
      stubItemsSum(400);
      itemRepoMock.save.mockImplementation((v: object) => Promise.resolve(v));

      const res = await service.update(5, { amount: 600 });

      expect(res.statusCode).toBe(200);
      expect(itemRepoMock.save).toHaveBeenCalled();
    });
  });

  describe('posted payment immobility lock', () => {
    it.each([
      SupplierPaymentStatus.POSTED,
      SupplierPaymentStatus.FULLY_ALLOCATED,
      SupplierPaymentStatus.CANCELLED,
    ])('blocks creating an item when the parent is %s', async (status) => {
      paymentRepoMock.findOne.mockResolvedValue(draftPayment({ status }));

      await expect(
        service.create({
          payment_id: 1,
          document_number: 'INV-3',
          document_type: 'invoice',
          amount: 10,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(itemRepoMock.save).not.toHaveBeenCalled();
    });

    it('blocks creating an item when the parent already has an allocated amount', async () => {
      paymentRepoMock.findOne.mockResolvedValue(
        draftPayment({ allocated_amount: 50 }),
      );

      await expect(
        service.create({
          payment_id: 1,
          document_number: 'INV-4',
          document_type: 'invoice',
          amount: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks soft-deleting an item of a posted payment', async () => {
      itemRepoMock.findOne.mockResolvedValue({
        id: 7,
        payment_id: 1,
        document_number: 'INV-5',
        document_type: 'invoice',
        amount: 10,
        deleted_at: null,
      });
      paymentRepoMock.findOne.mockResolvedValue(
        draftPayment({ status: SupplierPaymentStatus.POSTED }),
      );

      await expect(service.remove(7)).rejects.toThrow(BadRequestException);
      expect(itemRepoMock.save).not.toHaveBeenCalled();
    });

    it('soft-deletes an item of a draft payment', async () => {
      const item = {
        id: 7,
        payment_id: 1,
        document_number: 'INV-5',
        document_type: 'invoice',
        amount: 10,
        deleted_at: null as Date | null,
      };
      itemRepoMock.findOne.mockResolvedValue(item);
      paymentRepoMock.findOne.mockResolvedValue(draftPayment());
      itemRepoMock.save.mockImplementation((v: object) => Promise.resolve(v));

      await service.remove(7);

      expect(item.deleted_at).toBeInstanceOf(Date);
    });
  });
});
