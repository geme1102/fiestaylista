import { useState } from 'react';
import { cn } from '../utils/cn';

export default function ShareButtons({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/e/${slug}`;
  const text = `🎉 Te invito a ver mi lista de regalos: ${title}\n${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <button
        onClick={() => window.open(whatsappUrl, '_blank')}
        className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-[#22c55e] text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#22c55e]/20"
      >
        <span className="material-symbols-outlined text-3xl">chat</span>
        <span className="font-label-md text-caption uppercase tracking-wider">WhatsApp</span>
      </button>
      <button
        onClick={handleCopy}
        className={cn(
          'flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all active:scale-95 border',
          copied
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-[#f3f4f6] text-on-surface-variant hover:bg-surface-container-high border-outline-variant/30'
        )}
      >
        <span className={cn('material-symbols-outlined text-3xl', copied ? 'text-green-600' : 'text-primary')}>
          {copied ? 'check_circle' : 'link'}
        </span>
        <span className="font-label-md text-caption uppercase tracking-wider">
          {copied ? '✅ Copiado' : 'Copiar Link'}
        </span>
      </button>
      <button
        onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')}
        className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-[#60a5fa] text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#60a5fa]/20"
      >
        <span className="material-symbols-outlined text-3xl">flutter_dash</span>
        <span className="font-label-md text-caption uppercase tracking-wider">Twitter</span>
      </button>
      <button
        onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')}
        className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-[#2563eb] text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#2563eb]/20"
      >
        <span className="material-symbols-outlined text-3xl">social_leaderboard</span>
        <span className="font-label-md text-caption uppercase tracking-wider">Facebook</span>
      </button>
    </div>
  );
}
