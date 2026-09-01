import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  IsNull,
} from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Variant } from '../variants/entities/variant.entity';
import { Modifier } from '../modifiers/entities/modifier.entity';
import { ProductRecipe } from './entities/product-recipe.entity';
import { ProductRecipeLine } from './entities/product-recipe-line.entity';
import { RecipeLineType } from './constants/recipe-line-type.enum';
import { RecipeTheoreticalCostService } from './recipe-theoretical-cost.service';
import { UpsertProductRecipeDto } from './dto/upsert-product-recipe.dto';
import { RecipeLineInputDto } from './dto/recipe-line-input.dto';
import { CreateRecipeV1Dto } from './dto/create-recipe-v1.dto';
import { UpdateRecipeV1Dto } from './dto/update-recipe-v1.dto';
import { Supply } from 'src/inventory/supplies/entities/supply.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';

@Injectable()
export class RecipesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly recipeTheoreticalCostService: RecipeTheoreticalCostService,
  ) {}

  async findAllForMerchant(merchantId: number): Promise<ProductRecipe[]> {
    return this.dataSource.manager.find(ProductRecipe, {
      where: { merchantId },
      relations: [
        'finishedProduct',
        'finishedVariant',
        'lines',
        'lines.rawMaterial',
        'lines.supplyProduct',
        'lines.supplyVariant',
        'lines.modifier',
      ],
      order: { id: 'DESC' },
    });
  }

  async findAllForProduct(
    merchantId: number,
    productId: number,
  ): Promise<ProductRecipe[]> {
    await this.assertProductOwned(merchantId, productId);
    return this.dataSource.manager.find(ProductRecipe, {
      where: { merchantId, finishedProductId: productId },
      relations: ['lines', 'lines.modifier'],
      order: { id: 'ASC' },
    });
  }


  async create(
    merchantId: number,
    productId: number,
    dto: UpsertProductRecipeDto,
  ): Promise<ProductRecipe> {
    const finishedVariantId = dto.finishedVariantId ?? null;
    await this.assertProductOwned(merchantId, productId);
    await this.assertNoDuplicateRecipeHeader(
      merchantId,
      productId,
      finishedVariantId,
      null,
    );
    if (finishedVariantId != null) {
      await this.assertVariantBelongsToProduct(
        merchantId,
        productId,
        finishedVariantId,
      );
    }
    this.validateLineSemantics(dto.lines);
    await this.validateSupplyAndModifiers(merchantId, productId, dto.lines);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const recipe = queryRunner.manager.create(ProductRecipe, {
        merchantId,
        finishedProductId: productId,
        finishedVariantId,
        theoreticalCostCached: null,
      });
      const saved = await queryRunner.manager.save(ProductRecipe, recipe);
      await this.replaceLines(queryRunner.manager, saved.id, dto.lines);
      await this.refreshTheoreticalCost(
        queryRunner.manager,
        merchantId,
        saved.id,
      );
      await queryRunner.commitTransaction();
      return this.dataSource.manager.findOneOrFail(ProductRecipe, {
        where: { id: saved.id },
        relations: ['lines', 'lines.modifier'],
      });
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    merchantId: number,
    productId: number,
    recipeId: number,
    dto: UpsertProductRecipeDto,
  ): Promise<ProductRecipe> {
    const finishedVariantId = dto.finishedVariantId ?? null;
    await this.assertProductOwned(merchantId, productId);
    const existing = await this.dataSource.manager.findOne(ProductRecipe, {
      where: {
        id: recipeId,
        merchantId,
        finishedProductId: productId,
      },
    });
    if (!existing) {
      throw new NotFoundException('Recipe not found');
    }
    await this.assertNoDuplicateRecipeHeader(
      merchantId,
      productId,
      finishedVariantId,
      recipeId,
    );
    if (finishedVariantId != null) {
      await this.assertVariantBelongsToProduct(
        merchantId,
        productId,
        finishedVariantId,
      );
    }
    this.validateLineSemantics(dto.lines);
    await this.validateSupplyAndModifiers(merchantId, productId, dto.lines);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      existing.finishedVariantId = finishedVariantId;
      await queryRunner.manager.save(ProductRecipe, existing);
      await this.replaceLines(queryRunner.manager, recipeId, dto.lines);
      await this.refreshTheoreticalCost(
        queryRunner.manager,
        merchantId,
        recipeId,
      );
      await queryRunner.commitTransaction();
      return this.dataSource.manager.findOneOrFail(ProductRecipe, {
        where: { id: recipeId },
        relations: ['lines', 'lines.modifier'],
      });
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(
    merchantId: number,
    productId: number,
    recipeId: number,
  ): Promise<void> {
    await this.assertProductOwned(merchantId, productId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const res = await queryRunner.manager.delete(ProductRecipe, {
        id: recipeId,
        merchantId,
        finishedProductId: productId,
      });
      if (!res.affected) {
        throw new NotFoundException('Recipe not found');
      }
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  private async assertProductOwned(
    merchantId: number,
    productId: number,
  ): Promise<void> {
    const p = await this.dataSource.manager.findOne(Product, {
      where: { id: productId, merchantId },
      select: ['id'],
    });
    if (!p) {
      throw new NotFoundException('Product not found');
    }
  }

  private async assertVariantBelongsToProduct(
    merchantId: number,
    productId: number,
    variantId: number,
  ): Promise<void> {
    const v = await this.dataSource.manager.findOne(Variant, {
      where: { id: variantId, productId },
      relations: ['product'],
    });
    if (!v || v.product.merchantId !== merchantId) {
      throw new BadRequestException(
        'finishedVariantId does not belong to this product',
      );
    }
  }

  private async assertNoDuplicateRecipeHeader(
    merchantId: number,
    productId: number,
    finishedVariantId: number | null,
    excludeRecipeId: number | null,
  ): Promise<void> {
    const where: FindOptionsWhere<ProductRecipe> = {
      merchantId,
      finishedProductId: productId,
      ...(finishedVariantId == null
        ? { finishedVariantId: IsNull() }
        : { finishedVariantId }),
    };
    const dup = await this.dataSource.manager.findOne(ProductRecipe, {
      where,
    });
    if (dup && dup.id !== excludeRecipeId) {
      throw new BadRequestException(
        'A recipe for this product and finished variant already exists',
      );
    }
  }

  private validateLineSemantics(lines: RecipeLineInputDto[]): void {
    for (const line of lines) {
      if (
        line.lineType === RecipeLineType.MODIFIER &&
        (line.modifierId == null || line.modifierId <= 0)
      ) {
        throw new BadRequestException(
          'MODIFIER recipe lines must include modifierId',
        );
      }
    }
  }

  private async validateSupplyAndModifiers(
    merchantId: number,
    finishedProductId: number,
    lines: RecipeLineInputDto[],
  ): Promise<void> {
    const supplyProductIds = [...new Set(lines.map((l) => l.supplyProductId))];
    const supplyProducts =
      supplyProductIds.length > 0
        ? await this.dataSource.manager.find(Product, {
            where: { id: In(supplyProductIds), merchantId },
          })
        : [];
    const supplyById = new Map(supplyProducts.map((p) => [p.id, p]));
    for (const pid of supplyProductIds) {
      if (!supplyById.has(pid)) {
        throw new BadRequestException(
          `Supply product ${pid} is missing or not owned by this merchant`,
        );
      }
    }

    const variantIds = [...new Set(lines.map((l) => l.supplyVariantId))];
    const variants =
      variantIds.length > 0
        ? await this.dataSource.manager.find(Variant, {
            where: { id: In(variantIds) },
            relations: ['product'],
          })
        : [];
    const variantById = new Map(variants.map((v) => [v.id, v]));
    for (const line of lines) {
      const v = variantById.get(line.supplyVariantId);
      if (!v || v.productId !== line.supplyProductId) {
        throw new BadRequestException(
          `supplyVariantId ${line.supplyVariantId} does not match supplyProductId ${line.supplyProductId}`,
        );
      }
      if (v.product.merchantId !== merchantId) {
        throw new BadRequestException(
          `Supply variant ${v.id} is not owned by this merchant`,
        );
      }
    }

    const modifierIds = [
      ...new Set(
        lines
          .map((l) => l.modifierId)
          .filter((id): id is number => id != null && id > 0),
      ),
    ];
    if (modifierIds.length > 0) {
      const mods = await this.dataSource.manager.find(Modifier, {
        where: { id: In(modifierIds) },
        relations: ['product'],
      });
      const modById = new Map(mods.map((m) => [m.id, m]));
      for (const mid of modifierIds) {
        const m = modById.get(mid);
        if (!m || m.productId !== finishedProductId) {
          throw new BadRequestException(
            `modifierId ${mid} must belong to the finished product`,
          );
        }
        if (m.product.merchantId !== merchantId) {
          throw new BadRequestException(
            `Modifier ${mid} is not owned by this merchant`,
          );
        }
      }
    }
  }

  private async replaceLines(
    manager: EntityManager,
    recipeId: number,
    lines: RecipeLineInputDto[],
  ): Promise<void> {
    await manager.delete(ProductRecipeLine, { recipeId });
    if (lines.length === 0) {
      return;
    }
    const entities = lines.map((l) =>
      manager.create(ProductRecipeLine, {
        recipeId,
        lineType: l.lineType,
        modifierId: l.modifierId ?? null,
        supplyProductId: l.supplyProductId,
        supplyVariantId: l.supplyVariantId,
        quantityPerSoldUnit: l.quantityPerSoldUnit,
        quantityUnit: l.quantityUnit,
      }),
    );
    await manager.save(ProductRecipeLine, entities);
  }

  private async refreshTheoreticalCost(
    manager: EntityManager,
    merchantId: number,
    recipeId: number,
  ): Promise<void> {
    const lineRows = await manager.find(ProductRecipeLine, {
      where: { recipeId },
    });
    const cached =
      await this.recipeTheoreticalCostService.computeBaseTheoreticalCostCached(
        manager,
        merchantId,
        lineRows,
      );
    await manager.update(
      ProductRecipe,
      { id: recipeId },
      { theoreticalCostCached: cached },
    );
  }

  // --- V1 RECIPES METHODS ---

  async findRecipeForProduct(
    merchantId: number,
    productId: number,
  ): Promise<ProductRecipe[]> {
    await this.assertProductOwned(merchantId, productId);
    return this.dataSource.manager.find(ProductRecipe, {
      where: { merchantId, finishedProductId: productId },
      relations: ['lines', 'lines.modifier', 'lines.rawMaterial'],
      order: { id: 'ASC' },
    });
  }

  async createRecipeV1(
    merchantId: number,
    dto: CreateRecipeV1Dto,
  ): Promise<ProductRecipe> {
    const finishedVariantId = dto.variantId ?? null;
    await this.assertProductOwned(merchantId, dto.productId);
    await this.assertNoDuplicateRecipeHeader(
      merchantId,
      dto.productId,
      finishedVariantId,
      null,
    );
    if (finishedVariantId != null) {
      await this.assertVariantBelongsToProduct(
        merchantId,
        dto.productId,
        finishedVariantId,
      );
    }
    await this.validateRawMaterials(merchantId, dto.lines);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const recipe = queryRunner.manager.create(ProductRecipe, {
        merchantId,
        finishedProductId: dto.productId,
        finishedVariantId,
        theoreticalCostCached: null,
      });
      const saved = await queryRunner.manager.save(ProductRecipe, recipe);

      // Create lines
      const lineEntities = dto.lines.map((l) =>
        queryRunner.manager.create(ProductRecipeLine, {
          recipeId: saved.id,
          lineType: RecipeLineType.REQUIRED,
          rawMaterialId: l.raw_material_id,
          quantity: l.quantity.toString(),
          unitOfMeasure: l.unit_of_measure,
          quantityPerSoldUnit: l.quantity.toString(), // keep compatibility
        }),
      );
      await queryRunner.manager.save(ProductRecipeLine, lineEntities);

      await this.refreshTheoreticalCost(
        queryRunner.manager,
        merchantId,
        saved.id,
      );
      await queryRunner.commitTransaction();

      return this.dataSource.manager.findOneOrFail(ProductRecipe, {
        where: { id: saved.id },
        relations: ['lines', 'lines.modifier', 'lines.rawMaterial'],
      });
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async updateRecipeV1(
    merchantId: number,
    recipeId: number,
    dto: UpdateRecipeV1Dto,
  ): Promise<ProductRecipe> {
    const existing = await this.dataSource.manager.findOne(ProductRecipe, {
      where: { id: recipeId, merchantId },
    });
    if (!existing) {
      throw new NotFoundException('Recipe not found');
    }

    const finishedVariantId = dto.variantId ?? null;
    await this.assertNoDuplicateRecipeHeader(
      merchantId,
      existing.finishedProductId,
      finishedVariantId,
      recipeId,
    );
    if (finishedVariantId != null) {
      await this.assertVariantBelongsToProduct(
        merchantId,
        existing.finishedProductId,
        finishedVariantId,
      );
    }
    await this.validateRawMaterials(merchantId, dto.lines);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      existing.finishedVariantId = finishedVariantId;
      await queryRunner.manager.save(ProductRecipe, existing);

      // Replace lines
      await queryRunner.manager.delete(ProductRecipeLine, { recipeId });
      const lineEntities = dto.lines.map((l) =>
        queryRunner.manager.create(ProductRecipeLine, {
          recipeId,
          lineType: RecipeLineType.REQUIRED,
          rawMaterialId: l.raw_material_id,
          quantity: l.quantity.toString(),
          unitOfMeasure: l.unit_of_measure,
          quantityPerSoldUnit: l.quantity.toString(), // keep compatibility
        }),
      );
      await queryRunner.manager.save(ProductRecipeLine, lineEntities);

      await this.refreshTheoreticalCost(
        queryRunner.manager,
        merchantId,
        recipeId,
      );
      await queryRunner.commitTransaction();

      return this.dataSource.manager.findOneOrFail(ProductRecipe, {
        where: { id: recipeId },
        relations: ['lines', 'lines.modifier', 'lines.rawMaterial'],
      });
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async removeRecipeOrLine(
    merchantId: number,
    recipeId: number,
    lineItemId?: number,
  ): Promise<void> {
    const recipe = await this.dataSource.manager.findOne(ProductRecipe, {
      where: { id: recipeId, merchantId },
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (lineItemId != null) {
        // Remove specific line item
        const res = await queryRunner.manager.delete(ProductRecipeLine, {
          id: lineItemId,
          recipeId,
        });
        if (!res.affected) {
          throw new NotFoundException('Recipe line item not found');
        }
        await this.refreshTheoreticalCost(
          queryRunner.manager,
          merchantId,
          recipeId,
        );
      } else {
        // Remove entire recipe
        await queryRunner.manager.delete(ProductRecipe, { id: recipeId });
      }
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  private async validateRawMaterials(
    merchantId: number,
    lines: { raw_material_id: number }[],
  ): Promise<void> {
    const merchant = await this.dataSource.manager.findOne(Merchant, {
      where: { id: merchantId },
      select: ['companyId'],
    });
    if (!merchant?.companyId) {
      throw new BadRequestException(
        'Merchant is not associated with a company',
      );
    }
    const companyId = merchant.companyId;
    const rawMaterialIds = [...new Set(lines.map((l) => l.raw_material_id))];

    if (rawMaterialIds.length > 0) {
      const supplies = await this.dataSource.manager.find(Supply, {
        where: { id: In(rawMaterialIds), company_id: companyId, isActive: true },
      });
      if (supplies.length !== rawMaterialIds.length) {
        throw new BadRequestException(
          'One or more raw materials were not found or are inactive for this company',
        );
      }
    }
  }
}
