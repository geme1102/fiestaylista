import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';

interface Message {
  id: string;
  authorName: string;
  message: string;
  createdAt: string;
}

interface MessageWallProps {
  eventId: string;
}

export default function MessageWall({ eventId }: MessageWallProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{ messages: Message[] }>(`/api/events/${eventId}/messages`);
        if (!cancelled) setMessages(res.messages || []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !newMessage.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post<{ message: Message }>(`/api/events/${eventId}/messages`, {
        authorName: authorName.trim(),
        message: newMessage.trim(),
      });
      setMessages((prev) => [res.message, ...prev]);
      setNewMessage('');
      setShowForm(false);
      showToast('Mensaje publicado 💬', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al publicar mensaje', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-on-surface flex items-center gap-2 text-lg">
          <span>💬</span> Muro de Mensajes
        </h2>
        {messages.length > 0 && (
          <span className="text-xs text-on-surface-variant font-semibold">{messages.length} mensajes</span>
        )}
      </div>

      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full p-4 mb-4 rounded-2xl border border-dashed border-outline-variant/50 flex items-center justify-between gap-3 hover:border-primary/50 hover:bg-primary-fixed/20 transition-all min-h-[56px] group"
      >
        <span className="font-semibold text-sm text-on-surface-variant group-hover:text-primary transition-colors">
          ✍️ Escribe un mensaje para el anfitrión
        </span>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${showForm ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleSubmit}
            className="overflow-hidden"
          >
            <div className="p-4 mb-4 rounded-2xl bg-surface-container-low/50 border border-outline-variant/30 space-y-3">
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe tu mensaje..."
                className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                rows={3}
                required
              />
              <button
                type="submit"
                disabled={submitting || !authorName.trim() || !newMessage.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 min-h-[48px] flex items-center justify-center"
              >
                {submitting ? (
                  <span className="block w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  'Publicar mensaje 💬'
                )}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-surface-container-highest rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-8 text-sm text-on-surface-variant/60">
          <p>Sé el primero en dejar un mensaje ✨</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-surface-container-low/50 border border-outline-variant/20"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-full bg-primary-fixed/40 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-primary">{msg.authorName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-bold text-on-surface">{msg.authorName}</span>
                <span className="text-[10px] text-on-surface-variant/50 ml-auto">
                  {new Date(msg.createdAt).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">{msg.message}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
