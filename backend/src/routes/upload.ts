import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, unlink, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter, guestUploadLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import { ValidationError } from '../utils/errors.js';
import { config } from '../config.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024;

const MAGIC_BYTES: { sig: Uint8Array; mime: string }[] = [
  { sig: new Uint8Array([0xFF, 0xD8, 0xFF]), mime: 'image/jpeg' },
  { sig: new Uint8Array([0x89, 0x50, 0x4E, 0x47]), mime: 'image/png' },
  { sig: new Uint8Array([0x52, 0x49, 0x46, 0x46]), mime: 'image/webp' },
  { sig: new Uint8Array([0x47, 0x49, 0x46, 0x38]), mime: 'image/gif' },
];

const MAGIC_BYTES_READ = 12;

async function readFileHeader(filePath: string): Promise<Buffer> {
  const fd = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(MAGIC_BYTES_READ);
    await fd.read(buf, 0, MAGIC_BYTES_READ, 0);
    return buf;
  } finally {
    await fd.close();
  }
}

function validateMagicBytes(buffer: Buffer): { valid: boolean; detectedMime: string | null } {
  for (const entry of MAGIC_BYTES) {
    if (entry.sig.length <= buffer.length && entry.sig.every((byte, i) => buffer[i] === byte)) {
      if (entry.mime === 'image/webp') {
        const webpSig = new Uint8Array([0x57, 0x45, 0x42, 0x50]);
        if (buffer.length < 12 || !webpSig.every((byte, i) => buffer[8 + i] === byte)) {
          continue;
        }
      }
      return { valid: true, detectedMime: entry.mime };
    }
  }
  return { valid: false, detectedMime: null };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (_req, file, cb) => {
      const ext = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
      cb(null, `upload_${randomUUID()}${ext}`);
    },
  }),
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

async function cleanupFile(filePath: string): Promise<void> {
  try { await unlink(filePath); } catch { /* ignore cleanup errors */ }
}

function cloudinaryUpload(filePath: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!config.CLOUDINARY_CLOUD_NAME) {
      if (config.NODE_ENV === 'production') {
        reject(new Error('Cloudinary no está configurado. Las subidas de imágenes no están disponibles en producción.'));
        return;
      }
      const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
      const name = `${randomUUID()}${ext}`;
      const uploadDir = join(process.cwd(), 'uploads');
      mkdir(uploadDir, { recursive: true })
        .then(() => rename(filePath, join(uploadDir, name)))
        .then(() => resolve(`${config.BACKEND_URL}/uploads/${name}`))
        .catch(reject);
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
        else if (result) resolve(result.secure_url);
        else reject(new Error('Cloudinary devolvió una respuesta vacía'));
      },
    );
    createReadStream(filePath).pipe(uploadStream);
  });
}

async function cloudinaryUploadWithTimeout(filePath: string, mimeType: string): Promise<string> {
  return Promise.race([
    cloudinaryUpload(filePath, mimeType),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Cloudinary upload timed out after 30s')), 30000),
    ),
  ]);
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

      const filePath = req.file.path;
      const rawBuffer = await readFileHeader(filePath);
      const { valid, detectedMime } = validateMagicBytes(rawBuffer);
      if (!valid) {
        await cleanupFile(filePath);
        throw new ValidationError('El archivo no es una imagen válida');
      }

      const url = await cloudinaryUploadWithTimeout(filePath, detectedMime || req.file.mimetype);
      await cleanupFile(filePath);
      res.status(201).json({ url });
    } catch (error) {
      if (req.file) cleanupFile(req.file.path);
      next(error);
    }
  });
});

router.post('/guest-upload', guestUploadLimiter, verifyTurnstile, (req: Request, res: Response, next: NextFunction) => {
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
      const filePath = req.file.path;
      const rawBuffer = await readFileHeader(filePath);
      const { valid, detectedMime } = validateMagicBytes(rawBuffer);
      if (!valid) {
        await cleanupFile(filePath);
        throw new ValidationError('El archivo no es una imagen válida');
      }
      const url = await cloudinaryUploadWithTimeout(filePath, detectedMime || req.file.mimetype);
      await cleanupFile(filePath);
      res.status(201).json({ url });
    } catch (error) {
      if (req.file) cleanupFile(req.file.path);
      next(error);
    }
  });
});

router.post('/guest', requireAuth, guestUploadLimiter, (req: AuthRequest, res: Response, next: NextFunction) => {
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

      const filePath = req.file.path;
      const rawBuffer = await readFileHeader(filePath);
      const { valid, detectedMime } = validateMagicBytes(rawBuffer);
      if (!valid) {
        await cleanupFile(filePath);
        throw new ValidationError('El archivo no es una imagen válida');
      }

      const url = await cloudinaryUploadWithTimeout(filePath, detectedMime || req.file.mimetype);
      await cleanupFile(filePath);
      res.status(201).json({ url });
    } catch (error) {
      if (req.file) cleanupFile(req.file.path);
      next(error);
    }
  });
});

export default router;
