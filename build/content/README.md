# 内容写作说明

文章与说说已改为 **Markdown + 静态生成**，不要直接改 `articles.html` / `shuoshuo.html`（会被构建覆盖）。

## 目录

- `content/articles/` — 长文，生成列表、`post/xxx.html`、归档时间线
- `content/moments/` — 说说，生成 `shuoshuo.html`

## 构建

```bash
pip install -r requirements.txt
python build_content.py
```

## 文章 frontmatter 示例

```yaml
---
date: 2026-05-15
slug: my-post
title_zh: 中文标题
title_en: English title
excerpt_zh: 摘要
excerpt_en: Summary
words: 3200
reads: 256
minutes: 12
---

正文 Markdown（中文）…

---en---

English Markdown body…
```

## 说说 frontmatter 示例

```yaml
---
date: 2026-05-15
title_zh: 碎碎念
title_en: Notes
poetic: false
---

说说正文（支持换行）

---en---

English text
```

`poetic: true` 会使用诗意字体样式（`moment--poetic`）。
