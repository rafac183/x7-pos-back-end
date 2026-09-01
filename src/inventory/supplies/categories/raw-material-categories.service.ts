import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawMaterialCategory } from './entities/raw-material-category.entity';
import { CreateRawMaterialCategoryDto } from './dto/create-raw-material-category.dto';
import { UpdateRawMaterialCategoryDto } from './dto/update-raw-material-category.dto';
import {
  CategoryStatusFilter,
  FilterRawMaterialCategoryDto,
} from './dto/filter-raw-material-category.dto';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Supply } from '../entities/supply.entity';

@Injectable()
export class RawMaterialCategoriesService {
  constructor(
    @InjectRepository(RawMaterialCategory)
    private readonly categoryRepo: Repository<RawMaterialCategory>,
    @InjectRepository(Supply)
    private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
  ) {}

  async getCompanyIdByMerchantId(merchantId: number): Promise<number> {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
      select: ['companyId'],
    });
    if (!merchant?.companyId) {
      throw new BadRequestException(
        'Merchant is not associated with a company',
      );
    }
    return merchant.companyId;
  }

  async create(
    merchantId: number,
    dto: CreateRawMaterialCategoryDto,
  ): Promise<RawMaterialCategory> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);

    const existing = await this.categoryRepo.findOne({
      where: { company_id: companyId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        'Raw material category name already exists for this company',
      );
    }

    const category = this.categoryRepo.create({
      company_id: companyId,
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.is_active ?? true,
    } as Partial<RawMaterialCategory>);

    return await this.categoryRepo.save(category);
  }

  async findAll(
    merchantId: number,
    filter: FilterRawMaterialCategoryDto,
  ): Promise<RawMaterialCategory[]> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);

    const qb = this.categoryRepo
      .createQueryBuilder('cat')
      .where('cat.company_id = :companyId', { companyId });

    if (filter.status === CategoryStatusFilter.ACTIVE) {
      qb.andWhere('cat.isActive = :isActive', { isActive: true });
    } else if (filter.status === CategoryStatusFilter.INACTIVE) {
      qb.andWhere('cat.isActive = :isActive', { isActive: false });
    }

    if (filter.search && filter.search.trim() !== '') {
      const searchTerm = `%${filter.search.trim().toLowerCase()}%`;
      qb.andWhere('LOWER(cat.name) LIKE :search', { search: searchTerm });
    }

    qb.orderBy('cat.name', 'ASC');

    return await qb.getMany();
  }

  async findOne(merchantId: number, id: number): Promise<RawMaterialCategory> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);
    const category = await this.categoryRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!category) {
      throw new NotFoundException('Raw material category not found');
    }
    return category;
  }

  async update(
    merchantId: number,
    id: number,
    dto: UpdateRawMaterialCategoryDto,
  ): Promise<RawMaterialCategory> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);
    const category = await this.categoryRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!category) {
      throw new NotFoundException('Raw material category not found');
    }

    if (dto.name && dto.name !== category.name) {
      const existing = await this.categoryRepo.findOne({
        where: { company_id: companyId, name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Raw material category name already exists for this company',
        );
      }
      category.name = dto.name;
    }

    if (dto.description !== undefined) {
      category.description = dto.description ?? null;
    }

    if (dto.is_active !== undefined) {
      if (dto.is_active === false) {
        const activeSuppliesCount = await this.supplyRepo.count({
          where: { category_id: id, isActive: true },
        });
        if (activeSuppliesCount > 0) {
          throw new BadRequestException(
            'Cannot deactivate raw material category with active raw materials assigned to it',
          );
        }
      }
      category.isActive = dto.is_active;
    }

    return await this.categoryRepo.save(category);
  }

  async remove(
    merchantId: number,
    id: number,
  ): Promise<{ statusCode: 200; message: string }> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);
    const category = await this.categoryRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!category) {
      throw new NotFoundException('Raw material category not found');
    }

    // Check if active raw materials are currently assigned to this category
    const activeSuppliesCount = await this.supplyRepo.count({
      where: { category_id: id, isActive: true },
    });

    if (activeSuppliesCount > 0) {
      throw new BadRequestException(
        'Cannot delete raw material category with active raw materials assigned to it',
      );
    }

    category.isActive = false;
    await this.categoryRepo.save(category);
    return {
      statusCode: 200,
      message: 'Raw material category soft-deleted successfully',
    };
  }
}
