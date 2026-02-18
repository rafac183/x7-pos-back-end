/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyRewardsRedemtionsService } from './loyalty-rewards-redemtions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoyaltyRewardsRedemtion } from './entities/loyalty-rewards-redemtion.entity';
import { LoyaltyCustomer } from '../loyalty-customer/entities/loyalty-customer.entity';
import { LoyaltyReward } from '../loyalty-reward/entities/loyalty-reward.entity';
import { Order } from '../../orders/entities/order.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateLoyaltyRewardsRedemtionDto } from './dto/create-loyalty-rewards-redemtion.dto';
import { ErrorMessage } from '../../common/constants/error-messages';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyPointsSource } from '../loyalty-points-transaction/constants/loyalty-points-source.enum';

describe('LoyaltyRewardsRedemtionsService', () => {
  let service: LoyaltyRewardsRedemtionsService;
  let loyaltyRewardsRedemtionRepo: jest.Mocked<Repository<LoyaltyRewardsRedemtion>>;
  let loyaltyCustomerRepo: jest.Mocked<Repository<LoyaltyCustomer>>;
  let loyaltyRewardRepo: jest.Mocked<Repository<LoyaltyReward>>;
  let orderRepo: jest.Mocked<Repository<Order>>;
  let dataSource: jest.Mocked<DataSource>;

  // Mock Factories
  const getMockLoyaltyCustomer = () => ({
    id: 1,
    currentPoints: 100,
    lifetimePoints: 500,
  });

  const getMockReward = () => ({
    id: 1,
    name: 'Test Reward',
    costPoints: 50,
    description: 'Test Desc',
  });

  const getMockOrder = () => ({
    id: 101,
    status: 'completed',
    total_amount: 200,
    created_at: new Date(),
  });

  const getMockRedemption = () => ({
    id: 1,
    loyaltyCustomer: getMockLoyaltyCustomer(),
    reward: getMockReward(),
    order: getMockOrder(),
    redeemedPoints: 50,
    redeemedAt: new Date(),
    loyaltyCustomerId: 1,
  });

  const getMockQueryBuilder = () => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  });

  let mockQueryBuilder: ReturnType<typeof getMockQueryBuilder>;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryBuilder = getMockQueryBuilder();

    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn(),
        save: jest.fn(),
        remove: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyRewardsRedemtionsService,
        {
          provide: getRepositoryToken(LoyaltyRewardsRedemtion),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(LoyaltyCustomer),
          useValue: {
            findOneBy: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LoyaltyReward),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<LoyaltyRewardsRedemtionsService>(LoyaltyRewardsRedemtionsService);
    loyaltyRewardsRedemtionRepo = module.get(getRepositoryToken(LoyaltyRewardsRedemtion));
    loyaltyCustomerRepo = module.get(getRepositoryToken(LoyaltyCustomer));
    loyaltyRewardRepo = module.get(getRepositoryToken(LoyaltyReward));
    orderRepo = module.get(getRepositoryToken(Order));
    dataSource = module.get(DataSource);

    jest.clearAllMocks();
    loyaltyRewardsRedemtionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateLoyaltyRewardsRedemtionDto = {
      loyalty_customer_id: 1,
      reward_id: 1,
      order_id: 101,
      redeemed_points: 50,
    };

    it('should create a redemption successfully', async () => {
      const customer = getMockLoyaltyCustomer();
      const reward = getMockReward();
      const order = getMockOrder();
      const newRedemption = { id: 1, ...createDto };

      loyaltyCustomerRepo.findOneBy.mockResolvedValue(customer as any);
      loyaltyRewardRepo.findOneBy.mockResolvedValue(reward as any);
      orderRepo.findOneBy.mockResolvedValue(order as any);

      mockQueryRunner.manager.create.mockReturnValue(newRedemption);
      mockQueryRunner.manager.save.mockResolvedValue(newRedemption);

      // Mock findOne for return
      jest.spyOn(service, 'findOne').mockResolvedValue({
        statusCode: 201,
        message: 'Redemption Created successfully',
        data: {} as any,
      });

      const result = await service.create(createDto);

      expect(result.statusCode).toBe(201);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      // Verify points deduction
      expect(customer.currentPoints).toBe(50); // 100 - 50
    });

    it('should throw NotFoundException if customer not found', async () => {
      loyaltyCustomerRepo.findOneBy.mockResolvedValue(null);
      await expect(service.create(createDto)).rejects.toThrow(ErrorMessage.LOYALTY_CUSTOMER_NOT_FOUND);
    });

    it('should throw BadRequestException if insufficient points', async () => {
      const customer = getMockLoyaltyCustomer();
      customer.currentPoints = 10; // Less than 50
      loyaltyCustomerRepo.findOneBy.mockResolvedValue(customer as any);

      await expect(service.create(createDto)).rejects.toThrow('Insufficient loyalty points');
    });

    it('should throw NotFoundException if reward not found', async () => {
      loyaltyCustomerRepo.findOneBy.mockResolvedValue(getMockLoyaltyCustomer() as any);
      loyaltyRewardRepo.findOneBy.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(ErrorMessage.LOYALTY_REWARD_NOT_FOUND);
    });

    it('should throw NotFoundException if order not found', async () => {
      loyaltyCustomerRepo.findOneBy.mockResolvedValue(getMockLoyaltyCustomer() as any);
      loyaltyRewardRepo.findOneBy.mockResolvedValue(getMockReward() as any);
      orderRepo.findOneBy.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(ErrorMessage.ORDER_NOT_FOUND);
    });

    it('should rollback transaction on error', async () => {
      loyaltyCustomerRepo.findOneBy.mockResolvedValue(getMockLoyaltyCustomer() as any);
      loyaltyRewardRepo.findOneBy.mockResolvedValue(getMockReward() as any);
      orderRepo.findOneBy.mockResolvedValue(getMockOrder() as any);

      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB Error'));

      await expect(service.create(createDto)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated redemptions', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([getMockRedemption()]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.statusCode).toBe(200);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by points range', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([getMockRedemption()]);

      await service.findAll({ min_redeemed_points: 10, max_redeemed_points: 100 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('findOne', () => {
    it('should return a redemption successfully', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(getMockRedemption());

      const result = await service.findOne(1);

      expect(result.statusCode).toBe(200);
      expect(result.data.id).toBe(1);
    });

    it('should throw invalidId error for id <= 0', async () => {
      await expect(service.findOne(0)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if redemption not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(ErrorMessage.LOYALTY_REWARDS_REDEMPTION_NOT_FOUND);
    });
  });

  describe('update', () => {
    const updateDto = { redeemed_points: 60 };

    it('should update redemption successfully', async () => {
      const redemption = getMockRedemption();
      loyaltyRewardsRedemtionRepo.findOne.mockResolvedValue(redemption as any);
      loyaltyRewardsRedemtionRepo.save.mockResolvedValue(redemption as any);

      jest.spyOn(service, 'findOne').mockResolvedValue({
        statusCode: 200,
        message: 'Redemption Updated successfully',
        data: {} as any,
      });

      const result = await service.update(1, updateDto);

      expect(result.statusCode).toBe(200);
      expect(loyaltyRewardsRedemtionRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if updated reward not found', async () => {
      const redemption = getMockRedemption();
      const updateDtoWithReward = { reward_id: 999 };
      loyaltyRewardsRedemtionRepo.findOne.mockResolvedValue(redemption as any);
      loyaltyRewardRepo.findOneBy.mockResolvedValue(null);

      await expect(service.update(1, updateDtoWithReward)).rejects.toThrow(ErrorMessage.LOYALTY_REWARD_NOT_FOUND);
    });

    it('should throw NotFoundException if updated order not found', async () => {
      const redemption = getMockRedemption();
      const updateDtoWithOrder = { order_id: 999 };
      loyaltyRewardsRedemtionRepo.findOne.mockResolvedValue(redemption as any);
      orderRepo.findOneBy.mockResolvedValue(null);

      await expect(service.update(1, updateDtoWithOrder)).rejects.toThrow(ErrorMessage.ORDER_NOT_FOUND);
    });

    it('should throw NotFoundException if redemption not found', async () => {
      loyaltyRewardsRedemtionRepo.findOne.mockResolvedValue(null);
      await expect(service.update(1, updateDto)).rejects.toThrow(ErrorMessage.LOYALTY_REWARDS_REDEMPTION_NOT_FOUND);
    });
  });

  describe('remove', () => {
    it('should remove redemption and refund points', async () => {
      const redemption = getMockRedemption();
      const customer = getMockLoyaltyCustomer();

      loyaltyRewardsRedemtionRepo.findOne.mockResolvedValue(redemption as any);
      loyaltyCustomerRepo.findOneBy.mockResolvedValue(customer as any);

      const result = await service.remove(1);

      expect(result.statusCode).toBe(200);
      expect(customer.currentPoints).toBe(150); // 100 + 50 (refund)
      expect(mockQueryRunner.manager.remove).toHaveBeenCalledWith(redemption);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if redemption not found', async () => {
      loyaltyRewardsRedemtionRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toThrow(ErrorMessage.LOYALTY_REWARDS_REDEMPTION_NOT_FOUND);
    });

    it('should rollback on error during remove', async () => {
      const redemption = getMockRedemption();
      loyaltyRewardsRedemtionRepo.findOne.mockResolvedValue(redemption as any);
      mockQueryRunner.manager.remove.mockRejectedValue(new Error('DB Error'));

      await expect(service.remove(1)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
