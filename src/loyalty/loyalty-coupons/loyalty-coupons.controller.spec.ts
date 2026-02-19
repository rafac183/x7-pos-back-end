import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyCouponsController } from './loyalty-coupons.controller';
import { LoyaltyCouponsService } from './loyalty-coupons.service';
import { CreateLoyaltyCouponDto } from './dto/create-loyalty-coupon.dto';
import { UpdateLoyaltyCouponDto } from './dto/update-loyalty-coupon.dto';
import { GetLoyaltyCouponsQueryDto } from './dto/get-loyalty-coupons-query.dto';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/constants/role.enum';
import { Scope } from '../../users/constants/scope.enum';
import { LoyaltyCouponStatus } from './constants/loyalty-coupons-status.enum';
import { AllPaginatedLoyaltyCouponsDto } from './dto/all-paginated-loyalty-coupons.dto';

describe('LoyaltyCouponsController', () => {
  let controller: LoyaltyCouponsController;
  let user: AuthenticatedUser;

  const mockLoyaltyCouponsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoyaltyCouponsController],
      providers: [
        {
          provide: LoyaltyCouponsService,
          useValue: mockLoyaltyCouponsService,
        },
      ],
    }).compile();

    controller = module.get<LoyaltyCouponsController>(LoyaltyCouponsController);
    user = {
      id: 1,
      email: 'test@example.com',
      role: UserRole.MERCHANT_ADMIN,
      scope: Scope.MERCHANT_WEB,
      merchant: { id: 1 },
    } as AuthenticatedUser;

    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('FindAll', () => {
    it('should return a paginated list of loyalty coupons', async () => {
      const query: GetLoyaltyCouponsQueryDto = { page: 1, limit: 10 };
      const expectedResult: AllPaginatedLoyaltyCouponsDto = {
        statusCode: 200,
        message: 'Success',
        data: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };

      mockLoyaltyCouponsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(user, query);

      expect(result).toEqual(expectedResult);
      expect(mockLoyaltyCouponsService.findAll).toHaveBeenCalledWith(query, user.merchant.id);
    });

    it('should handle service errors when finding all coupons', async () => {
      const query: GetLoyaltyCouponsQueryDto = { page: 1, limit: 10 };
      mockLoyaltyCouponsService.findAll.mockRejectedValue(new Error('Service Error'));

      await expect(controller.findAll(user, query)).rejects.toThrow('Service Error');
    });
  });

  describe('FindOne', () => {
    it('should return a single loyalty coupon', async () => {
      const id = 1;
      const expectedResult = {
        statusCode: 200,
        message: 'Success',
        data: { id: 1, code: 'TESCODE' },
      };

      mockLoyaltyCouponsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(user, id);

      expect(result).toEqual(expectedResult);
      expect(mockLoyaltyCouponsService.findOne).toHaveBeenCalledWith(id, user.merchant.id);
    });

    it('should handle coupon not found', async () => {
      const id = 999;
      mockLoyaltyCouponsService.findOne.mockRejectedValue(new Error('Not Found'));

      await expect(controller.findOne(user, id)).rejects.toThrow('Not Found');
    });
  });

  describe('Create', () => {
    it('should create a loyalty coupon', async () => {
      const createDto: CreateLoyaltyCouponDto = {
        loyalty_customer_id: 1,
        code: 'TESTCODE123',
        reward_id: 1,
        status: LoyaltyCouponStatus.ACTIVE,
        discount_value: 10,
        expires_at: new Date(),
      };

      const expectedResult = {
        statusCode: 201,
        message: 'Loyalty Coupon created successfully',
        data: { id: 1, ...createDto },
      };

      mockLoyaltyCouponsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(user, createDto);

      expect(result).toEqual(expectedResult);
      expect(mockLoyaltyCouponsService.create).toHaveBeenCalledWith(user.merchant.id, createDto);
    });
  });

  describe('Update', () => {
    it('should update a loyalty coupon', async () => {
      const id = 1;
      const updateDto: UpdateLoyaltyCouponDto = { status: LoyaltyCouponStatus.REDEEMED };
      const expectedResult = {
        statusCode: 200,
        message: 'Loyalty Coupon updated successfully',
        data: { id: 1, status: LoyaltyCouponStatus.REDEEMED },
      };

      mockLoyaltyCouponsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(user, id, updateDto);

      expect(result).toEqual(expectedResult);
      expect(mockLoyaltyCouponsService.update).toHaveBeenCalledWith(id, user.merchant.id, updateDto);
    });
  });

  describe('Remove', () => {
    it('should remove a loyalty coupon', async () => {
      const id = 1;
      const expectedResult = {
        statusCode: 200,
        message: 'Loyalty Coupon deleted successfully',
        data: { id: 1 },
      };

      mockLoyaltyCouponsService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(user, id);

      expect(result).toEqual(expectedResult);
      expect(mockLoyaltyCouponsService.remove).toHaveBeenCalledWith(id, user.merchant.id);
    });
  });

  describe('Service Integration', () => {
    it('should call service methods with correct parameters', async () => {
      const createDto: CreateLoyaltyCouponDto = {
        loyalty_customer_id: 1,
        code: 'TESTCODE123',
        reward_id: 1,
        status: LoyaltyCouponStatus.ACTIVE,
        discount_value: 10,
        expires_at: new Date(),
      };
      const updateDto: UpdateLoyaltyCouponDto = { status: LoyaltyCouponStatus.REDEEMED };
      const id = 1;
      const query: GetLoyaltyCouponsQueryDto = { page: 1, limit: 10 };

      mockLoyaltyCouponsService.create.mockResolvedValue({});
      mockLoyaltyCouponsService.findAll.mockResolvedValue({});
      mockLoyaltyCouponsService.findOne.mockResolvedValue({});
      mockLoyaltyCouponsService.update.mockResolvedValue({});
      mockLoyaltyCouponsService.remove.mockResolvedValue({});

      await controller.create(user, createDto);
      await controller.findAll(user, query);
      await controller.findOne(user, id);
      await controller.update(user, id, updateDto);
      await controller.remove(user, id);

      expect(mockLoyaltyCouponsService.create).toHaveBeenCalledWith(user.merchant.id, createDto);
      expect(mockLoyaltyCouponsService.findAll).toHaveBeenCalledWith(query, user.merchant.id);
      expect(mockLoyaltyCouponsService.findOne).toHaveBeenCalledWith(id, user.merchant.id);
      expect(mockLoyaltyCouponsService.update).toHaveBeenCalledWith(id, user.merchant.id, updateDto);
      expect(mockLoyaltyCouponsService.remove).toHaveBeenCalledWith(id, user.merchant.id);
    });
  });
});
