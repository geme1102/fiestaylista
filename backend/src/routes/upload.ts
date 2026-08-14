import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, unlink, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v2 as cloudinary } from 'cloudinary';
import { UPLOAD_FOLDER } from '../utils/cloudinary.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter, guestUploadLimiter } from '../middleware/rateLimit.js';
import { ValidationError } from '../utils/errors.js';
import { config } from '../config.js';
import { verifyTurnstileToken } from '../middleware/turnstile.js';
import { db } from '../db/index.js';
import { events, users } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

const router = Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
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

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];

function isHeicBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const boxType = buffer.toString('ascii', 4, 8);
  if (boxType !== 'ftyp') return false;
  const majorBrand = buffer.toString('ascii', 8, 12);
  return HEIC_BRANDS.includes(majorBrand);
}

function validateMagicBytes(buffer: Buffer, mimeType: string): { valid: boolean; detectedMime: string | null } {
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return isHeicBuffer(buffer)
      ? { valid: true, detectedMime: 'image/heic' }
      : { valid: false, detectedMime: null };
  }

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

async function cleanupFile(filePath: string): Promise<void> {
  try { await unlink(filePath); } catch { /* ignore cleanup errors */ }
}

// A4: handle para abortar una subida en curso — el stream se destruye (corta
// la escritura a Cloudinary) y el public_id queda disponible para un destroy
// best-effort del asset parcial.
interface UploadAbortHandle {
  stream: { destroy(): void } | null;
  publicId: string;
}

function cloudinaryUpload(filePath: string, mimeType: string, abortHandle?: UploadAbortHandle): Promise<string> {
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

    // A4: public_id explícito para poder destruir el asset si el timeout
    // aborta la subida (antes el id era auto-generado por Cloudinary y un
    // upload interrumpido quedaba huérfano para siempre).
    const publicId = `${UPLOAD_FOLDER}/${randomUUID()}`;
    if (abortHandle) abortHandle.publicId = publicId;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: UPLOAD_FOLDER,
        public_id: publicId,
        resource_type: 'image',
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto', flags: 'strip_exif' }],
      },
      (err, result) => {
        if (err) reject(err);
        else if (result) resolve(result.secure_url);
        else reject(new Error('Cloudinary devolvió una respuesta vacía'));
      },
    );
    if (abortHandle) abortHandle.stream = uploadStream;
    createReadStream(filePath).pipe(uploadStream);
  });
}

async function uploadWithRetry(filePath: string, mimeType: string, maxRetries = 2): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await cloudinaryUploadWithTimeout(filePath, mimeType);
    } catch (err) {
      lastError = err;
      // D5-M: NO reintentar el timeout propio — 25s + 1s + 25s = 51s >
      // server.timeout (30s): el socket muere con el upload aún en curso y
      // cleanupFile() puede borrar el archivo temporal mientras el 2º intento
      // lo lee. Solo tienen sentido los reintentos por fallos transitorios de
      // Cloudinary (red/5xx), que NO marcan timedOut.
      if ((err as Error & { timedOut?: boolean })?.timedOut || attempt >= maxRetries - 1) break;
      await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
    }
  }
  throw lastError;
}

async function cloudinaryUploadWithTimeout(filePath: string, mimeType: string): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abortHandle: UploadAbortHandle = { stream: null, publicId: '' };
  try {
    return await Promise.race([
      cloudinaryUpload(filePath, mimeType, abortHandle),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          // A4: al vencer el timeout, abortar el stream (deja de escribir en
          // Cloudinary) y destruir best-effort el asset parcial — antes el
          // upload seguía corriendo en background y la foto quedaba huérfana.
          abortHandle.stream?.destroy();
          if (abortHandle.publicId) {
            cloudinary.uploader.destroy(abortHandle.publicId).catch(() => {});
          }
          const timeoutError = new Error('Cloudinary upload timed out after 25s') as Error & { timedOut?: boolean };
          timeoutError.timedOut = true;
          reject(timeoutError);
        }, 25000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
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
      const { valid, detectedMime } = validateMagicBytes(rawBuffer, req.file.mimetype);
      if (!valid) {
        await cleanupFile(filePath);
        throw new ValidationError('El archivo no es una imagen válida');
      }

      const url = await uploadWithRetry(filePath, detectedMime || req.file.mimetype);
      await cleanupFile(filePath);
      res.status(201).json({ url });
    } catch (error) {
      if (req.file) cleanupFile(req.file.path);
      next(error);
    }
  });
});

router.post('/guest-upload', guestUploadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.TURNSTILE_SECRET_KEY) {
      if (config.NODE_ENV !== 'production' && config.FRONTEND_URL?.includes('localhost')) {
        // Bypass de Turnstile solo en entornos no productivos locales
      } else {
        throw new ValidationError('Turnstile no está configurado');
      }
    } else {
      const token = typeof req.headers['x-turnstile-token'] === 'string' ? req.headers['x-turnstile-token'] : undefined;
      if (!token) {
        throw new ValidationError('Token de seguridad requerido');
      }
      await verifyTurnstileToken(token, req.ip);
    }
  } catch (err) {
    return next(err);
  }

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

      const eventId = req.body?.eventId;
      if (typeof eventId !== 'string' || !eventId) {
        throw new ValidationError('ID del evento requerido');
      }
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_RE.test(eventId)) {
        throw new ValidationError('ID del evento inválido');
      }

      const [evt] = await db
        .select({ id: events.id, ownerTier: users.tier })
        .from(events)
        .innerJoin(users, eq(users.id, events.userId))
        .where(and(eq(events.id, eventId), eq(events.isActive, true), isNull(events.deletedAt)))
        .limit(1);

      if (!evt) throw new ValidationError('El evento no está disponible para recibir fotos');

      if ((evt.ownerTier ?? 'free') === 'free') {
        throw new ValidationError('Este evento no acepta fotos');
      }

      const filePath = req.file.path;
      const rawBuffer = await readFileHeader(filePath);
      const { valid, detectedMime } = validateMagicBytes(rawBuffer, req.file.mimetype);
      if (!valid) {
        await cleanupFile(filePath);
        throw new ValidationError('El archivo no es una imagen válida');
      }
      const url = await uploadWithRetry(filePath, detectedMime || req.file.mimetype);
      await cleanupFile(filePath);
      res.status(201).json({ url });
    } catch (error) {
      if (req.file) cleanupFile(req.file.path);
      next(error);
    }
  });
});

export default router;
