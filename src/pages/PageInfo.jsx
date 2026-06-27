import { getInfoSectionData, getCategoryLabel } from '../sections.js';
import { getUser } from '../client.js';

export async function renderInfoPage(sectionSlug, container) {
  container.innerHTML = `
    <div class="info-page-loading" style="text-align:center;padding:6rem 1rem;">
      <div style="width:48px;height:48px;border:3px solid var(--clr-border-glow);border-top-color:var(--clr-cyan);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1rem;"></div>
      <p style="color:var(--clr-text-dim);font-family:var(--font-body);font-size:var(--text-base);">Loading content...</p>
    </div>
  `;

  try {
    const [sectionData, user] = await Promise.all([
      getInfoSectionData(sectionSlug),
      getUser().catch(() => null)
    ]);

    if (!sectionData || !sectionData.title) {
      renderNotFound(container);
      return;
    }

    const categoryLabel = getCategoryLabel(sectionData.category || 'general');
    const contentHtml = buildContentBlocks(sectionData.content || []);

    container.innerHTML = `
      <article class="info-page">
        <div class="section" style="padding-top:80px;">
          <a href="/" class="info-back-link" aria-label="Back to home" style="display:inline-flex;align-items:center;gap:0.5rem;color:var(--clr-cyan);text-decoration:none;font-family:var(--font-body);font-size:var(--text-sm);font-weight:500;margin-bottom:1.5rem;transition:color var(--transition-fast);">
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            Back to Home
          </a>
          <header class="info-header" style="margin-bottom:2.5rem;">
            <span class="sec-label">
              <i class="fa-solid ${sectionData.icon || 'fa-file-lines'}" aria-hidden="true" style="margin-right:0.35rem;"></i>
              ${categoryLabel}
            </span>
            <h1 class="section-title" style="font-size:clamp(2rem,5vw,3.5rem);text-align:left;margin-bottom:0.75rem;">${escapeHtml(sectionData.title)}</h1>
            ${sectionData.description ? `
              <p class="section-subtitle" style="text-align:left;margin-left:0;max-width:680px;">${escapeHtml(sectionData.description)}</p>
            ` : ''}
          </header>
          <div class="info-content">${contentHtml}</div>
          <nav style="margin-top:3.5rem;padding-top:2rem;border-top:1px solid var(--clr-border-glow);display:flex;gap:1rem;flex-wrap:wrap;">
            <a href="/" class="btn-primary">
              <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              All Resources
            </a>
          </nav>
        </div>
      </article>
    `;

  } catch (err) {
    console.error('[InfoPage] Render error:', err);
    renderError(container);
  }
}

