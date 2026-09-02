import { Test, TestingModule } from '@nestjs/testing';
import { Request as ExpressRequest } from 'express';
import { TipPoolMembersController } from './tip-pool-members.controller';
import { TipPoolMembersService } from './tip-pool-members.service';
import { CreateTipPoolMemberDto } from './dto/create-tip-pool-member.dto';

import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

describe('TipPoolMembersController', () => {
  let controller: TipPoolMembersController;
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
      controllers: [TipPoolMembersController],
      providers: [{ provide: TipPoolMembersService, useValue: mockService }],
    }).compile();
    controller = module.get<TipPoolMembersController>(TipPoolMembersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => expect(controller).toBeDefined());

  it('create', async () => {
    const dto: CreateTipPoolMemberDto = {
      tipPoolId: 1,
      collaboratorId: 1,
      role: 'waiter',
      weight: 10,
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
    await controller.update(1, { weight: 20 }, mockUser);
    expect(mockService.update).toHaveBeenCalledWith(1, { weight: 20 }, 1);
  });

  it('remove', async () => {
    mockService.remove.mockResolvedValue({ data: {} });
    await controller.remove(1, mockUser);
    expect(mockService.remove).toHaveBeenCalledWith(1, 1);
  });
});
