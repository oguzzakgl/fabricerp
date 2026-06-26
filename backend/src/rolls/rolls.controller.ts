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
import axios from 'axios';
import { RollsService } from './rolls.service';
import { CreateRollDto } from './dto/create-roll.dto';
import { UpdateRollDto } from './dto/update-roll.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../auth/tenant-id.decorator';

interface OcrResponse {
  fabricType: string;
  lengthM: number;
  netWeightKg: number;
  colorCode: string;
  quality: string;
  rawText: string;
  error?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('rolls')
export class RollsController {
  constructor(private readonly rollsService: RollsService) {}

  @Post('ocr')
  @UseInterceptors(FileInterceptor('file'))
  async doOcr(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<OcrResponse | { error: string }> {
    console.log(
      '[doOcr] İstek alındı. Dosya adı:',
      file?.originalname,
      'Boyut:',
      file?.size,
    );
    if (!file) {
      console.log('[doOcr] Hata: Dosya yüklenmedi.');
      return { error: 'Dosya yüklenmedi.' };
    }

    try {
      console.log('[doOcr] Blob oluşturuluyor...');
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype,
      });
      formData.append('file', blob, file.originalname);
      console.log('[doOcr] Blob oluşturuldu.');

      const ocrUrl = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8000/ocr';
      console.log('[doOcr] OCR Servisine istek atılıyor:', ocrUrl);

      const response = await axios.post(ocrUrl, formData, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('[doOcr] OCR yanıtı alındı, HTTP Status:', response.status);

      const data = response.data as OcrResponse;
      console.log(
        '[doOcr] OCR işlemi başarıyla tamamlandı. Sonuç:',
        data.fabricType,
      );
      return data;
    } catch (err: unknown) {
      console.error('[doOcr] Hata oluştu:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Bilinmeyen hata';
      return {
        fabricType: 'Bilinmeyen Kumaş',
        lengthM: 0,
        netWeightKg: 0,
        colorCode: '',
        quality: '1',
        error: errorMessage,
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
      {
        page,
        limit,
        search,
        status,
        quality,
        includeRecipe: includeRecipeBool,
      },
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
