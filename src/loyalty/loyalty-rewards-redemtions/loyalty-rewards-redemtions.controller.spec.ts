import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyRewardsRedemtionsController } from './loyalty-rewards-redemtions.controller';
import { LoyaltyRewardsRedemtionsService } from './loyalty-rewards-redemtions.service';
import { CreateLoyaltyRewardsRedemtionDto } from './dto/create-loyalty-rewards-redemtion.dto';
import { UpdateLoyaltyRewardsRedemtionDto } from './dto/update-loyalty-rewards-redemtion.dto';
import { GetLoyaltyRewardsRedemtionsQueryDto } from './dto/get-loyalty-rewards-redemtions-query.dto';
import {
  OneLoyaltyRewardsRedemtionResponse,
  LoyaltyRewardsRedemtionResponseDto,
} from './dto/loyalty-rewards-redemtion-response.dto';
import { AllPaginatedLoyaltyRewardsRedemtionDto } from './dto/all-paginated-loyalty-rewards-redemtion.dto';
import { LoyaltyRewardLittleResponseDto } from '../loyalty-reward/dto/loyalty-reward-response.dto';
import { OrderLittleResponseDto } from 'src/orders/dto/order-response.dto';
import { LoyaltyCustomerLittleResponseDto } from '../loyalty-customer/dto/loyalty-customer-response.dto';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

