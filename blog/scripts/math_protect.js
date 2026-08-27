'use strict';

/**
 * Obsidian-style LaTeX Math Processor for Hexo.
 * Isolates all LaTeX formulas ($...$ and $$...$$) before Markdown rendering,
 * and wraps them in <script type="math/tex"> blocks so MathJax renders them
 * with 100% precision (preserving matrix linebreaks, subscripts, ampersands).
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

  for (let i = 0; i < data._mathBlocks.length; i++) {
    const item = data._mathBlocks[i];
    if (item.type === 'block') {
      const regex = new RegExp(`<p>\\s*MATHBLOCK${i}XYZ\\s*<\\/p>|MATHBLOCK${i}XYZ`, 'g');
      data.content = data.content.replace(
        regex,
        `<div class="math-block" style="overflow-x: auto; text-align: center; margin: 1.25em 0;"><script type="math/tex; mode=display">${item.formula}</script></div>`,
      );
    } else {
      const regex = new RegExp(`MATHINLINE${i}XYZ`, 'g');
      data.content = data.content.replace(
        regex,
        `<span class="math-inline"><script type="math/tex">${item.formula}</script></span>`,
      );
    }
  }

  return data;
}, 9999);
