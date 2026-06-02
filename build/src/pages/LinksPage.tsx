import { useI18n } from '../i18n/I18nContext';
import { useMomentsRandom } from '../hooks/useMomentsRandom';

export function LinksPage() {
  const { t, lang } = useI18n();

  useMomentsRandom([]);

  return (
    <div className="page-main-inner page-art page-art--neat">
      <h1 className="page-title page-title--art">{t('linksTitle')}</h1>
      <p className="page-lead">{t('linksLead')}</p>
      <div className="links-stack">
        <section className="links-panel moment">
          <h2>{t('linksSiteH')}</h2>
          <p>
            {lang === 'zh' ? (
              <>
                名称：<code>桃之夭夭の创作屋</code>
              </>
            ) : (
              <>
                Name: <code>桃之夭夭の创作屋</code>
              </>
            )}
          </p>
          <p>
            {lang === 'zh' ? (
              <>
                地址：<code>https://tzyy11.vercel.app</code>
              </>
            ) : (
              <>
                URL: <code>https://tzyy11.vercel.app</code>
              </>
            )}
          </p>
          <p>
            {lang === 'zh' ? (
              <>简介：一个记录学习、创作与生活的个人博客</>
            ) : (
              <>Bio: A personal blog for study, creation, and everyday life.</>
            )}
          </p>
        </section>
        <section className="links-panel moment">
          <h2>{t('linksExchangeH')}</h2>
          <ul>
            <li>{t('linksExL1')}</li>
            <li>{t('linksExL2')}</li>
            <li>{t('linksExL3')}</li>
          </ul>
        </section>
        <h2 className="links-friends-title links-friends-title--art">{t('linksFriendsH')}</h2>
        <div className="links-grid">
          <a
            className="links-friend moment"
            href="https://tzyy11.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png" alt="" />
            <div>
              <div className="n">桃之夭夭第一章</div>
              <div className="d">Hexo Butterfly</div>
              <div className="d links-visit">{t('linksVisit')}</div>
            </div>
          </a>
          <a
            className="links-friend moment"
            href="https://blog1-reimu.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png" alt="" />
            <div>
              <div className="n">桃之夭夭の花园</div>
              <div className="d">Reimu + Vercel</div>
              <div className="d links-visit">{t('linksVisit')}</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
