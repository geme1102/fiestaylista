import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { reportError } from '../lib/reportError';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';

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
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    let token = turnstileTokenRef.current;
    if (!token) {
      token = await waitForTurnstile(() => turnstileTokenRef.current);
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/upload/guest-upload`, {
        method: 'POST',
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
      resetTurnstile();

      let photoToken = turnstileTokenRef.current;
      if (!photoToken) {
        photoToken = await waitForTurnstile(() => turnstileTokenRef.current);
      }

      await apiClient.post(`/api/events/${eventId}/photos/guest-upload`, {
        url,
        caption: caption.trim() || undefined,
        turnstileToken: photoToken ?? undefined,
      });

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
      setUploading(false);
    }
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowForm(!showForm)}
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
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 mt-2 rounded-2xl bg-surface-container-low/50 border border-outline-variant/30 space-y-4"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="w-full text-sm text-on-surface-variant file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-primary-fixed file:text-primary hover:file:bg-primary-fixed/70 transition-all cursor-pointer"
          />

          {preview && (
            <div className="relative rounded-xl overflow-hidden">
              <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
            </div>
          )}

          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="¿Qué quieres contar de esta foto? (opcional)"
            className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <div ref={containerRef} />

          <button
            onClick={handleUpload}
            disabled={uploading || !fileInputRef.current?.files?.[0]}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 min-h-[48px] flex items-center justify-center"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="block w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Subiendo...
              </span>
            ) : (
              'Subir foto 📸'
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
}
