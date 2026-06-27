import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Request } from 'express';
import { FabricCardsService } from './fabric-cards.service';
import { UpsertFabricCardDto } from './dto/upsert-fabric-card.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../auth/tenant-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('fabric-cards')
export class FabricCardsController {
  constructor(private readonly fabricCardsService: FabricCardsService) {}

  @Post()
  upsert(@Body() dto: UpsertFabricCardDto, @TenantId() tenantId: string) {
    return this.fabricCardsService.upsert(dto, tenantId);
  }

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.fabricCardsService.findAll(tenantId);
  }

  @Get(':fabricType')
  findOne(
    @Param('fabricType') fabricType: string,
    @TenantId() tenantId: string,
  ) {
    return this.fabricCardsService.findOne(fabricType, tenantId);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'public', 'uploads'),
        filename: (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `kartela-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit (büyük görsel yükleme desteği)
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Dosya yüklenemedi.');
    }
    const fileUrl = `/public/uploads/${file.filename}`;
    return { imageUrl: fileUrl };
  }
}
