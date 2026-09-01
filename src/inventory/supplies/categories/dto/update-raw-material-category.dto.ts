import { PartialType } from '@nestjs/swagger';
import { CreateRawMaterialCategoryDto } from './create-raw-material-category.dto';

export class UpdateRawMaterialCategoryDto extends PartialType(
  CreateRawMaterialCategoryDto,
) {}