function buildContentBlocks(blocks) {
  if (!blocks || !blocks.length) {
    return `
      <div style="background:var(--clr-navy-card);border:1px solid var(--clr-border-glow);border-radius:var(--radius-md);padding:2rem;text-align:center;">
        <i class="fa-solid fa-file-lines" style="font-size:2rem;color:var(--clr-text-muted);display:block;margin-bottom:0.75rem;" aria-hidden="true"></i>
        <p style="color:var(--clr-text-dim);font-family:var(--font-body);">Content coming soon.</p>
      </div>
    `;
  }

  return blocks.map(block => {
    switch (block.type) {

      case 'heading':
        return `
          <h2 style="font-family:var(--font-display);font-size:clamp(1.25rem,3vw,1.75rem);font-weight:700;color:var(--clr-white);margin:2rem 0 1rem;letter-spacing:var(--ls-snug);line-height:var(--lh-snug);">${escapeHtml(block.text || '')}</h2>
        `;

      case 'text':
        return `
          <div class="info-text-block" style="margin-bottom:1.5rem;">
            ${block.heading ? `<h3 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;color:var(--clr-white);margin-bottom:0.6rem;letter-spacing:var(--ls-snug);">${escapeHtml(block.heading)}</h3>` : ''}
            <p style="font-family:var(--font-body);font-size:var(--text-base);line-height:var(--lh-relaxed);color:var(--clr-text-dim);margin:0;">${escapeHtml(block.body || '')}</p>
          </div>
        `;

      case 'image':
        return `
          <figure class="info-image-block" style="margin:1.5rem 0;border-radius:var(--radius-md);overflow:hidden;background:var(--clr-navy-card);border:1px solid var(--clr-border-glow);max-width:100%;">
            <img src="${escapeAttr(block.src || '')}" alt="${escapeAttr(block.alt || 'Image')}" style="width:100%;height:auto;display:block;max-height:450px;object-fit:contain;background:var(--clr-navy-light);" loading="lazy" />
            ${block.caption ? `<figcaption style="padding:0.75rem 1.25rem;font-family:var(--font-body);font-size:var(--text-sm);color:var(--clr-text-muted);text-align:center;border-top:1px solid var(--clr-border-glow);">${escapeHtml(block.caption)}</figcaption>` : ''}
          </figure>
        `;

      case 'callout': {
        const v = getCalloutVariant(block.variant || 'info');
        return `
          <div class="info-callout" style="background:${v.bg};border-left:4px solid ${v.border};border-radius:var(--radius-sm);padding:1rem 1.25rem;margin:1.5rem 0;display:flex;gap:0.85rem;align-items:flex-start;">
            <i class="fa-solid ${v.icon}" style="font-size:1.15rem;color:${v.border};flex-shrink:0;margin-top:0.15rem;" aria-hidden="true"></i>
            <div>
              ${block.heading ? `<strong style="display:block;font-family:var(--font-body);font-size:var(--text-sm);font-weight:700;color:var(--clr-white);margin-bottom:0.3rem;">${escapeHtml(block.heading)}</strong>` : ''}
              <p style="font-family:var(--font-body);font-size:var(--text-base);line-height:var(--lh-relaxed);color:var(--clr-text-dim);margin:0;">${escapeHtml(block.body || '')}</p>
            </div>
          </div>
        `;
      }

      case 'list':
        return `
          <ul class="info-list" style="margin:1rem 0 1.5rem;padding-left:1.5rem;font-family:var(--font-body);font-size:var(--text-base);color:var(--clr-text-dim);line-height:var(--lh-relaxed);list-style-type:none;">
            ${(block.items || []).map(item => `
              <li style="margin-bottom:0.5rem;padding-left:0.25rem;display:flex;align-items:flex-start;gap:0.5rem;">
                <i class="fa-solid fa-circle-check" style="color:var(--clr-cyan);font-size:0.7rem;flex-shrink:0;margin-top:0.45rem;" aria-hidden="true"></i>
                <span>${escapeHtml(item)}</span>
              </li>
            `).join('')}
          </ul>
        `;

      case 'table': {
        if (!block.rows || !block.rows.length) return '';
        const headers = block.headers || [];
        return `
          <div class="info-table-wrapper" style="overflow-x:auto;margin:1.5rem 0;border-radius:var(--radius-md);border:1px solid var(--clr-border-glow);">
            <table style="width:100%;border-collapse:collapse;font-family:var(--font-body);font-size:var(--text-sm);color:var(--clr-text-dim);">
              ${headers.length ? `
                <thead>
                  <tr style="background:var(--clr-navy-light);">
                    ${headers.map(h => `<th style="padding:0.75rem 1rem;text-align:left;font-weight:700;color:var(--clr-white);border-bottom:2px solid var(--clr-border-glow);white-space:nowrap;">${escapeHtml(h)}</th>`).join('')}
                  </tr>
                </thead>
              ` : ''}
              <tbody>
                ${block.rows.map((row, i) => `
                  <tr style="background:${i % 2 === 0 ? 'transparent' : 'var(--clr-navy-light)'};">
                    ${(Array.isArray(row) ? row : []).map(cell => `<td style="padding:0.65rem 1rem;border-bottom:1px solid var(--clr-border-glow);">${escapeHtml(String(cell))}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      default:
        return '';
    }
  }).join('');
}

function getCalloutVariant(variant) {
  const variants = {
    tip: { bg: 'rgba(10,126,126,0.06)', border: 'var(--clr-cyan)', icon: 'fa-lightbulb' },
    warning: { bg: 'rgba(184,135,58,0.06)', border: 'var(--clr-magenta)', icon: 'fa-triangle-exclamation' },
    info: { bg: 'rgba(10,126,126,0.04)', border: 'var(--clr-cyan)', icon: 'fa-circle-info' },
    danger: { bg: 'rgba(220,53,69,0.06)', border: '#dc3545', icon: 'fa-skull' },
    success: { bg: 'rgba(25,135,84,0.06)', border: '#198754', icon: 'fa-circle-check' }
  };
  return variants[variant] || variants.info;
}

function renderNotFound(container) {
  container.innerHTML = `
    <div class="info-page-error" style="text-align:center;padding:6rem 1rem;">
      <i class="fa-solid fa-file-circle-question" style="font-size:3.5rem;color:var(--clr-text-muted);display:block;margin-bottom:1.5rem;" aria-hidden="true"></i>
      <h2 style="font-family:var(--font-display);color:var(--clr-white);margin-bottom:0.5rem;font-size:clamp(1.5rem,4vw,2rem);">Section Not Found</h2>
      <p style="color:var(--clr-text-dim);margin-bottom:2rem;font-family:var(--font-body);">This page doesn't exist or has been moved.</p>
      <a href="/" class="btn-primary"><i class="fa-solid fa-house" aria-hidden="true"></i> Back to Home</a>
    </div>
  `;
}

function renderError(container) {
  container.innerHTML = `
    <div class="info-page-error" style="text-align:center;padding:6rem 1rem;">
      <i class="fa-solid fa-circle-exclamation" style="font-size:3.5rem;color:var(--clr-magenta);display:block;margin-bottom:1.5rem;" aria-hidden="true"></i>
      <h2 style="font-family:var(--font-display);color:var(--clr-white);margin-bottom:0.5rem;font-size:clamp(1.5rem,4vw,2rem);">Something Went Wrong</h2>
      <p style="color:var(--clr-text-dim);margin-bottom:2rem;font-family:var(--font-body);">Please try refreshing the page or come back later.</p>
      <a href="/" class="btn-primary"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Try Again</a>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
