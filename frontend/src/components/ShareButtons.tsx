import { memo, useState, useRef, useEffect } from 'react';
import { reportError } from '../lib/reportError';
import { cn } from '../utils/cn';

const ShareButtons = memo(function ShareButtons({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = `${window.location.origin}/e/${slug}`;
  const text = `🎉 Te invito a ver mi lista de regalos: ${title}\n${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      reportError(err, { source: 'ShareButtons' });
      setCopied(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
});

export default ShareButtons;
