// js/article.js — fetch + render an article, port of the in-browser parser
// from the pre-redesign index.html. Paragraph-boundary behavior must remain
// byte-equivalent with tools/render_article.py:extract_paragraphs — the TTS
// pipeline (timings.json sidecars) was generated against that exact split.
// DO NOT refactor parseMarkdown opportunistically; re-render audio first.

import { mountTtsBar } from './tts.js';

let articlesIndex = null;

async function loadIndex() {
  if (articlesIndex) return articlesIndex;
  const res = await fetch(`articles/articles.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`articles.json: ${res.status}`);
  articlesIndex = await res.json();
  return articlesIndex;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatLongDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function deriveSection(meta) {
  if (meta.section) return meta.section;
  if (Array.isArray(meta.tags) && meta.tags.length) {
    const t = meta.tags[0];
    // Convert "software-engineering" -> "Software engineering"
    return t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ');
  }
  return 'Writing';
}

// === parseMarkdown (PORT — DO NOT MODIFY without re-rendering all audio) ===
//
// Copied verbatim from the pre-redesign index.html. The TTS validator in
// tools/render_article.py asserts paragraph-by-paragraph parity against
// extract_paragraphs — any divergence in paragraph boundaries causes the
// deploy gate to fail.

function parseMarkdown(content) {
  // First handle code blocks to prevent interference with other parsing
  let processedContent = content;

  // Temporarily replace code blocks with placeholders to protect them
  const codeBlocks = [];
  let codeBlockIndex = 0;

  // Handle code blocks with language specification
  processedContent = processedContent.replace(/```\s*(\w+)?\s*\n?([\s\S]*?)\n?```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`;
    codeBlocks.push({ placeholder, lang: lang || '', code: code.trim() });
    codeBlockIndex++;
    return placeholder;
  });

  // Handle inline code — HTML-escape the content so backticks containing
  // literal tags (e.g. `<audio>`, `<h2>`) render as text instead of being
  // parsed as real elements by the browser. Order matters: escape & first
  // so that subsequent &lt; / &gt; replacements don't get double-escaped.
  processedContent = processedContent.replace(/`([^`]+)`/g, (_match, content) => {
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<code>${escaped}</code>`;
  });

  // Inline transforms reused by list/table builders. The main-flow bold/italic/
  // image/link regexes below run on text containing __LIST_BLOCK__/__TABLE_BLOCK__
  // placeholders, so they never reach list-item or table-cell content. Apply
  // them here, before the placeholders swallow the raw markdown.
  const applyInlines = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Handle markdown tables — replace with placeholders to protect from <p> wrapping
  const tablePlaceholders = [];
  let tableIndex = 0;
  processedContent = processedContent.replace(
    /(^\|.+\|$\n^\|[\s\-:|]+\|$\n(?:^\|.+\|$\n?)+)/gm,
    (tableBlock) => {
      const rows = tableBlock.trim().split('\n');
      const headers = rows[0].split('|').filter(c => c.trim()).map(c => c.trim());
      const bodyRows = rows.slice(2);
      let html = '<table><thead><tr>';
      headers.forEach(h => { html += `<th>${applyInlines(h)}</th>`; });
      html += '</tr></thead><tbody>';
      bodyRows.forEach(row => {
        const cells = row.split('|').filter(c => c.trim()).map(c => c.trim());
        html += '<tr>';
        cells.forEach(c => { html += `<td>${applyInlines(c)}</td>`; });
        html += '</tr>';
      });
      html += '</tbody></table>';
      const placeholder = `__TABLE_BLOCK_${tableIndex}__`;
      tablePlaceholders.push({ placeholder, html });
      tableIndex++;
      return placeholder;
    }
  );

  // Handle unordered lists (including task lists) — replace with placeholders
  const listPlaceholders = [];
  let listIndex = 0;
  processedContent = processedContent.replace(
    /((?:^[-*] (?:\[[ x]\] )?.+$\n?)+)/gm,
    (listBlock) => {
      const items = listBlock.trim().split('\n');
      const hasTaskItems = items.some(item => /^[-*] \[[ x]\] /.test(item));
      let html;
      if (hasTaskItems) {
        html = '<ul class="task-list">';
        items.forEach(item => {
          const match = item.match(/^[-*] \[([ x])\] (.+)$/);
          if (match) {
            const checked = match[1] === 'x';
            const text = applyInlines(match[2]);
            html += `<li><span class="task-checkbox${checked ? ' checked' : ''}"></span><span>${text}</span></li>`;
          } else {
            const text = applyInlines(item.replace(/^[-*] /, ''));
            html += `<li><span>${text}</span></li>`;
          }
        });
      } else {
        html = '<ul>';
        items.forEach(item => {
          const text = applyInlines(item.replace(/^[-*] /, ''));
          html += `<li>${text}</li>`;
        });
      }
      html += '</ul>';
      const placeholder = `__LIST_BLOCK_${listIndex}__`;
      listPlaceholders.push({ placeholder, html });
      listIndex++;
      return placeholder;
    }
  );

  // Handle ordered lists — replace with placeholders
  processedContent = processedContent.replace(
    /((?:^\d+\. .+$\n?)+)/gm,
    (listBlock) => {
      const items = listBlock.trim().split('\n');
      let html = '<ol>';
      items.forEach(item => {
        const text = applyInlines(item.replace(/^\d+\. /, ''));
        html += `<li>${text}</li>`;
      });
      html += '</ol>';
      const placeholder = `__LIST_BLOCK_${listIndex}__`;
      listPlaceholders.push({ placeholder, html });
      listIndex++;
      return placeholder;
    }
  );

  // Handle blockquotes — a run of consecutive lines starting with '>' becomes
  // a <blockquote> wrapping a single <p>, mirroring markdown-it/commonmark
  // (consecutive '>' lines with no internal blank line are ONE paragraph).
  // Emitting the inner <p> is what preserves TTS parity: both the client
  // selector (p, h2..h4, li) and server extract_paragraphs (h2..h4, p, li)
  // pick up that <p>, so the quote is read aloud identically on both sides.
  // Inner lines are joined with '\n' to match commonmark's <p>a\nb</p>
  // get_text(). Replace with a placeholder to protect from <p> wrapping.
  const quotePlaceholders = [];
  let quoteIndex = 0;
  processedContent = processedContent.replace(
    /((?:^>.*$\n?)+)/gm,
    (quoteBlock) => {
      const inner = quoteBlock
        .trim()
        .split('\n')
        .map((line) => line.replace(/^>\s?/, ''))
        .join('\n');
      const html = `<blockquote><p>${applyInlines(inner)}</p></blockquote>`;
      const placeholder = `__QUOTE_BLOCK_${quoteIndex}__`;
      quotePlaceholders.push({ placeholder, html });
      quoteIndex++;
      return placeholder;
    }
  );

  // Handle horizontal rules — a line of three or more dashes becomes an <hr>.
  // Mirrors the server's markdown-it output (thematic_break), which is excluded
  // from the TTS paragraph selector, so client/server paragraph parity holds.
  // Runs after code blocks are placeholdered out, so --- inside fences is safe.
  processedContent = processedContent.replace(/^-{3,}$/gm, '<hr />');

  // Handle headers (but not inside code blocks since they're now placeholders)
  processedContent = processedContent
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>');

  // Handle bold and italic
  processedContent = processedContent
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Handle images (must come before links since ![...] contains [...])
  processedContent = processedContent.replace(/!\[([^\]]*)\]\((.+?)\)/g, '<img src="$2" alt="$1" />');

  // Handle links
  processedContent = processedContent.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Handle paragraphs (but not inside pre tags)
  processedContent = processedContent
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>');

  // Clean up
  processedContent = processedContent
    .replace(/<p>\s*<hr\s*\/?>\s*<\/p>/g, '<hr />')
    .replace(/<p><h/g, '<h')
    .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
    .replace(/<p><pre>/g, '<pre>')
    .replace(/<\/pre><\/p>/g, '</pre>');

  // Restore code blocks
  codeBlocks.forEach(({ placeholder, lang, code }) => {
    // Trim leading/trailing whitespace but preserve internal formatting
    const trimmedCode = code.replace(/^\n+|\n+$/g, '');
    const codeElement = lang ? `<pre><code class="language-${lang}">${trimmedCode}</code></pre>` : `<pre><code>${trimmedCode}</code></pre>`;
    processedContent = processedContent.replace(placeholder, codeElement);
  });

  // Restore table blocks
  tablePlaceholders.forEach(({ placeholder, html }) => {
    processedContent = processedContent.replace(`<p>${placeholder}</p>`, html);
    processedContent = processedContent.replace(placeholder, html);
  });

  // Restore list blocks
  listPlaceholders.forEach(({ placeholder, html }) => {
    processedContent = processedContent.replace(`<p>${placeholder}</p>`, html);
    processedContent = processedContent.replace(placeholder, html);
  });

  // Restore blockquote blocks
  quotePlaceholders.forEach(({ placeholder, html }) => {
    processedContent = processedContent.replace(`<p>${placeholder}</p>`, html);
    processedContent = processedContent.replace(placeholder, html);
  });

  return processedContent;
}

