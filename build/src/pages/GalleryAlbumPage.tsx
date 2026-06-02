import '../styles/gallery-album.css';
import { Link, useParams } from 'react-router-dom';
import { Bilingual } from '../components/Bilingual';
import { getGalleryAlbum } from '../data/galleryAlbums';
import { useI18n } from '../i18n/I18nContext';
import { useMomentsRandom } from '../hooks/useMomentsRandom';

export function GalleryAlbumPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const album = id ? getGalleryAlbum(id) : undefined;

  const sectionCount = album?.sections?.length ?? 0;
  useMomentsRandom([id, sectionCount]);

  if (!album) {
    return (
      <div className="page-main-inner page-art">
        <p className="page-lead">{lang === 'zh' ? '相册不存在。' : 'Album not found.'}</p>
        <Link to="/gallery" className="post-back">
          ← {t('galleryTitle')}
        </Link>
      </div>
    );
  }

  if (album.placeholderPage || !album.sections?.length) {
    return (
      <div className="page-main-inner page-art">
        <Link to="/gallery" className="back-link">
          ← {t('galleryBack')}
        </Link>
        <h1 className="album-title">
          <Bilingual zh={album.captionZh} en={album.captionEn} />
        </h1>
        {album.placeholder ? (
          <div
            className={`gallery-placeholder${album.placeholder.className ? ` ${album.placeholder.className}` : ''}`}
            aria-hidden="true"
            data-emoji={album.placeholder.emoji}
          />
        ) : album.cover ? (
          <div className="photo-grid">
            <img className="album-cover" src={album.cover} alt="" loading="lazy" />
          </div>
        ) : null}
      </div>
    );
  }

  const imageCount = album.sections!.reduce((n, s) => n + s.images.length, 0);

  return (
    <div className="page-main-inner page-art">
      <Link to="/gallery" className="back-link">
        ← {t('galleryBack')}
      </Link>
      <h1 className="album-title">
        <Bilingual zh={album.captionZh} en={album.captionEn} />
      </h1>
      <p className="album-sub">
        {lang === 'zh' ? `相册 · ${imageCount} 张` : `Album · ${imageCount} photos`}
      </p>
      {album.sections!.map((sec) => (
        <section key={sec.title}>
          <h2 className="section-title">{sec.title}</h2>
          <div className="photo-grid">
            {sec.images.map((src) => (
              <img key={src} src={src} alt="" loading="lazy" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
