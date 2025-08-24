import { Controller, Get, Param, Res, Headers } from '@nestjs/common';
import { type Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('download')
export class DownloadController {
  @Get(':filename')
  downloadFile(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Headers('range') range?: string,
  ) {
    const filePath = path.join(__dirname, '..', '..', '..', 'data', filename);
    console.log('filePath', filePath);
    if (!fs.existsSync(filePath)) {
      res.status(404).send('File not found');
      return;
    }

    const stat = fs.statSync(filePath);
    const total = stat.size;

    if (range) {
      // Parse the Range header: e.g., bytes=0-1023
      const matches = range.match(/bytes=(\d+)-(\d*)/);
      const start = matches ? parseInt(matches[1], 10) : 0;
      const end = matches && matches[2] ? parseInt(matches[2], 10) : total - 1;
      const chunkSize = end - start + 1;

      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.status(200).set({
        'Content-Length': total,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  }
}
