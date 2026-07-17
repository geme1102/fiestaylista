import { useState, useEffect } from 'react';

export interface InAppBrowserInfo {
  isWebview: boolean;
  browser: 'instagram' | 'facebook' | 'whatsapp' | 'tiktok' | 'twitter' | 'line' | 'wechat' | 'other' | null;
  isIOS: boolean;
}

function detect(): InAppBrowserInfo {
  if (typeof navigator === 'undefined') {
    return { isWebview: false, browser: null, isIOS: false };
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua) && !/Windows Phone/.test(ua);

  const tests: Array<{ browser: InAppBrowserInfo['browser']; regex: RegExp }> = [
    { browser: 'instagram', regex: /Instagram/i },
    { browser: 'facebook', regex: /FBAV|FBAN|FB_IAB|FB4A/i },
    { browser: 'whatsapp', regex: /WhatsApp/i },
    { browser: 'tiktok', regex: /Musical_Ly|TikTok/i },
    { browser: 'twitter', regex: /Twitter/i },
    { browser: 'line', regex: /Line\//i },
    { browser: 'wechat', regex: /MicroMessenger/i },
  ];

  for (const t of tests) {
    if (t.regex.test(ua)) {
      return { isWebview: true, browser: t.browser, isIOS };
    }
  }

  const isOtherWebview = /; wv\)/.test(ua) || /WebView/i.test(ua);
  if (isOtherWebview) {
    return { isWebview: true, browser: 'other', isIOS };
  }

  return { isWebview: false, browser: null, isIOS };
}

export function useInAppBrowser(): InAppBrowserInfo {
  const [info, setInfo] = useState<InAppBrowserInfo>({
    isWebview: false,
    browser: null,
    isIOS: false,
  });

  useEffect(() => {
    setInfo(detect());
  }, []);

  return info;
}

export function getWebviewOpenHint(isIOS: boolean): { label: string; href: string } {
  if (isIOS) {
    return {
      label: 'Abrir en Safari',
      href: 'x-safari-',
    };
  }
  return {
    label: 'Abrir en Chrome',
    href: 'googlechrome://',
  };
}
