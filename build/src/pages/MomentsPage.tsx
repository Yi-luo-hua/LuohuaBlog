import { Bilingual, BilingualBlock } from '../components/Bilingual';
import { siteContent } from '../data/content';
import { useI18n } from '../i18n/I18nContext';
import { useMomentsRandom } from '../hooks/useMomentsRandom';

export function MomentsPage() {
  const { t } = useI18n();
  const moments = [...siteContent.moments].sort((a, b) => (a.date < b.date ? 1 : -1));

  useMomentsRandom([moments.length]);

  return (
    <div className="page-main-inner">
      <h1 className="page-title">{t('shuoshuoTitle')}</h1>
      <div className="moments-feed">
        {moments.map((m, idx) => (
          <article
            key={`${m.date}-${idx}`}
            className={`moment${m.poetic ? ' moment--poetic' : ''}`}
          >
            <div className="moment-date">{m.date}</div>
            {(m.title_zh || m.title_en) && (
              <div className="moment-title">
                <Bilingual zh={m.title_zh} en={m.title_en} />
              </div>
            )}
            <div className="moment-body">
              <BilingualBlock zh={m.body_zh} en={m.body_en} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
