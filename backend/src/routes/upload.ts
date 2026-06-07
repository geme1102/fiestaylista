import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { ValidationError } from '../utils/errors.js';
import { config } from '../config.js';

const router = Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024;

const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  'image/jpeg': [new Uint8Array([0xFF, 0xD8, 0xFF])],
  'image/png': [new Uint8Array([0x89, 0x50, 0x4E, 0x47])],
  'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  'image/gif': [new Uint8Array([0x47, 0x49, 0x46, 0x38])],
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;
  return signatures.some(sig =>
    sig.length <= buffer.length && sig.every((byte, i) => buffer[i] === byte)
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      cb(new ValidationError('Tipo de archivo no permitido. Solo JPG, PNG, WebP, GIF'));
      return;
    }
    cb(null, true);
  },
});

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME || undefined,
  api_key: config.CLOUDINARY_API_KEY || undefined,
  api_secret: config.CLOUDINARY_API_SECRET || undefined,
});

function cloudinaryUpload(buffer: Buffer, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!config.CLOUDINARY_CLOUD_NAME) {
      const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
      const name = `${randomUUID()}${ext}`;
      const uploadDir = join(process.cwd(), 'uploads');
      mkdir(uploadDir, { recursive: true }).then(() =>
        writeFile(join(uploadDir, name), buffer)
      ).then(() => resolve(`/uploads/${name}`)).catch(reject);
      return;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'fiestaylista',
        resource_type: 'image',
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result!.secure_url);
      },
    );
    uploadStream.end(buffer);
  });
}

router.post('/', requireAuth, uploadLimiter, (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ValidationError('El archivo excede el tamaño máximo de 10MB'));
        }
        return next(new ValidationError(err.message));
      }
      return next(err);
    }

    try {
      if (!req.file) {
        throw new ValidationError('No se proporcionó ningún archivo');
      }

      if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
        throw new ValidationError('El archivo no es una imagen válida');
      }

      const url = await cloudinaryUpload(req.file.buffer, req.file.mimetype);
      res.status(201).json({ url });
    } catch (error) {
      next(error);
    }
  });
});

router.post('/guest', uploadLimiter, (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ValidationError('El archivo excede el tamaño máximo de 10MB'));
        }
        return next(new ValidationError(err.message));
      }
      return next(err);
    }
    try {
      if (!req.file) {
        throw new ValidationError('No se proporcionó ningún archivo');
      }

      if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
        throw new ValidationError('El archivo no es una imagen válida');
      }

      const url = await cloudinaryUpload(req.file.buffer, req.file.mimetype);
      res.status(201).json({ url });
    } catch (error) {
      next(error);
    }
  });
});

export default router;
