import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DownloadController } from './download/download.controller';

@Module({
  imports: [],
  controllers: [AppController, DownloadController],
  providers: [AppService],
})
export class AppModule {}