export async function renderArticle(slug, mountEl) {
  const index = await loadIndex();
  const filename = `${slug}.md`;
  const meta = index[filename];

  if (!meta) {
    mountEl.innerHTML = `
      <p class="meta">404</p>
      <h1>Article not found</h1>
      <p><a class="back-link" href="#/">← back to writing</a></p>
    `;
    document.title = 'Not found · Timothy D Beach';
    return;
  }

  const cacheBust = `?t=${Date.now()}`;
  const res = await fetch(`articles/${filename}${cacheBust}`);
  if (!res.ok) {
    mountEl.innerHTML = `<p class="meta">Error</p><h1>Could not load article</h1>`;
    return;
  }
  const md = await res.text();

  // Strip the H1 (article title) — we render it from articles.json instead so
  // the meta line and title share styling with the homepage.
  const bodyMd = md.replace(/^#\s+.*$/m, '').trimStart();
  const bodyHtml = parseMarkdown(bodyMd);

  const hasAudio = !!(meta.audio && meta.timings);

  mountEl.innerHTML = `
    <a class="back-link" href="#/">← Writing</a>
    <article class="article">
      <header class="article-header">
        <p class="meta">${escapeHtml(formatLongDate(meta.date))} · ${escapeHtml(deriveSection(meta))}</p>
        <h1>${escapeHtml(meta.title)}</h1>
        <div class="article-actions">
          ${hasAudio ? '<button type="button" class="read-aloud" data-act="read-aloud">▶ Read aloud</button>' : ''}
          <button type="button" class="share-link" data-act="share" title="Copy a link with a rich social preview">⧉ Copy share link</button>
        </div>
      </header>
      <div class="article-body">${bodyHtml}</div>
    </article>
  `;

  document.title = `${meta.title} · Timothy D Beach`;
  // Update all three description meta tags for on-page + social previews.
  // Currently dormant: no article in articles.json has a 'summary' field
  // yet. When summaries land, all three locations (description /
  // og:description / twitter:description) update together.
  if (meta.summary) {
    const selectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) el.setAttribute('content', meta.summary);
    }
  }

  // Copy-share-link: copies the crawlable /a/<slug>/ URL (not the #-route),
  // so the pasted link yields a per-article social preview. Always points at
  // the production origin — the share pages only exist on timbeach.com.
  const shareBtn = mountEl.querySelector('[data-act="share"]');
  if (shareBtn) {
    const shareUrl = `https://timbeach.com/a/${slug}/`;
    shareBtn.addEventListener('click', async () => {
      const flash = (label) => {
        shareBtn.textContent = label;
        shareBtn.classList.add('copied');
        setTimeout(() => {
          shareBtn.textContent = '⧉ Copy share link';
          shareBtn.classList.remove('copied');
        }, 1600);
      };
      try {
        await navigator.clipboard.writeText(shareUrl);
        flash('✓ Copied!');
      } catch {
        // Clipboard API unavailable (non-secure context / old browser):
        // fall back to a hidden textarea + execCommand.
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        document.body.removeChild(ta);
        flash(ok ? '✓ Copied!' : 'Copy failed');
      }
    });
  }

  // TTS bar opens only when the reader explicitly asks for it.
  if (hasAudio) {
    const btn = mountEl.querySelector('[data-act="read-aloud"]');
    if (btn) {
      btn.addEventListener('click', () => {
        mountTtsBar({ ...meta, slug });
      });
    }
  }
}
