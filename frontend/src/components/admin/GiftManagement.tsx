import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import GiftCard from '../GiftCard';
import type { Gift } from '../../types';

interface GiftManagementProps {
  gifts: Gift[];
  addingGift: boolean;
  freeingGiftId: string | null;
  deletingGiftId: string | null;
  newGiftName: string;
  showSuggestions: boolean;
  suggestions: string[];
  filteredSuggestions: string[];
  maxGiftsPerEvent?: number;
  onAddGift: () => Promise<void>;
  onFreeGift: (giftId: string) => Promise<void>;
  onDeleteGift: (giftId: string) => Promise<void>;
  onAddSuggestion: (name: string) => Promise<void>;
  onNewGiftNameChange: (name: string) => void;
  onShowSuggestionsChange: (show: boolean) => void;
}

export function GiftManagement({
  gifts, addingGift, freeingGiftId, deletingGiftId,
  newGiftName, showSuggestions, suggestions, filteredSuggestions,
  maxGiftsPerEvent, onAddGift, onFreeGift, onDeleteGift, onAddSuggestion,
  onNewGiftNameChange, onShowSuggestionsChange,
}: GiftManagementProps) {
  const [addedGifts, setAddedGifts] = useState<Set<string>>(new Set());
  const suggestionLoadingRef = useRef(false);

  const handleAddSuggestion = useCallback(async (s: string) => {
    if (suggestionLoadingRef.current || addedGifts.has(s)) return;
    suggestionLoadingRef.current = true;
    await onAddSuggestion(s);
    setAddedGifts((prev) => new Set(prev).add(s));
    suggestionLoadingRef.current = false;
  }, [addedGifts, onAddSuggestion]);

  return (
    <section className="mb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#a21b53] to-pink-500 flex items-center justify-center text-white shadow-sm font-bold text-lg">
            🎁
          </div>
          <div className="flex flex-col text-left">
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">
              Lista de Deseos de Regalos
            </h3>
            <span className="text-xs text-gray-400 font-semibold">{gifts.length}{maxGiftsPerEvent ? ` / ${maxGiftsPerEvent}` : ''} — Tus invitados elegirán los regalos directo de esta lista</span>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onAddGift(); }}
        className="bg-surface/70 border border-rose-100/20 p-5 rounded-[28px] shadow-sm mb-6 text-left"
      >
        <h4 className="text-xs font-extrabold text-[#7e143f] uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
          <span>+ Agregar Regalo Personalizado</span>
        </h4>

        <div className="flex gap-3">
          <input
            id="gift-name"
            data-testid="gift-name-input"
            type="text"
            placeholder="Nombre del regalo (Ej: Juego de Sábanas)..."
            value={newGiftName}
            onChange={(e) => { onNewGiftNameChange(e.target.value); onShowSuggestionsChange(true); }}
            onKeyDown={(e) => { if (e.key === 'Escape') onShowSuggestionsChange(false); }}
            className="flex-1 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#d97c9b]/35 bg-surface text-gray-800"
            role="combobox"
            aria-expanded={showSuggestions && !!newGiftName && filteredSuggestions.length > 0}
            aria-autocomplete="list"
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            data-testid="add-gift-button"
            disabled={!newGiftName.trim() || addingGift || (maxGiftsPerEvent !== undefined && gifts.length >= maxGiftsPerEvent)}
            className="bg-gradient-to-r from-[#a21b53] to-[#c52367] text-white py-3 px-6 rounded-full text-xs font-black shadow-sm flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{addingGift ? '...' : maxGiftsPerEvent !== undefined && gifts.length >= maxGiftsPerEvent ? 'Límite alcanzado' : 'Añadir'}</span>
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
          </motion.button>
        </div>

        {showSuggestions && newGiftName && filteredSuggestions.length > 0 && (
          <div className="mt-3 bg-surface border border-rose-100 rounded-xl shadow-lg max-h-48 overflow-y-auto" role="listbox">
            {filteredSuggestions.map((s, idx) => (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => { onNewGiftNameChange(s); onShowSuggestionsChange(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = e.currentTarget.parentElement?.children[idx + 1] as HTMLElement | undefined;
                    next?.focus();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = e.currentTarget.parentElement?.children[idx - 1] as HTMLElement | undefined;
                    if (prev) prev.focus();
                    else onShowSuggestionsChange(false);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    onNewGiftNameChange(s);
                    onShowSuggestionsChange(false);
                  }
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-pink-50 transition-colors font-semibold focus:bg-pink-50 focus:outline-none"
              >
                + {s}
              </button>
            ))}
          </div>
        )}
      </form>

      {suggestions.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 px-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-bounce" />
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Sugerencias rápidas:</span>
          </div>

          <div className="overflow-x-auto hide-scrollbar pb-2">
            <div className="flex gap-2.5 min-w-max px-1">
              {suggestions
                .filter((s) => !gifts.some((g) => g.name.toLowerCase() === s.toLowerCase()))
                .slice(0, 8)
                .map((s, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    disabled={suggestionLoadingRef.current || addedGifts.has(s)}
                    onClick={() => handleAddSuggestion(s)}
                    className="text-xs font-bold py-2 px-[18px] rounded-full flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border bg-white hover:bg-rose-50/35 border-gray-200 text-gray-700 hover:border-[#a21b53]/40 disabled:opacity-50"
                  >
                    <span className="text-[#a21b53] font-black">+</span>
                    <span>{s}</span>
                  </motion.button>
                ))}
            </div>
          </div>
        </div>
      )}

      {gifts.length === 0 ? (
        <div className="bg-white/60 border rounded-3xl p-12 text-center border-gray-200/50">
          <p className="text-gray-800 font-extrabold text-base">No hay regalos de deseos</p>
          <p className="text-gray-400 text-xs mt-1 font-medium">Agrega tu primer regalo usando el formulario de arriba.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {gifts.map((gift) => (
            <GiftCard
              key={gift.id}
              gift={gift}
              onFree={onFreeGift}
              onDelete={onDeleteGift}
              isAdmin
              freeingId={freeingGiftId}
              deletingId={deletingGiftId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
