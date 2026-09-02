import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  type FindOptionsOrder,
  type FindOptionsWhere,
} from 'typeorm';
// Se importa desde la raíz del paquete: el `exports` de typeorm no publica la ruta
// profunda `typeorm/query-builder/QueryPartialEntity`, así que tsc la resolvía pero jest no.
import type { QueryDeepPartialEntity } from 'typeorm';
import { KitchenStation } from './entities/kitchen-station.entity';
import { Merchant } from '../../../platform-saas/merchants/entities/merchant.entity';
import { CreateKitchenStationDto } from './dto/create-kitchen-station.dto';
import { UpdateKitchenStationDto } from './dto/update-kitchen-station.dto';
import {
  GetKitchenStationQueryDto,
  KitchenStationSortBy,
} from './dto/get-kitchen-station-query.dto';
import {
  KitchenStationResponseDto,
  OneKitchenStationResponseDto,
} from './dto/kitchen-station-response.dto';
import { PaginatedKitchenStationResponseDto } from './dto/paginated-kitchen-station-response.dto';
import { KitchenStationStatus } from './constants/kitchen-station-status.enum';
import { KitchenStationType } from './constants/kitchen-station-type.enum';
import { KitchenDisplayMode } from './constants/kitchen-display-mode.enum';

@Injectable()
export class KitchenStationService {
  constructor(
    @InjectRepository(KitchenStation)
    private readonly kitchenStationRepository: Repository<KitchenStation>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {}

  async create(
    createKitchenStationDto: CreateKitchenStationDto,
    authenticatedUserMerchantId: number,
  ): Promise<OneKitchenStationResponseDto> {
    // Validate user permissions - must be associated with a merchant
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to create kitchen stations',
      );
    }

    // Validate merchant exists
    const merchant = await this.merchantRepository.findOne({
      where: { id: authenticatedUserMerchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    // Business rule validation: name must not be empty
    const trimmedName = createKitchenStationDto.name ? createKitchenStationDto.name.trim() : '';
    if (!trimmedName) {
      throw new BadRequestException('Name cannot be empty');
    }

    if (trimmedName.length > 100) {
      throw new BadRequestException('Name cannot exceed 100 characters');
    }

    // Unique Name Constraint per Merchant
    const duplicate = await this.kitchenStationRepository
      .createQueryBuilder('ks')
      .where('ks.merchant_id = :merchantId', { merchantId: authenticatedUserMerchantId })
      .andWhere('LOWER(ks.name) = LOWER(:name)', { name: trimmedName })
      .andWhere('ks.status = :status', { status: KitchenStationStatus.ACTIVE })
      .getOne();

    if (duplicate) {
      throw new ConflictException(
        `A station named '${trimmedName}' already exists for this store.`,
      );
    }

    // Business rule validation: display order must be non-negative
    const targetOrder = createKitchenStationDto.displayOrder ?? 1;
    if (targetOrder < 0) {
      throw new BadRequestException('Display order must be non-negative');
    }

    // Automatic Display Order Re-Sequencing: shift existing order >= targetOrder
    await this.kitchenStationRepository
      .createQueryBuilder()
      .update(KitchenStation)
      .set({ display_order: () => 'display_order + 1' })
      .where('merchant_id = :merchantId', { merchantId: authenticatedUserMerchantId })
      .andWhere('display_order >= :targetOrder', { targetOrder })
      .andWhere('status = :status', { status: KitchenStationStatus.ACTIVE })
      .execute();

    // Create kitchen station
    const kitchenStation = new KitchenStation();
    kitchenStation.merchant_id = authenticatedUserMerchantId;
    kitchenStation.name = trimmedName;
    kitchenStation.station_type = createKitchenStationDto.stationType;
    kitchenStation.display_mode = createKitchenStationDto.displayMode;
    kitchenStation.display_order = targetOrder;
    kitchenStation.printer_name = createKitchenStationDto.printerName || null;
    kitchenStation.is_active = true; // Always set to true on creation
    kitchenStation.status = KitchenStationStatus.ACTIVE;

    const savedKitchenStation =
      await this.kitchenStationRepository.save(kitchenStation);

    // Re-sequence all active stations for this merchant to maintain a clean gapless 1..N order
    await this.resequenceStations(authenticatedUserMerchantId);

    // Fetch the complete kitchen station with relations
    const completeKitchenStation = await this.kitchenStationRepository.findOne({
      where: { id: savedKitchenStation.id },
      relations: ['merchant'],
    });

    if (!completeKitchenStation) {
      throw new NotFoundException('Kitchen station not found after creation');
    }

    return {
      statusCode: 201,
      message: 'Kitchen station created successfully',
      data: this.formatKitchenStationResponse(completeKitchenStation),
    };
  }

  async findAll(
    query: GetKitchenStationQueryDto,
    authenticatedUserMerchantId: number,
  ): Promise<PaginatedKitchenStationResponseDto> {
    // Validate user has merchant
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to access kitchen stations',
      );
    }

    // Validate pagination parameters
    if (query.page && query.page < 1) {
      throw new BadRequestException('Page number must be greater than 0');
    }

    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    // Validate date format if provided
    if (query.createdDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(query.createdDate)) {
        throw new BadRequestException(
          'Created date must be in YYYY-MM-DD format',
        );
      }
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Build where conditions
    const whereConditions: FindOptionsWhere<KitchenStation> = {
      merchant_id: authenticatedUserMerchantId,
      status: query.status || KitchenStationStatus.ACTIVE,
    };

    if (query.stationType) {
      whereConditions.station_type = query.stationType;
    }

    if (query.displayMode) {
      whereConditions.display_mode = query.displayMode;
    }

    if (query.isActive !== undefined) {
      whereConditions.is_active = query.isActive;
    }

    if (query.createdDate) {
      const startDate = new Date(query.createdDate);
      const endDate = new Date(query.createdDate);
      endDate.setDate(endDate.getDate() + 1);
      whereConditions.created_at = Between(startDate, endDate);
    }

    // Build order conditions
    const sortDir = query.sortOrder || 'DESC';
    let orderConditions: FindOptionsOrder<KitchenStation>;
    if (query.sortBy) {
      switch (query.sortBy) {
        case KitchenStationSortBy.NAME:
          orderConditions = { name: sortDir };
          break;
        case KitchenStationSortBy.DISPLAY_ORDER:
          orderConditions = { display_order: sortDir };
          break;
        case KitchenStationSortBy.CREATED_AT:
          orderConditions = { created_at: sortDir };
          break;
        case KitchenStationSortBy.UPDATED_AT:
          orderConditions = { updated_at: sortDir };
          break;
        default:
          orderConditions = { id: sortDir };
      }
    } else {
      orderConditions = { display_order: 'ASC', created_at: 'DESC' };
    }

    // Execute query
    let [kitchenStations, total] =
      await this.kitchenStationRepository.findAndCount({
        where: whereConditions,
        relations: ['merchant'],
        order: orderConditions,
        skip,
        take: limit,
      });



    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const paginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    };

