import { useState } from 'react';

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
    <div className="flex flex-wrap gap-2">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#22c55e] text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-all active:scale-95"
      >
        <span className="material-symbols-outlined text-sm">chat</span> WhatsApp
      </a>
      <button
        onClick={handleCopy}
        className={cn(
          'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95',
          copied
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
        )}
        aria-label="Copiar enlace del evento"
      >
        <span className="material-symbols-outlined text-sm">{copied ? 'check_circle' : 'link'}</span>
        {copied ? 'Copiado' : 'Copiar Link'}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#60a5fa] text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-all active:scale-95"
      >
        <span className="material-symbols-outlined text-sm">flutter_dash</span> Twitter
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all active:scale-95"
      >
        <span className="material-symbols-outlined text-sm">social_leaderboard</span> Facebook
      </a>
    </div>
  );
}
