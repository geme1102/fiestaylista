import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { Skeleton } from '../ui/Skeleton';

interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isConfirmed: boolean;
  companions: number;
  dietaryRestrictions: string | null;
  message: string | null;
  createdAt: string;
}

interface GuestsPanelProps {
  eventId: string;
}

export default function GuestsPanel({ eventId }: GuestsPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const { data: guests = [], isLoading, isError } = useQuery({
    queryKey: ['guests', eventId],
    queryFn: () => apiClient.get<{ guests: Guest[] }>(`/api/events/${eventId}/guests`),
    select: (data) => data.guests || [],
    staleTime: 1000 * 30,
  });

  const confirmed = guests.filter((g) => g.isConfirmed);
  const notConfirmed = guests.filter((g) => !g.isConfirmed);
  const totalCompanions = confirmed.reduce((sum, g) => sum + g.companions, 0);
  const totalPeople = confirmed.length + totalCompanions;

  if (isError) {
    return (
      <div className="glass rounded-3xl p-6 md:p-8 border border-outline-variant/20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-2xl text-red-400">error_outline</span>
        </div>
        <p className="text-sm font-semibold text-on-surface-variant">Error al cargar invitados</p>
        <p className="text-xs text-on-surface-variant/60 mt-1">Revisa tu conexión e intenta de nuevo.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass rounded-3xl p-6 md:p-8 border border-outline-variant/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 md:p-8 border border-outline-variant/20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          <h2 className="text-lg font-bold text-on-surface">Invitados</h2>
        </div>
        <span className="text-sm font-bold text-primary bg-primary-fixed/30 px-3 py-1 rounded-full">
          {confirmed.length} confirmados{totalPeople > 0 && ` · ${totalPeople} personas`}
        </span>
      </div>

      {guests.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-2xl text-on-surface-variant">how_to_reg</span>
          </div>
          <p className="text-sm font-semibold text-on-surface-variant">No hay invitados aún</p>
          <p className="text-xs text-on-surface-variant/60 mt-1">Cuando alguien confirme asistencia, aparecerá aquí.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary-fixed/30 to-primary-fixed/10 border border-primary/10">
              <p className="text-2xl font-bold text-primary">{confirmed.length}</p>
              <p className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wide">Sí vienen</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-highest/50">
              <p className="text-2xl font-bold text-on-surface">{notConfirmed.length}</p>
              <p className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wide">Sin responder</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-50/30 border border-amber-200/30">
              <p className="text-2xl font-bold text-amber-700">{totalPeople}</p>
              <p className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wide">Personas totales</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-highest/50">
              <p className="text-2xl font-bold text-on-surface">{totalCompanions}</p>
              <p className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wide">Acompañantes</p>
            </div>
          </div>

          <div className="space-y-2">
            {(showAll ? confirmed : confirmed.slice(0, 5)).map((guest) => (
              <div key={guest.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary-fixed/40 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{guest.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{guest.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-on-surface-variant/60">
                      {guest.email && <span className="truncate max-w-[150px]">{guest.email}</span>}
                      {guest.companions > 0 && <span>+{guest.companions} {guest.companions === 1 ? 'acompañante' : 'acompañantes'}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {guest.dietaryRestrictions && (
                    <span className="material-symbols-outlined text-sm text-amber-500" title={guest.dietaryRestrictions}>restaurant</span>
                  )}
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" title="Confirmado" />
                </div>
              </div>
            ))}
          </div>

          {confirmed.length > 5 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full mt-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary-fixed/20 rounded-xl transition-all min-h-[44px]"
            >
              Ver todos ({confirmed.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}
