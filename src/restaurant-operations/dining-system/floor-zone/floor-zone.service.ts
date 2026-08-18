//src/restaurant-operations/dining-system/floor-zone/floor-zone.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FloorZone } from './entity/floor-zone.entity';
import { In, Repository } from 'typeorm';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { FloorPlan } from '../floor-plan/entity/floor-plan.entity';
import { CreateFloorZoneDto } from './dto/create-floor-zone.dto';
import { OneFloorZoneResponseDto } from './dto/floor-zone-response.dto';
import { ErrorHandler } from 'src/common/utils/error-handler.util';
import { QueryFloorZoneDto } from './dto/query-floor-zone.dto';
import { PaginatedFloorZoneResponseDto } from './dto/paginated-floor-zone-response.dto';
import { UpdateFloorPlanDto } from '../floor-plan/dto/update-floor-plan.dto';

@Injectable()
export class FloorZoneService {
  constructor(
    @InjectRepository(FloorZone)
    private readonly floorZoneRepository: Repository<FloorZone>,

    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,

    @InjectRepository(FloorPlan)
    private readonly floorPlanRepository: Repository<FloorPlan>,
  ) {}

  async create(dto: CreateFloorZoneDto): Promise<OneFloorZoneResponseDto> {
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

    let floorPlan: FloorPlan | null = null;
    if (dto.floorPlan) {
      floorPlan = await this.floorPlanRepository.findOne({
        where: { id: dto.floorPlan },
      });
      if (!floorPlan) {
        ErrorHandler.notFound('Floor Plan not found');
      }
    }

    const floorZone = this.floorZoneRepository.create({
      name: dto.name,
      color: dto.color,
      area: dto.area ?? null,
      status: dto.status,
      merchant: merchant,
      floorPlan: floorPlan,
    } as Partial<FloorZone>);

    const savedFloorZone = await this.floorZoneRepository.save(floorZone);

    return {
      statusCode: 201,
      message: 'Floor Zone created successfully',
      data: savedFloorZone,
    };
  }

  async findAll(
    query: QueryFloorZoneDto,
  ): Promise<PaginatedFloorZoneResponseDto> {
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

    const qb = this.floorZoneRepository
      .createQueryBuilder('floorZone')
      .leftJoin('floorZone.merchant', 'merchant')
      .leftJoin('floorZone.floorPlan', 'floorPlan')
      .select([
        'floorZone',
        'merchant.id',
        'merchant.name',
        'floorPlan.id',
        'floorPlan.name',
      ]);
    if (status) {
      qb.andWhere('floorZone.status = :status', { status });
    } else {
      qb.andWhere('floorZone.status IN (:...statuses)', {
        statuses: ['active', 'inactive', 'draft', 'archived'],
      });
    }

    qb.andWhere('floorZone.status != :deleted', {
      deleted: 'deleted',
    });

    qb.orderBy(`floorZone.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      statusCode: 200,
      message: 'Floor Zones retrieved successfully',
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<OneFloorZoneResponseDto> {
    if (!Number.isInteger(id) || id < 1) {
      ErrorHandler.invalidId('ID must be a positive integer');
    }

    const floorZone = await this.floorZoneRepository.findOne({
      // Incluye la tríada de la UI: una zona en draft/archived también debe poder editarse.
      where: { id, status: In(['active', 'inactive', 'draft', 'archived']) },
      relations: ['merchant', 'floorPlan'],
    });
    if (!floorZone) {
      ErrorHandler.floorZoneNotFound();
    }
    return {
      statusCode: 200,
      message: 'Floor Zone retrieved successfully',
      data: floorZone,
    };
  }

  async update(
    id: number,
    dto: UpdateFloorPlanDto,
  ): Promise<OneFloorZoneResponseDto> {
    if (!Number.isInteger(id) || id <= 0) {
      ErrorHandler.invalidId('ID must be a positive integer');
    }
    const floorZone = await this.floorZoneRepository.findOne({
      where: { id, status: In(['active', 'inactive']) },
      relations: ['merchant', 'floorPlan'],
    });
    if (!floorZone) {
      ErrorHandler.floorZoneNotFound();
    }

    Object.assign(floorZone, dto);

    const updatedFloorZone = await this.floorZoneRepository.save(floorZone);
    return {
      statusCode: 200,
      message: 'Floor Zone updated successfully',
      data: updatedFloorZone,
    };
  }

  async remove(id: number): Promise<OneFloorZoneResponseDto> {
    if (!Number.isInteger(id) || id <= 0) {
      ErrorHandler.invalidId('ID must be a positive integer');
    }

    const floorZone = await this.floorZoneRepository.findOne({
      where: { id },
    });
    if (!floorZone) {
      ErrorHandler.floorZoneNotFound();
    }

    floorZone.status = 'deleted';
    const deletedFloorZone = await this.floorZoneRepository.save(floorZone);
    return {
      statusCode: 200,
      message: 'Floor Zone deleted successfully',
      data: deletedFloorZone,
    };
  }
}
