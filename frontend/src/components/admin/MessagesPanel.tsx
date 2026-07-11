import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { reportError } from '../../lib/reportError';


interface Message {
  id: string;
  authorName: string;
  message: string;
  createdAt: string;
}

interface MessagesPanelProps {
  eventId: string;
  refreshKey?: number;
}

export default function MessagesPanel({ eventId, refreshKey }: MessagesPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await apiClient.get<{ messages: Message[] }>(`/api/events/${eventId}/messages`);
      setMessages(res.messages || []);
    } catch (err) {
      reportError(err, { source: 'MessagesPanel' });
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages, refreshKey]);

  if (loading) {
    return (
      <div className="p-4 bg-surface-container rounded-2xl">
        <div className="h-6 w-40 bg-surface-container-highest rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-surface-container-highest rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 bg-surface-container rounded-2xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-xl text-red-400">error_outline</span>
        </div>
        <p className="text-sm font-semibold text-on-surface-variant">Error al cargar mensajes</p>
        <button
          onClick={loadMessages}
          className="mt-3 px-4 py-2 text-xs font-semibold text-primary bg-primary-fixed/30 rounded-full min-h-[36px]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-surface-container rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-on-surface flex items-center gap-2">
          <span>💬</span> Muro de Mensajes
        </h3>
        {messages.length > 0 && (
          <span className="text-xs font-semibold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-full">
            {messages.length} {messages.length === 1 ? 'mensaje' : 'mensajes'}
          </span>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-6 text-sm text-on-surface-variant/60">
          <p className="mb-1">Todavía no hay mensajes</p>
          <p className="text-xs">Los invitados pueden escribir mensajes desde su vista del evento</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="p-3 rounded-xl bg-surface-container-higher/50 border border-outline-variant/20">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-primary-fixed/40 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary">{msg.authorName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-xs font-bold text-on-surface">{msg.authorName}</span>
                <span className="text-[10px] text-on-surface-variant/50 ml-auto">
                  {new Date(msg.createdAt).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">{msg.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