describe('LoyaltyRewardsRedemtionsController', () => {
  let controller: LoyaltyRewardsRedemtionsController;
  let service: LoyaltyRewardsRedemtionsService;

  const mockLoyaltyRewardsRedemtionsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRedemptionDto: LoyaltyRewardsRedemtionResponseDto = {
    id: 1,
    loyaltyCustomer: { id: 1, current_points: 100, lifetime_points: 500 } as LoyaltyCustomerLittleResponseDto,
    reward: { id: 1, name: 'Test Reward', description: 'Desc', cost_points: 50 } as LoyaltyRewardLittleResponseDto,
    order: { id: 101, businessStatus: null } as OrderLittleResponseDto,
    redeemed_points: 50,
    redeemed_at: new Date(),
  };

  const mockOneResponse: OneLoyaltyRewardsRedemtionResponse = {
    statusCode: 200,
    message: 'Success',
    data: mockRedemptionDto,
  };

  const mockUser = {
    merchant: { id: 1 },
  } as AuthenticatedUser;

  const merchantId = mockUser.merchant.id;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoyaltyRewardsRedemtionsController],
      providers: [
        {
          provide: LoyaltyRewardsRedemtionsService,
          useValue: mockLoyaltyRewardsRedemtionsService,
        },
      ],
    }).compile();

    controller = module.get<LoyaltyRewardsRedemtionsController>(LoyaltyRewardsRedemtionsController);
    service = module.get<LoyaltyRewardsRedemtionsService>(LoyaltyRewardsRedemtionsService);

    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a redemption', async () => {
      const dto: CreateLoyaltyRewardsRedemtionDto = {
        loyalty_customer_id: 1,
        reward_id: 1,
        order_id: 101,
        redeemed_points: 50,
      };

      mockLoyaltyRewardsRedemtionsService.create.mockResolvedValue(mockOneResponse);

      const result = await controller.create(mockUser, dto);

      expect(result).toEqual(mockOneResponse);
      expect(service.create).toHaveBeenCalledWith(merchantId, dto);
    });

    it('should handle service errors when creating a redemption', async () => {
      const dto: CreateLoyaltyRewardsRedemtionDto = {
        loyalty_customer_id: 1,
        reward_id: 1,
        order_id: 101,
        redeemed_points: 50,
      };
      mockLoyaltyRewardsRedemtionsService.create.mockRejectedValue(new Error('Service Error'));

      await expect(controller.create(mockUser, dto)).rejects.toThrow('Service Error');
    });
  });

  describe('findAll', () => {
    const query: GetLoyaltyRewardsRedemtionsQueryDto = { page: 1, limit: 10 };

    it('should return paginated redemptions', async () => {
      const expectedResult: AllPaginatedLoyaltyRewardsRedemtionDto = {
        statusCode: 200,
        message: 'Success',
        data: [mockRedemptionDto],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      mockLoyaltyRewardsRedemtionsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(mockUser, query);

      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query, merchantId);
    });

    it('should handle service errors when finding all redemptions', async () => {
      mockLoyaltyRewardsRedemtionsService.findAll.mockRejectedValue(new Error('Service Error'));

      await expect(controller.findAll(mockUser, query)).rejects.toThrow('Service Error');
    });
  });

  describe('findOne', () => {
    const id = 1;

    it('should return a single redemption', async () => {
      mockLoyaltyRewardsRedemtionsService.findOne.mockResolvedValue(mockOneResponse);

      const result = await controller.findOne(mockUser, id);

      expect(result).toEqual(mockOneResponse);
      expect(service.findOne).toHaveBeenCalledWith(id, merchantId);
    });

    it('should handle redemption not found', async () => {
      mockLoyaltyRewardsRedemtionsService.findOne.mockRejectedValue(new Error('Not Found'));

      await expect(controller.findOne(mockUser, id)).rejects.toThrow('Not Found');
    });
  });

  describe('update', () => {
    const id = 1;
    const dto: UpdateLoyaltyRewardsRedemtionDto = { redeemed_points: 60 };

    it('should update a redemption', async () => {
      mockLoyaltyRewardsRedemtionsService.update.mockResolvedValue(mockOneResponse);

      const result = await controller.update(mockUser, id, dto);

      expect(result).toEqual(mockOneResponse);
      expect(service.update).toHaveBeenCalledWith(id, merchantId, dto);
    });

    it('should handle service errors when updating a redemption', async () => {
      mockLoyaltyRewardsRedemtionsService.update.mockRejectedValue(new Error('Update Failed'));

      await expect(controller.update(mockUser, id, dto)).rejects.toThrow('Update Failed');
    });
  });

  describe('remove', () => {
    const id = 1;

    it('should remove a redemption', async () => {
      mockLoyaltyRewardsRedemtionsService.remove.mockResolvedValue(mockOneResponse);

      const result = await controller.remove(mockUser, id);

      expect(result).toEqual(mockOneResponse);
      expect(service.remove).toHaveBeenCalledWith(id, merchantId);
    });

    it('should handle service errors when removing a redemption', async () => {
      mockLoyaltyRewardsRedemtionsService.remove.mockRejectedValue(new Error('Delete Failed'));

      await expect(controller.remove(mockUser, id)).rejects.toThrow('Delete Failed');
    });
  });

  describe('Service Integration', () => {
    it('should call service methods with correct parameters', async () => {
      const id = 1;
      const createDto: CreateLoyaltyRewardsRedemtionDto = {
        loyalty_customer_id: 1,
        reward_id: 1,
        order_id: 101,
        redeemed_points: 50,
      };
      const updateDto: UpdateLoyaltyRewardsRedemtionDto = { redeemed_points: 60 };
      const query: GetLoyaltyRewardsRedemtionsQueryDto = { page: 1, limit: 10 };

      mockLoyaltyRewardsRedemtionsService.create.mockResolvedValue({});
      mockLoyaltyRewardsRedemtionsService.findAll.mockResolvedValue({});
      mockLoyaltyRewardsRedemtionsService.findOne.mockResolvedValue({});
      mockLoyaltyRewardsRedemtionsService.update.mockResolvedValue({});
      mockLoyaltyRewardsRedemtionsService.remove.mockResolvedValue({});

      await controller.create(mockUser, createDto);
      await controller.findAll(mockUser, query);
      await controller.findOne(mockUser, id);
      await controller.update(mockUser, id, updateDto);
      await controller.remove(mockUser, id);

      expect(mockLoyaltyRewardsRedemtionsService.create).toHaveBeenCalledWith(merchantId, createDto);
      expect(mockLoyaltyRewardsRedemtionsService.findAll).toHaveBeenCalledWith(query, merchantId);
      expect(mockLoyaltyRewardsRedemtionsService.findOne).toHaveBeenCalledWith(id, merchantId);
      expect(mockLoyaltyRewardsRedemtionsService.update).toHaveBeenCalledWith(id, merchantId, updateDto);
      expect(mockLoyaltyRewardsRedemtionsService.remove).toHaveBeenCalledWith(id, merchantId);
    });
  });
});