    return {
      statusCode: 200,
      message: 'Kitchen stations retrieved successfully',
      data: kitchenStations.map((station) =>
        this.formatKitchenStationResponse(station),
      ),
      paginationMeta,
    };
  }

  async findOne(
    id: number,
    authenticatedUserMerchantId: number,
  ): Promise<OneKitchenStationResponseDto> {
    // Validate ID
    if (!id || id <= 0) {
      throw new BadRequestException(
        'Kitchen station ID must be a valid positive number',
      );
    }

    // Validate user has merchant
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to access kitchen stations',
      );
    }

    // Find kitchen station
    const kitchenStation = await this.kitchenStationRepository.findOne({
      where: {
        id,
        merchant_id: authenticatedUserMerchantId,
        status: KitchenStationStatus.ACTIVE,
      },
      relations: ['merchant'],
    });

    if (!kitchenStation) {
      throw new NotFoundException('Kitchen station not found');
    }

    return {
      statusCode: 200,
      message: 'Kitchen station retrieved successfully',
      data: this.formatKitchenStationResponse(kitchenStation),
    };
  }

  async update(
    id: number,
    updateKitchenStationDto: UpdateKitchenStationDto,
    authenticatedUserMerchantId: number,
  ): Promise<OneKitchenStationResponseDto> {
    // Validate ID
    if (!id || id <= 0) {
      throw new BadRequestException(
        'Kitchen station ID must be a valid positive number',
      );
    }

    // Validate user has merchant
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to update kitchen stations',
      );
    }

    // Find existing kitchen station
    const existingKitchenStation = await this.kitchenStationRepository.findOne({
      where: {
        id,
        merchant_id: authenticatedUserMerchantId,
        status: KitchenStationStatus.ACTIVE,
      },
      relations: ['merchant'],
    });

    if (!existingKitchenStation) {
      throw new NotFoundException('Kitchen station not found');
    }

    // Business rule validation: name must not be empty if provided
    if (updateKitchenStationDto.name !== undefined) {
      const trimmedName = updateKitchenStationDto.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Name cannot be empty');
      }
      if (trimmedName.length > 100) {
        throw new BadRequestException('Name cannot exceed 100 characters');
      }

      // Check unique name per merchant
      const duplicate = await this.kitchenStationRepository
        .createQueryBuilder('ks')
        .where('ks.merchant_id = :merchantId', { merchantId: authenticatedUserMerchantId })
        .andWhere('LOWER(ks.name) = LOWER(:name)', { name: trimmedName })
        .andWhere('ks.status = :status', { status: KitchenStationStatus.ACTIVE })
        .andWhere('ks.id != :id', { id })
        .getOne();

      if (duplicate) {
        throw new ConflictException(
          `A station named '${trimmedName}' already exists for this store.`,
        );
      }
    }

    // Business rule validation: display order must be non-negative if provided
    if (updateKitchenStationDto.displayOrder !== undefined) {
      const targetOrder = updateKitchenStationDto.displayOrder;
      if (targetOrder < 0) {
        throw new BadRequestException('Display order must be non-negative');
      }
      if (targetOrder !== existingKitchenStation.display_order) {
        await this.kitchenStationRepository
          .createQueryBuilder()
          .update(KitchenStation)
          .set({ display_order: () => 'display_order + 1' })
          .where('merchant_id = :merchantId', { merchantId: authenticatedUserMerchantId })
          .andWhere('display_order >= :targetOrder', { targetOrder })
          .andWhere('id != :id', { id })
          .andWhere('status = :status', { status: KitchenStationStatus.ACTIVE })
          .execute();
      }
    }

    // Update kitchen station
    const updateData: QueryDeepPartialEntity<KitchenStation> = {};
    if (updateKitchenStationDto.name !== undefined)
      updateData.name = updateKitchenStationDto.name.trim();
    if (updateKitchenStationDto.stationType !== undefined)
      updateData.station_type = updateKitchenStationDto.stationType;
    if (updateKitchenStationDto.displayMode !== undefined)
      updateData.display_mode = updateKitchenStationDto.displayMode;
    if (updateKitchenStationDto.displayOrder !== undefined)
      updateData.display_order = updateKitchenStationDto.displayOrder;
    if (updateKitchenStationDto.printerName !== undefined)
      updateData.printer_name = updateKitchenStationDto.printerName || null;
    if (updateKitchenStationDto.isActive !== undefined)
      updateData.is_active = updateKitchenStationDto.isActive;

    if (updateKitchenStationDto.status !== undefined) {
      updateData.status = updateKitchenStationDto.status;
      if (updateKitchenStationDto.status === KitchenStationStatus.DELETED) {
        updateData.is_active = false;
      }
    }

    await this.kitchenStationRepository.update(id, updateData);

    // Re-sequence all active stations for this merchant to maintain a clean gapless 1..N order
    await this.resequenceStations(authenticatedUserMerchantId);

    // Fetch updated kitchen station
    const updatedKitchenStation = await this.kitchenStationRepository.findOne({
      where: { id },
      relations: ['merchant'],
    });

    if (!updatedKitchenStation) {
      throw new NotFoundException('Kitchen station not found after update');
    }

    return {
      statusCode: 200,
      message: 'Kitchen station updated successfully',
      data: this.formatKitchenStationResponse(updatedKitchenStation),
    };
  }

  async remove(
    id: number,
    authenticatedUserMerchantId: number,
  ): Promise<OneKitchenStationResponseDto> {
    // Validate ID
    if (!id || id <= 0) {
      throw new BadRequestException(
        'Kitchen station ID must be a valid positive number',
      );
    }

    // Validate user has merchant
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to delete kitchen stations',
      );
    }

    // Find existing kitchen station
    const existingKitchenStation = await this.kitchenStationRepository.findOne({
      where: {
        id,
        merchant_id: authenticatedUserMerchantId,
        status: KitchenStationStatus.ACTIVE,
      },
      relations: ['merchant'],
    });

    if (!existingKitchenStation) {
      throw new NotFoundException('Kitchen station not found');
    }

    // Check if already deleted
    if (existingKitchenStation.status === KitchenStationStatus.DELETED) {
      throw new ConflictException('Kitchen station is already deleted');
    }

    // Perform logical deletion
    existingKitchenStation.status = KitchenStationStatus.DELETED;
    existingKitchenStation.is_active = false;
    await this.kitchenStationRepository.save(existingKitchenStation);

    // Re-sequence remaining active stations
    await this.resequenceStations(authenticatedUserMerchantId);

    return {
      statusCode: 200,
      message: 'Kitchen station deleted successfully',
      data: this.formatKitchenStationResponse(existingKitchenStation),
    };
  }

  private async resequenceStations(merchantId: number): Promise<void> {
    const stations = await this.kitchenStationRepository.find({
      where: {
        merchant_id: merchantId,
        status: KitchenStationStatus.ACTIVE,
      },
      order: {
        display_order: 'ASC',
        updated_at: 'DESC',
        id: 'ASC',
      },
    });

    for (let i = 0; i < stations.length; i++) {
      const expectedOrder = i + 1;
      if (stations[i].display_order !== expectedOrder) {
        await this.kitchenStationRepository.update(stations[i].id, {
          display_order: expectedOrder,
        });
      }
    }
  }

  private formatKitchenStationResponse(
    kitchenStation: KitchenStation,
  ): KitchenStationResponseDto {
    return {
      id: kitchenStation.id,
      merchantId: kitchenStation.merchant_id,
      merchant: {
        id: kitchenStation.merchant.id,
        name: kitchenStation.merchant.name,
      },
      name: kitchenStation.name,
      stationType: kitchenStation.station_type,
      displayMode: kitchenStation.display_mode,
      displayOrder: kitchenStation.display_order,
      printerName: kitchenStation.printer_name,
      isActive: kitchenStation.is_active,
      status: kitchenStation.status,
      createdAt: kitchenStation.created_at,
      updatedAt: kitchenStation.updated_at,
    };
  }
}
