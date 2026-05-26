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
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-colors"
      >
        <span>💬</span> WhatsApp
      </a>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        aria-label="Copiar enlace del evento"
      >
        {copied ? '✅ Copiado' : '🔗 Copiar Link'}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-400 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors"
      >
        <span>🐦</span> Twitter
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <span>📘</span> Facebook
      </a>
    </div>
  );
}
