import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RollsService } from './rolls.service';
import { CreateRollDto } from './dto/create-roll.dto';
import { UpdateRollDto } from './dto/update-roll.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../auth/tenant-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('rolls')
export class RollsController {
  constructor(private readonly rollsService: RollsService) {}

  @Post('ocr')
  @UseInterceptors(FileInterceptor('file'))
  async doOcr(@UploadedFile() file: any) {
    if (!file) {
      return { error: 'Dosya yüklenmedi.' };
    }

    try {
      const formData = new FormData();
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('file', blob, file.originalname);

      const ocrUrl = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8000/ocr';
      const response = await fetch(ocrUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`FastAPI servisi hata döndü: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('NestJS OCR Forwarding Hatası:', err);
      return {
        fabricType: 'Bilinmeyen Kumaş',
        lengthM: 0,
        netWeightKg: 0,
        colorCode: '',
        quality: '1',
        error: err.message,
      };
    }
  }

  @Post()
  create(
    @Body() createRollDto: CreateRollDto,
    @TenantId() tenantId: string,
  ) {
    return this.rollsService.create(createRollDto, tenantId);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('quality') quality?: string,
    @Query('includeRecipe') includeRecipe?: string,
  ) {
    const includeRecipeBool = includeRecipe === 'true';
    return this.rollsService.findAll(
      { page, limit, search, status, quality, includeRecipe: includeRecipeBool },
      tenantId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.rollsService.findOne(id, tenantId);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRollDto: UpdateRollDto,
    @TenantId() tenantId: string,
  ) {
    return this.rollsService.update(id, updateRollDto, tenantId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.rollsService.remove(id, tenantId);
  }
}
