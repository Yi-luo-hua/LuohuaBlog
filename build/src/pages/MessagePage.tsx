import { useMemo, useState } from 'react';
import { Bilingual } from '../components/Bilingual';
import { useGuestbook, type GuestbookItem } from '../hooks/useGuestbook';
import { useI18n } from '../i18n/I18nContext';
import '../styles/message.css';

const MAX_LEN = 200;

function MessageItem({ item }: { item: GuestbookItem }) {
  return (
    <li className={`wl-item ${item.variant}${item.isNew ? ' wl-item--new' : ''}`}>
      <span
        className="wl-avatar"
        aria-hidden="true"
        style={{ background: item.avatarGrad }}
      >
        {item.avatarChar}
      </span>
      <div className="wl-main">
        <header className="wl-header">
          <span className="wl-name">{item.nick}</span>
          {item.ua ? (
            <span className="wl-tags">
              <span className="wl-tag">{item.ua.os}</span>
              <span className="wl-tag">{item.ua.browser}</span>
            </span>
          ) : null}
          <time className="wl-time" dateTime={item.date}>
            {item.date}
          </time>
        </header>
        <div className="wl-content">
          <p>{item.text}</p>
        </div>
      </div>
    </li>
  );
}

export function MessagePage() {
  const { t, lang } = useI18n();
  const { items, addMsg, count } = useGuestbook();
  const [nick, setNick] = useState('');
  const [text, setText] = useState('');

  const unitLabel = useMemo(
    () => (lang === 'zh' ? ' / 200 字' : ' / 200'),
    [lang],
  );

  const onSubmit = () => {
    const trimmed = text.slice(0, MAX_LEN).trim();
    if (!trimmed) return;
    addMsg(nick, trimmed);
    setText('');
  };

  return (
    <div className="mb-wrap">
      <article className="mb-panel">
        <header className="mb-page-head">
          <h1 className="mb-page-title">{t('navMsg')}</h1>
          <p className="mb-page-sub">
            <Bilingual zh="想说的 · 想问的 · 吐槽 · 交流" en="Say hi · ask · rant · chat" />
          </p>
        </header>
        <div className="mb-sep" aria-hidden="true">
          <span className="mb-sep-line" />
          <span className="mb-sep-icon">✦</span>
          <span className="mb-sep-line" />
        </div>
        <section className="mb-comments" id="msgForm" aria-labelledby="mbSectionTitle">
          <h2 className="mb-section-title" id="mbSectionTitle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span>{t('hexoComments')}</span>
          </h2>
          <form
            className="mb-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <div className="mb-form-row">
              <div className="mb-form-cell">
                <label htmlFor="msgName">{t('msgNick')}</label>
                <input
                  id="msgName"
                  type="text"
                  maxLength={20}
                  autoComplete="nickname"
                  placeholder={t('msgNick')}
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                />
              </div>
              <div className="mb-form-cell">
                <label htmlFor="msgEmail">{t('hexoEmail')}</label>
                <input
                  id="msgEmail"
                  type="email"
                  placeholder={lang === 'zh' ? '选填' : 'Optional'}
                  autoComplete="email"
                />
              </div>
              <div className="mb-form-cell">
                <label htmlFor="msgUrl">{t('hexoUrl')}</label>
                <input id="msgUrl" type="url" placeholder="https://" autoComplete="url" />
              </div>
            </div>
            <div className="mb-form-body">
              <textarea
                id="msgText"
                maxLength={MAX_LEN}
                placeholder={t('msgBody')}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              />
            </div>
            <div className="mb-form-foot">
              <span className="mb-char-count">
                {text.length}
                {unitLabel}
              </span>
              <button type="submit" className="mb-btn-primary">
                {t('msgSubmit')}
              </button>
            </div>
          </form>
          <p className="mb-count-bar">
            <em>{count}</em>
            <span>{t('msgLettersUnit')}</span>
          </p>
          <ul id="envList">
            {items.map((item) => (
              <MessageItem key={item.id} item={item} />
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}
