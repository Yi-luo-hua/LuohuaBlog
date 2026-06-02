export type Article = {
  slug: string;
  date: string;
  modified?: string;
  title_zh: string;
  title_en: string;
  excerpt_zh: string;
  excerpt_en: string;
  words: string;
  reads: string;
  minutes: string;
  bodyHtmlZh: string;
  bodyHtmlEn: string;
};

export type Moment = {
  date: string;
  title_zh: string;
  title_en: string;
  body_zh: string;
  body_en: string;
  poetic: boolean;
};

export type SiteContent = {
  articles: Article[];
  moments: Moment[];
};
