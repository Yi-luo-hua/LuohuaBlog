import { Link } from 'react-router-dom';
import { Bilingual } from '../components/Bilingual';
import { galleryAlbums } from '../data/galleryAlbums';
import { useI18n } from '../i18n/I18nContext';
import { useMomentsRandom } from '../hooks/useMomentsRandom';

export function GalleryPage() {
  const { t } = useI18n();

  useMomentsRandom([galleryAlbums.length]);

  return (
    <div className="page-main-inner page-art">
      <h1 className="page-title page-title--art">{t('galleryTitle')}</h1>
      <p className="page-lead">{t('galleryLead')}</p>
      <div className="gallery-feed">
        {galleryAlbums.map((album, i) => {
          const isFirst = i === 0;
          const cardClass = `gallery-album-card moment${isFirst ? ' moment--poetic' : ''}`;
          const inner = (
            <>
              {album.cover ? (
                <figure className="album-cover-wrap">
                  <img
                    className="album-cover"
                    src={album.cover}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.background =
                        'linear-gradient(135deg,#e8eef8,#f5e8ec)';
                    }}
                  />
                  {album.labelZh ? (
                    <span className="album-cover-label">{t('galleryAlbumAnime')}</span>
                  ) : null}
                </figure>
              ) : album.placeholder ? (
                <div
                  className={`gallery-placeholder${album.placeholder.className ? ` ${album.placeholder.className}` : ''}`}
                  aria-hidden="true"
                  data-emoji={album.placeholder.emoji}
                />
              ) : null}
              <p className="gallery-album-caption">
                <Bilingual zh={album.captionZh} en={album.captionEn} />
              </p>
            </>
          );
          return (
            <Link
              key={album.id}
              to={`/gallery/${album.id}`}
              className={cardClass}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
