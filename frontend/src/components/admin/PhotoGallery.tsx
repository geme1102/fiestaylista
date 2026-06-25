import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Trash2, X, Star } from 'lucide-react';
import ImageWithSkeleton from '../ImageWithSkeleton';
import { ConfirmModal } from '../ConfirmModal';
import type { Photo } from '../../types';

interface PhotoGalleryProps {
  photos: Photo[];
  uploading: boolean;
  uploadProgress?: string | null;
  uploadPercent?: number;
  deletingPhoto: boolean;
  deletePhotoConfirm: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  maxPhotosPerEvent?: number;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDelete: (photoId: string) => Promise<void>;
  onRequestDelete: (photoId: string) => void;
  onDeleteConfirmClose: () => void;
  onSelectPreview: (photo: Photo | null) => void;
  selectedPhotoForPreview: Photo | null;
  onToggleFeatured?: (photoId: string) => void;
}

export const PhotoGallery = memo(function PhotoGallery({
  photos, uploading, uploadProgress, uploadPercent, deletingPhoto, deletePhotoConfirm,
  fileInputRef, maxPhotosPerEvent, onUpload, onDelete, onRequestDelete,
  onDeleteConfirmClose, onSelectPreview, selectedPhotoForPreview, onToggleFeatured,
}: PhotoGalleryProps) {
  return (
    <>
      <section className="mb-10">
        <div className="flex items-center justify-between mb-[18px] px-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
              Álbum de Recuerdos <span className="text-gray-400 text-sm font-semibold">{photos.length}{maxPhotosPerEvent ? ` / ${maxPhotosPerEvent}` : ''}</span>
            </h3>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={onUpload}
          multiple
          accept="image/*"
          className="hidden"
          id="hidden-photo-uploader"
          data-testid="photo-uploader"
        />

        {photos.length === 0 ? (
          <p className="text-center text-gray-400 text-xs font-semibold mb-6 bg-white p-6 rounded-2xl border border-dashed border-gray-200">
            📸 Aún no hay fotografías agregadas. Pulsa en Subir más fotos en el banner inferior.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-6">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => onSelectPreview(photo)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPreview(photo); } }}
                role="button"
                tabIndex={0}
                className="bg-surface p-2.5 rounded-[22px] border border-gray-200/70 shadow-sm relative group overflow-hidden cursor-pointer hover:border-[#a21b53]/45 transition-all duration-300"
              >
                <ImageWithSkeleton src={photo.url} alt={photo.caption || 'Foto del evento'} aspectRatio="aspect-square" />

                {photo.isFeatured && (
                  <div className="absolute top-3.5 left-3.5 bg-amber-400 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                    <Star className="w-3.5 h-3.5" fill="currentColor" />
                  </div>
                )}

                <div className="absolute inset-2.5 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3.5 rounded-xl">
                  <div className="flex gap-2 self-end">
                    {onToggleFeatured && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFeatured(photo.id);
                        }}
                        className={`p-3 rounded-full shadow cursor-pointer transition-transform hover:scale-105 active:scale-95 ${photo.isFeatured ? 'bg-amber-400 text-white' : 'bg-white/90 hover:bg-white text-amber-500'}`}
                        title={photo.isFeatured ? 'Quitar destacada' : 'Marcar como destacada'}
                        aria-label={photo.isFeatured ? 'Quitar destacada' : 'Marcar como destacada'}
                      >
                        <Star className="w-4 h-4" fill={photo.isFeatured ? 'currentColor' : 'none'} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestDelete(photo.id);
                      }}
                      className="bg-white/90 hover:bg-white text-red-600 p-3 rounded-full shadow cursor-pointer transition-transform hover:scale-105 active:scale-95"
                      title="Eliminar del catálogo"
                      aria-label="Eliminar foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[10px] text-white font-extrabold text-left tracking-wide uppercase bg-black/40 backdrop-blur-md px-2.5 py-1 rounded w-fit">Ampliar</span>
                </div>

                <div className="mt-2.5 px-1 text-[11px] text-gray-500 font-bold flex justify-between gap-1 overflow-hidden">
                  <span className="truncate max-w-[70%] text-left">{photo.caption || 'Foto'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          role="button"
          tabIndex={0}
          className="border-dashed border-2 border-rose-300/50 bg-gradient-to-b from-[#fff7f8] to-[#fff3f5]/50 hover:from-[#fffcfd] hover:to-[#fff5f6] rounded-[28px] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.002] active:scale-98 shadow-inner"
        >
          <div className="w-12 h-12 bg-white rounded-2xl shadow-[0_6px_20px_rgba(162,27,83,0.06)] border border-rose-100/40 flex items-center justify-center mb-3 text-[#a21b53]">
            <Upload className="w-[22px] h-[22px] stroke-[2.5]" />
          </div>
          <span className="text-[#a21b53] font-black text-sm md:text-base tracking-tight">
            {uploadProgress || (uploading ? 'Subiendo...' : 'Subir recuerdos fotográficos')}
          </span>
          {uploading && (
            <div className="w-48 h-1.5 bg-rose-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#a21b53] to-pink-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadPercent ?? 50}%` }}
              />
            </div>
          )}
          <span className="text-[10px] text-gray-400 font-bold mt-1">
            Admite formatos JPG, JPEG o PNG hasta 10 megabytes.
          </span>
        </div>
      </section>

      <AnimatePresence>
        {selectedPhotoForPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onSelectPreview(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') onSelectPreview(null); }}
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa de foto"
            className="fixed inset-0 bg-black/95 z-55 flex flex-col items-center justify-center p-4 backdrop-blur-lg"
          >
            <div className="absolute top-4 right-4 flex gap-4">
              <button
                onClick={() => onSelectPreview(null)}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all shrink-0 cursor-pointer"
                aria-label="Cerrar vista previa"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={selectedPhotoForPreview.url}
              alt={selectedPhotoForPreview.caption || 'Foto del evento'}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />

            <div className="mt-5 text-center bg-white/10 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/10 max-w-sm">
              <h5 className="text-white text-sm font-bold truncate">{selectedPhotoForPreview.caption || 'Foto'}</h5>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {deletePhotoConfirm && (
        <ConfirmModal
          message="¿Eliminar esta foto? Esta acción no se puede deshacer."
          onConfirm={() => onDelete(deletePhotoConfirm)}
          onClose={onDeleteConfirmClose}
          loading={deletingPhoto}
        />
      )}
    </>
  );
});
