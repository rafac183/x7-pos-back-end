//src/restaurant-operations/dining-system/floor-plan/floor-plan.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FloorPlan } from '../floor-plan/entity/floor-plan.entity';
import { In, Repository } from 'typeorm';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { CreateFloorPlanDto } from './dto/create-floor-plan.dto';
import { OneFloorPlanResponseDto } from './dto/floor-plan-response.dto';
import { ErrorHandler } from 'src/common/utils/error-handler.util';
import { QueryFloorPlanDto } from './dto/query-floor-plan.dto';
import { PaginatedFloorPlanResponseDto } from './dto/paginated-floor-plan-response.dto';
import { UpdateFloorPlanDto } from './dto/update-floor-plan.dto';

// Los DTOs ya aceptan el vocabulario del backoffice ('draft' | 'archived') además del legacy
// ('active' | 'inactive'); si las consultas siguieran filtrando solo por el legacy, un plano
// guardado como borrador o archivado desaparecería del listado y daría 404 al reabrirlo o
// editarlo. 'deleted' queda fuera a propósito: es el soft-delete.
const VISIBLE_STATUSES = ['active', 'inactive', 'draft', 'archived'];

@Injectable()
export class FloorPlanService {
  constructor(
    @InjectRepository(FloorPlan)
    private readonly floorPlanRepository: Repository<FloorPlan>,

    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {}

  async create(dto: CreateFloorPlanDto): Promise<OneFloorPlanResponseDto> {
    if (!Number.isInteger(dto.merchant)) {
      ErrorHandler.invalidId('Merchant ID must be a positive integer');
    }

    let merchant: Merchant | null = null;
    if (dto.merchant) {
      merchant = await this.merchantRepository.findOne({
        where: { id: dto.merchant },
      });
      if (!merchant) {
        ErrorHandler.notFound('Merchant not found');
      }
    }

    const floorPlan = this.floorPlanRepository.create({
      name: dto.name,
      width: dto.width,
      height: dto.height,
      // Normalizamos a null cuando no viene contorno: así el plano queda explícitamente marcado
      // como "rectángulo completo width × height" en vez de dejar la columna en undefined.
      outline: dto.outline ?? null,
      status: dto.status,
      merchant: merchant,
    } as Partial<FloorPlan>);

    const savedFloorPlan = await this.floorPlanRepository.save(floorPlan);

    return {
      statusCode: 201,
      message: 'Floor Plan created successfully',
      data: savedFloorPlan,
    };
  }

  async findAll(
    query: QueryFloorPlanDto,
  ): Promise<PaginatedFloorPlanResponseDto> {
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = 'id',
      sortOrder = 'DESC',
    } = query;

    if (page < 1 || limit < 1) {
      ErrorHandler.invalidInput('Page and limit must be positive integers');
    }

    const qb = this.floorPlanRepository
      .createQueryBuilder('floorPlan')
      .leftJoin('floorPlan.merchant', 'merchant')
      .select(['floorPlan', 'merchant.id', 'merchant.name']);
    if (status) {
      qb.andWhere('floorPlan.status = :status', { status });
    } else {
      qb.andWhere('floorPlan.status IN (:...statuses)', {
        statuses: VISIBLE_STATUSES,
      });
    }

    qb.andWhere('floorPlan.status != :deleted', {
      deleted: 'deleted',
    });

    qb.orderBy(`floorPlan.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      statusCode: 200,
      message: 'Floor Plans retrieved successfully',
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<OneFloorPlanResponseDto> {
    if (!Number.isInteger(id) || id < 1) {
      ErrorHandler.invalidId('ID must be a positive integer');
    }

    const floorPlan = await this.floorPlanRepository.findOne({
      where: { id, status: In(VISIBLE_STATUSES) },
      relations: ['merchant'],
    });
    if (!floorPlan) {
      ErrorHandler.floorPlanNotFound();
    }
    return {
      statusCode: 200,
      message: 'Floor Plan retrieved successfully',
      data: floorPlan,
    };
  }

  async update(
    id: number,
    dto: UpdateFloorPlanDto,
  ): Promise<OneFloorPlanResponseDto> {
    if (!Number.isInteger(id) || id <= 0) {
      ErrorHandler.invalidId('ID must be a positive integer');
    }
    const floorPlan = await this.floorPlanRepository.findOne({
      where: { id, status: In(VISIBLE_STATUSES) },
      relations: ['merchant'],
    });
    if (!floorPlan) {
      ErrorHandler.floorPlanNotFound();
    }

    // El PATCH es parcial: solo se copian las claves presentes en el dto, así que enviar únicamente
    // `outline` conserva width/height. Un `outline: null` explícito sí llega (class-validator deja
    // pasar null con @IsOptional) y devuelve el plano al rectángulo completo.
    Object.assign(floorPlan, dto);

    const updatedFloorPlan = await this.floorPlanRepository.save(floorPlan);
    return {
      statusCode: 200,
      message: 'Floor Plan updated successfully',
      data: updatedFloorPlan,
    };
  }

  async remove(id: number): Promise<OneFloorPlanResponseDto> {
    if (!Number.isInteger(id) || id <= 0) {
      ErrorHandler.invalidId('ID must be a positive integer');
    }

    const floorPlan = await this.floorPlanRepository.findOne({
      where: { id },
    });
    if (!floorPlan) {
      ErrorHandler.floorPlanNotFound();
    }

    floorPlan.status = 'deleted';
    const deletedFloorPlan = await this.floorPlanRepository.save(floorPlan);
    return {
      statusCode: 200,
      message: 'Floor Plan deleted successfully',
      data: deletedFloorPlan,
    };
  }
}
