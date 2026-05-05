// js/article.js — article fetch + render, populated in Task 6.
export async function renderArticle(slug, mountEl) {
  mountEl.textContent = `[article placeholder: ${slug}]`;
}
