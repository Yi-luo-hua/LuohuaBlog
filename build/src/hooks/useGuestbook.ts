import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

export const GB_KEY = 'siteGuestbookMsgs';
const MAX = 80;

export type GuestbookMsg = { nick: string; text: string; ts: number };

const AVATAR_PALETTES = [
  'linear-gradient(145deg, #ff9ec4, #c880c0)',
  'linear-gradient(145deg, #88d0c0, #68a8e0)',
  'linear-gradient(145deg, #f8a8c8, #8898e0)',
  'linear-gradient(145deg, #b898e8, #f098b8)',
  'linear-gradient(145deg, #98c8f0, #b098e8)',
  'linear-gradient(145deg, #f0b098, #e898c8)',
  'linear-gradient(145deg, #a8d8c8, #98b8e8)',
  'linear-gradient(145deg, #e8b8d8, #a8c0f0)',
];

function readGB(): GuestbookMsg[] {
  try {
    return JSON.parse(localStorage.getItem(GB_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeGB(arr: GuestbookMsg[]) {
  localStorage.setItem(GB_KEY, JSON.stringify(arr));
}

function detectUA() {
  const ua = navigator.userAgent || '';
  let os = '未知';
  let browser = '未知';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  return { os, browser };
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type GuestbookItem = GuestbookMsg & {
  id: string;
  variant: string;
  avatarGrad: string;
  avatarChar: string;
  date: string;
  ua: { os: string; browser: string } | null;
  isNew?: boolean;
};

function toItem(m: GuestbookMsg, index: number, now: number, withUa: boolean): GuestbookItem {
  const nick = m.nick || '桃';
  const variant = `wl-item--v${((nick + m.text).length % 4) + 1}`;
  const avatarGrad = AVATAR_PALETTES[nick.charCodeAt(0) % AVATAR_PALETTES.length];
  return {
    ...m,
    id: `${m.ts}-${index}`,
    variant,
    avatarGrad,
    avatarChar: nick.charAt(0).toUpperCase(),
    date: formatDate(m.ts),
    ua: withUa && now - m.ts < 60000 && index === 0 ? detectUA() : null,
  };
}

export function useGuestbook() {
  const { t } = useI18n();
  const [items, setItems] = useState<GuestbookItem[]>([]);

  const hydrate = useCallback(() => {
    if (!localStorage.getItem('gbCleaned')) {
      localStorage.removeItem(GB_KEY);
      localStorage.setItem('gbCleaned', '1');
    }
    const list = readGB();
    const now = Date.now();
    setItems(
      list.map((m, i) => toItem(m, i, now, false)),
    );
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const addMsg = useCallback(
    (nickRaw: string, text: string) => {
      const textTrim = text.trim();
      if (!textTrim) return;
      const nick = nickRaw.trim() || t('msgAnonymous');
      const ts = Date.now();
      const arr = readGB();
      arr.unshift({ nick, text: textTrim, ts });
      writeGB(arr.slice(0, MAX));
      const item = toItem({ nick, text: textTrim, ts }, 0, ts, true);
      setItems((prev) => [{ ...item, isNew: true }, ...prev]);
    },
    [t],
  );

  return { items, addMsg, count: items.length };
}
