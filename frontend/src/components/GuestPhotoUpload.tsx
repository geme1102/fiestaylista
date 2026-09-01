import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { reportError } from '../lib/reportError';
import { Button } from '../components/ui/Button';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';
import { compressImage } from '../utils/compressImage';

interface GuestPhotoUploadProps {
  eventId: string;
  onUploaded: () => void;
}

export default function GuestPhotoUpload({ eventId, onUploaded }: GuestPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const { containerRef, token: turnstileToken, reset: resetTurnstile } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);
  const submittingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Solo se permiten imágenes', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('La imagen no puede superar los 10MB', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (submittingRef.current) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    submittingRef.current = true;

    setUploading(true);
    try {
      let token = turnstileTokenRef.current;
      if (!token) {
        token = await waitForTurnstile(() => turnstileTokenRef.current);
      }
      const compressed = await compressImage(file);

      const formData = new FormData();
      formData.append('file', compressed, file.name);
      formData.append('eventId', eventId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const apiBase = import.meta.env.VITE_API_URL || '';
      const uploadUrl = `${apiBase}/api/upload/guest-upload`;

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: token ? { 'x-turnstile-token': token } : undefined,
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al subir la imagen');
      }
      const { url } = await res.json();

      await apiClient.post(`/api/events/${eventId}/photos/guest-upload`, {
        url,
        caption: caption.trim() || undefined,
        turnstileToken: token ?? undefined,
      });
      resetTurnstile();

      showToast('Foto subida 📸 ¡Gracias!', 'success');
      setShowForm(false);
      setCaption('');
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploaded();
    } catch (err) {
      reportError(err, { source: 'GuestPhotoUpload' });
      showToast(err instanceof Error ? err.message : 'Error al subir la foto', 'error');
    } finally {
      submittingRef.current = false;
      setUploading(false);
    }
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowForm(!showForm)}
        aria-expanded={showForm}
        aria-controls="photo-form-panel"
        className="w-full p-4 rounded-2xl border border-dashed border-outline-variant/50 flex items-center justify-between gap-3 hover:border-primary/50 hover:bg-primary-fixed/20 transition-all min-h-[56px] group"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 1" }}>add_a_photo</span>
          <span className="font-semibold text-sm text-on-surface-variant group-hover:text-primary transition-colors">
            {showForm ? 'Cerrar' : '📸 ¿Tomaste fotos? Súbelas aquí'}
          </span>
        </div>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${showForm ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {showForm && (
        <motion.div
          id="photo-form-panel"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 mt-2 rounded-2xl bg-surface-container-low/50 border border-outline-variant/30 space-y-4"
        >
          <input
            ref={fileInputRef}
            id="guest-photo-file"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Seleccionar foto para subir"
          />
          <label htmlFor="guest-photo-file" className="sr-only">Foto</label>
          <Button
            variant="outline"
            fullWidth
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<span className="material-symbols-outlined text-base">photo_camera</span>}
          >
            {preview ? 'Cambiar foto' : 'Seleccionar foto 📷'}
          </Button>

          {preview && (
            <div className="relative rounded-xl overflow-hidden">
              <img src={preview} alt="Vista previa de la foto seleccionada" loading="lazy" className="w-full h-48 object-cover rounded-xl" />
            </div>
          )}

          <label htmlFor="guest-photo-caption" className="sr-only">Descripción de la foto (opcional)</label>
          <input
            id="guest-photo-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={500}
            placeholder="¿Qué quieres contar de esta foto? (opcional)"
            className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <div ref={containerRef} />

          <Button variant="primary" fullWidth loading={uploading} onClick={handleUpload} disabled={!fileInputRef.current?.files?.[0] || uploading}>
            {uploading ? 'Subiendo...' : 'Subir foto 📸'}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
