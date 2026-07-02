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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import axios from 'axios';
import { YarnStocksService } from './yarn-stocks.service';
import { CreateYarnStockDto } from './dto/create-yarn-stock.dto';
import { UpdateYarnStockDto } from './dto/update-yarn-stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../auth/tenant-id.decorator';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('yarn-stocks')
export class YarnStocksController {
  constructor(
    private readonly yarnStocksService: YarnStocksService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  create(
    @Body() createYarnStockDto: CreateYarnStockDto,
    @TenantId() tenantId: string,
  ) {
    return this.yarnStocksService.create(createYarnStockDto, tenantId);
  }

  @Get('stats')
  getStats(@TenantId() tenantId: string) {
    return this.yarnStocksService.getStats(tenantId);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.yarnStocksService.findAll(
      { page, limit, search, supplierId },
      tenantId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.yarnStocksService.findOne(id, tenantId);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateYarnStockDto: UpdateYarnStockDto,
    @TenantId() tenantId: string,
  ) {
    return this.yarnStocksService.update(id, updateYarnStockDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string) {
    return this.yarnStocksService.remove(id, tenantId);
  }

  @Post('ocr')
  @UseInterceptors(FileInterceptor('file'))
  async doOcr(
    @UploadedFile() file: Express.Multer.File,
    @TenantId() tenantId: string,
  ) {
    try {
      console.log('[YarnStocksController.doOcr] Istek alindi.');
      if (!file) {
        throw new BadRequestException('Dosya yuklenmedi.');
      }

      // Plan check (Starter plan is blocked from using OCR)
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (tenant?.plan === 'STARTER') {
        return {
          error:
            'Görsel okutma (OCR) özelliği başlangıç paketinde desteklenmemektedir. Lütfen paketinizi yükseltin veya elle giriş yapın.',
        };
      }

      // Fetch existing colors in yarn stocks to help Gemini matching
      const yarnColors = await this.prisma.yarnStock.findMany({
        where: { tenantId },
        distinct: ['color'],
        select: { color: true },
      });
      const colorList = yarnColors.map((c) => c.color).filter(Boolean);

      console.log('[YarnStocksController.doOcr] Blob olusturuluyor...');
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype,
      });
      formData.append('file', blob as any, file.originalname);
      formData.append('color_list', JSON.stringify(colorList));

      const tenantKey =
        tenant?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY || '';
      if (tenantKey) {
        formData.append('gemini_api_key', tenantKey);
      }
      const tenantPrompt = (tenant as any)?.geminiYarnPrompt?.trim() ?? '';
      if (tenantPrompt) {
        formData.append('custom_prompt', tenantPrompt);
      }

      const ocrUrl = (
        process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8000/ocr'
      ).replace(/\/ocr$/, '/ocr/yarn');
      console.log(
        '[YarnStocksController.doOcr] OCR Servisine istek atılıyor:',
        ocrUrl,
      );

      const response = await axios.post(ocrUrl, formData, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log(
        '[YarnStocksController.doOcr] OCR yanıtı alındı, HTTP Status:',
        response.status,
      );
      return response.data as any;
    } catch (err: unknown) {
      console.error('[YarnStocksController.doOcr] Hata oluştu:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Bilinmeyen hata';
      return {
        yarnType: 'Bilinmeyen İplik',
        neNumber: '',
        color: '',
        colorCode: '',
        lotNumber: '',
        initialKg: 0,
        error: errorMessage,
      };
    }
  }
}
