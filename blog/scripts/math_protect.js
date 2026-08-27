'use strict';

/**
 * Obsidian-style LaTeX Math Processor for Hexo.
 * Isolates all LaTeX formulas ($...$ and $$...$$) before Markdown rendering,
 * and wraps them in <script type="math/tex"> blocks while preventing placeholder
 * leaks into HTML attributes (heading IDs, titles, TOC hrefs).
 */

hexo.extend.filter.register('before_post_render', (data) => {
  if (!data.content) return data;

  const codeBlocks = [];
  // 1. Temporarily protect fenced code blocks and inline code
  let content = data.content.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
    const id = `___CODE_BLOCK_${codeBlocks.length}___`;
    codeBlocks.push(match);
    return id;
  });

  const mathBlocks = [];
  // 2. Protect block math $$ ... $$
  content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const id = `MATHBLOCK${mathBlocks.length}XYZ`;
    mathBlocks.push({ type: 'block', formula: formula.trim() });
    return `\n\n${id}\n\n`;
  });

  // 3. Protect inline math $ ... $
  content = content.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
    const id = `MATHINLINE${mathBlocks.length}XYZ`;
    mathBlocks.push({ type: 'inline', formula: formula.trim() });
    return id;
  });

  // 4. Restore code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    content = content.replace(`___CODE_BLOCK_${i}___`, () => codeBlocks[i]);
  }

  data.content = content;
  data._mathBlocks = mathBlocks;
  return data;
}, 1);

hexo.extend.filter.register('after_post_render', (data) => {
  if (!data._mathBlocks || !data._mathBlocks.length) return data;

  const mathBlocks = data._mathBlocks;

  // 1. Inside HTML tags (attributes like id="...", href="...", title="..."), replace with plain formula text
  let html = data.content.replace(/<[^>]+>/g, (tag) => {
    return tag.replace(/MATH(BLOCK|INLINE)(\d+)XYZ/g, (m, type, index) => {
      const item = mathBlocks[Number(index)];
      if (!item) return m;
      return item.formula.replace(/["'<>]/g, '').replace(/\\/g, '');
    });
  });

  // 2. Outside HTML tags, replace with proper MathJax script containers
  html = html.replace(/MATH(BLOCK|INLINE)(\d+)XYZ/g, (m, type, index) => {
    const item = mathBlocks[Number(index)];
    if (!item) return m;
    if (item.type === 'block') {
      return `<div class="math-block" style="overflow-x: auto; text-align: center; margin: 1.25em 0;"><script type="math/tex; mode=display">${item.formula}</script></div>`;
    }
    return `<span class="math-inline"><script type="math/tex">${item.formula}</script></span>`;
  });

  // Clean up any empty <p> wrapper around block math
  html = html.replace(/<p>\s*(<div class="math-block"[\s\S]*?<\/div>)\s*<\/p>/g, '$1');

  data.content = html;
  return data;
}, 9999);
