import { Test, TestingModule } from '@nestjs/testing';
import { Request as ExpressRequest } from 'express';
import { TipPoolsController } from './tip-pools.controller';
import { TipPoolsService } from './tip-pools.service';
import { CreateTipPoolDto } from './dto/create-tip-pool.dto';
import { TipPoolDistributionType } from './constants/tip-pool-distribution-type.enum';
import { TipPoolStatus } from './constants/tip-pool-status.enum';

import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

describe('TipPoolsController', () => {
  let controller: TipPoolsController;
  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const mockUserPayload: AuthenticatedUser = {
    id: 1,
    email: 'test@example.com',
    role: UserRole.MERCHANT_ADMIN,
    scope: Scope.MERCHANT_WEB,
    merchant: { id: 1 },
  };

  /**
   * Forma REAL del request: Passport cuelga el usuario en `req.user`.
   * Pasar el usuario pelado hacía que el spec verificara un contrato que
   * producción no cumple, y por eso el 403 del módulo pasó desapercibido.
   */
  const mockUser = { user: mockUserPayload } as unknown as ExpressRequest & {
    user?: AuthenticatedUser;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TipPoolsController],
      providers: [{ provide: TipPoolsService, useValue: mockService }],
    }).compile();
    controller = module.get<TipPoolsController>(TipPoolsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => expect(controller).toBeDefined());

  it('create', async () => {
    const dto: CreateTipPoolDto = {
      companyId: 1,
      merchantId: 1,
      shiftId: 1,
      name: 'Pool',
      distributionType: TipPoolDistributionType.EQUAL,
      status: TipPoolStatus.OPEN,
    };
    mockService.create.mockResolvedValue({ statusCode: 201, data: {} });
    await controller.create(dto, mockUser);
    expect(mockService.create).toHaveBeenCalledWith(dto, 1);
  });

  it('findAll', async () => {
    mockService.findAll.mockResolvedValue({ data: [], paginationMeta: {} });
    await controller.findAll({}, mockUser);
    expect(mockService.findAll).toHaveBeenCalledWith({}, 1);
  });

  it('findOne', async () => {
    mockService.findOne.mockResolvedValue({ data: { id: 1 } });
    await controller.findOne(1, mockUser);
    expect(mockService.findOne).toHaveBeenCalledWith(1, 1);
  });

  it('update', async () => {
    mockService.update.mockResolvedValue({ data: {} });
    await controller.update(1, { name: 'Updated' }, mockUser);
    expect(mockService.update).toHaveBeenCalledWith(1, { name: 'Updated' }, 1);
  });

  it('remove', async () => {
    mockService.remove.mockResolvedValue({ data: {} });
    await controller.remove(1, mockUser);
    expect(mockService.remove).toHaveBeenCalledWith(1, 1);
  });
});
