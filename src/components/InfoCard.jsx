import { getInfoSectionsForNav } from '../sections.js';

export async function renderInfoCards(container) {
  container.innerHTML = `
    <div class="info-cards-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:0;">
      ${Array.from({ length: 6 }, () => `
        <div class="info-card-skeleton" style="background:var(--clr-navy-card);border:1px solid var(--clr-border-glow);border-radius:var(--radius-md);padding:1.25rem;min-height:130px;animation:pulse 1.5s ease-in-out infinite;">
          <div style="width:28px;height:28px;background:var(--clr-navy-light);border-radius:8px;margin-bottom:0.75rem;"></div>
          <div style="width:70%;height:14px;background:var(--clr-navy-light);border-radius:4px;margin-bottom:0.5rem;"></div>
          <div style="width:90%;height:10px;background:var(--clr-navy-light);border-radius:4px;"></div>
        </div>
      `).join('')}
    </div>
  `;

  try {
    const sections = await getInfoSectionsForNav();

    if (!sections || !sections.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:2rem 1rem;color:var(--clr-text-muted);font-family:var(--font-body);font-size:var(--text-sm);">
          <i class="fa-solid fa-folder-open" style="font-size:2rem;display:block;margin-bottom:0.75rem;" aria-hidden="true"></i>
          No resources available yet.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="info-cards-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:0;">
        ${sections.map(section => renderCard(section)).join('')}
      </div>
    `;

  } catch (err) {
    console.error('[InfoCards] Render error:', err);
    container.innerHTML = `
      <div style="text-align:center;padding:1.5rem;color:var(--clr-text-muted);font-family:var(--font-body);font-size:var(--text-sm);">
        Unable to load resources.
        <button onclick="location.reload()" style="background:none;border:none;color:var(--clr-cyan);cursor:pointer;font-family:var(--font-body);font-weight:600;text-decoration:underline;">Retry</button>
      </div>
    `;
  }
}

function renderCard(section) {
  return `
    <a href="/info/${escapeAttr(section.slug)}" class="info-nav-card" style="display:flex;flex-direction:column;text-decoration:none;background:var(--clr-navy-card);border:1px solid var(--clr-border-glow);border-radius:var(--radius-md);padding:1.25rem;transition:transform var(--transition-fast),box-shadow var(--transition-fast),border-color var(--transition-fast);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:130px;" onmouseenter="this.style.transform='translateY(-3px)';this.style.borderColor='var(--clr-magenta)';this.style.boxShadow='var(--shadow-magenta)';" onmouseleave="this.style.transform='';this.style.borderColor='';this.style.boxShadow='';" onfocus="this.style.transform='translateY(-3px)';this.style.borderColor='var(--clr-magenta)';this.style.boxShadow='var(--shadow-magenta)';" onblur="this.style.transform='';this.style.borderColor='';this.style.boxShadow='';">
      <span style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:var(--clr-navy-light);border-radius:10px;margin-bottom:0.85rem;flex-shrink:0;">
        <i class="fa-solid ${escapeAttr(section.icon || 'fa-file-lines')}" style="font-size:1rem;color:var(--clr-cyan);" aria-hidden="true"></i>
      </span>
      <h4 style="font-family:var(--font-display);font-size:var(--text-base);font-weight:700;color:var(--clr-white);margin:0 0 0.35rem;letter-spacing:var(--ls-snug);line-height:var(--lh-snug);">${escapeHtml(section.title)}</h4>
      <p style="font-family:var(--font-body);font-size:var(--text-xs);color:var(--clr-text-muted);line-height:var(--lh-snug);margin:0 0 auto;flex:1;">${escapeHtml(section.short_description || 'Learn more about this topic')}</p>
      <span style="display:inline-flex;align-items:center;gap:0.35rem;margin-top:0.85rem;font-family:var(--font-body);font-size:var(--text-xs);font-weight:600;color:var(--clr-cyan);white-space:nowrap;">
        Explore
        <i class="fa-solid fa-chevron-right" style="font-size:0.6rem;" aria-hidden="true"></i>
      </span>
    </a>
  `;
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
