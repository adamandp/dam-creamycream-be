import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const multerOptions: MulterOptions = {
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
      return cb(
        new BadRequestException('Only image files are allowed!'),
        false,
      );
    }
    cb(null, true);
  },
};

export function assertImageFile(
  file: Express.Multer.File | undefined,
): asserts file is Express.Multer.File {
  if (!file || !file.buffer || file.size > 2 * 1024 * 1024)
    throw new BadRequestException('Invalid image file');
  const b = file.buffer;
  const jpeg = b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png =
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP';
  if (
    !(
      (jpeg && ['image/jpeg', 'image/jpg'].includes(file.mimetype)) ||
      (png && file.mimetype === 'image/png') ||
      (webp && file.mimetype === 'image/webp')
    )
  )
    throw new BadRequestException('Invalid image file');
}
