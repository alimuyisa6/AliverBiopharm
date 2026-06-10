// updated
 import { useState } from 'react';
import useAuth from '../hooks/useAuth';
import { useSiteData } from '../context/SiteDataContext';
import { useHomePageEffects } from '../hooks/useHomePageEffects';

function esc(t) {
  if (!t) return '';
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showResourceModal(id) {
  const item = window.allResources?.find(r => r.id == id);
  if (!item) return;
  const modalContent = document.getElementById('resource-modal-content');
  if (!modalContent) return;
  modalContent.innerHTML = `
    <h2>${esc(item.title)}</h2>
    <p style="color:var(--clr-text-dim);margin-bottom:1rem;">${esc(item.description)}</p>
    <div><span style="color:var(--clr-text-muted);">Author:</span> ${esc(item.author || 'Unknown')}</div>
    <div><span style="color:var(--clr-text-muted);">Level:</span> ${esc(item.level || 'N/A')} | <span style="color:var(--clr-text-muted);">Category:</span> ${esc(item.category || 'N/A')}</div>
    <div><span style="color:var(--clr-text-muted);">File size:</span> ${esc(item.file_size || 'N/A')}</div>
    ${item.file_url ? `<a href="${esc(item.file_url)}" class="btn-primary" download target="_blank" rel="noopener"><i class="fa-solid fa-download"></i> Download</a>` : ''}
  `;
  const overlay = document.getElementById('resource-modal-overlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function filterResources() {
  const searchInput = document.getElementById('resource-search');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const level = window.resourceFilters?.level || '';
  const category = window.resourceFilters?.category || '';
  return (window.allResources || []).filter(r => {
    const matchSearch = !search || (r.title || '').toLowerCase().includes(search) || (r.description || '').toLowerCase().includes(search) || (r.tag || '').toLowerCase().includes(search);
    const matchLevel = !level || r.level === level;
    const matchCategory = !category || r.category === category;
    return matchSearch && matchLevel && matchCategory;
  });
}

function renderFilteredResources() {
  const container = document.getElementById('resources-container');
  if (!container) return;
  const filtered = filterResources();
  if (!filtered.length) {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--clr-text-dim);">No resources match your criteria.</p>';
    return;
  }
  const groups = {};
  filtered.forEach(item => {
    const s = (item.section_type || 'Resources').trim();
    if (!groups[s]) groups[s] = [];
    groups[s].push(item);
  });
  renderResourcesHTML(container, groups);
}

 
  function renderResourcesHTML(container, groups) {
  let html = '';
  for (const [name, items] of Object.entries(groups)) {
    html += `<div style="margin-bottom:3rem;">
      <h2 style="font-family:'Poppins',sans-serif;font-size:1.6rem;color:var(--clr-cyan);margin-bottom:1.25rem;padding-left:1rem;border-left:4px solid var(--clr-magenta);">${esc(name)}</h2>
      <div class="resources-grid">`;
    for (const item of items) {
      const fileIcon = (item.file_url || '').toLowerCase().endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file';
      html += `<div class="resource-card" data-id="${item.id}">
        <div style="font-size:2.2rem;color:var(--clr-magenta);"><i class="fa-solid ${fileIcon}"></i></div>
        <a href="#" class="resource-title-link" style="font-weight:700;font-size:1.05rem;color:var(--clr-white);text-decoration:none;">${esc(item.title || 'Untitled')}</a>
        <p style="font-size:0.9rem;color:var(--clr-text-dim);flex-grow:1;">${esc(item.description || '')}</p>
        <div style="display:flex;flex-wrap:wrap;gap:0.6rem;font-size:0.8rem;color:var(--clr-text-muted);">
          <span><i class="fa-regular fa-user"></i> ${esc(item.author || 'Unknown')}</span>
          <span><i class="fa-regular fa-calendar"></i> ${new Date(item.created_at).toLocaleDateString()}</span>
          <span><i class="fa-regular fa-file"></i> ${esc(item.file_size || 'N/A')}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:1rem;border-top:1px solid var(--clr-border-glow);">
          <a href="${esc(item.file_url || '#')}" class="btn-download" download target="_blank" rel="noopener"><i class="fa-solid fa-download"></i> Download</a>
          <div style="display:flex;gap:0.4rem;">
            <a href="#" class="share-btn" aria-label="Share on Facebook"><i class="fa-brands fa-facebook-f"></i></a>
            <a href="#" class="share-btn" aria-label="Share on X"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="#" class="share-btn" aria-label="Share on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
          </div>
        </div>
      </div>`;
    }
    html += `</div></div>`;
  }
  container.innerHTML = html;
  container.querySelectorAll('.resource-title-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const card = e.target.closest('.resource-card');
      if (card) showResourceModal(card.dataset.id);
    });
  });
}

function loadAllSections(sections) {
  if (!sections || Object.keys(sections).length === 0) return;
  if (sections.site_config?.logo_url) {
    const logoUrl = sections.site_config.logo_url;
    document.querySelectorAll('.logo-link').forEach(el => {
      el.innerHTML = `<img src="${logoUrl}" fetchpriority="high" loading="eager" style="height:70px;width:auto;max-width:260px;object-fit:contain;display:block;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.15));" alt="AliverBiopharm">`;
    });
  }
  const headings = sections.section_headings || {};
  Object.entries(headings).forEach(([key, val]) => {
    const el = document.getElementById(key);
    if (el) el.textContent = val;
  });
  if (sections.hero?.slides?.length) {
    const heroSection = document.getElementById('home');
    if (heroSection) {
      heroSection.innerHTML = sections.hero.slides.map((s, i) => `<div class="carousel-slide${i === 0 ? ' active' : ''}" style="background-image:url('${esc(s.background_image)}');"><div class="slide-overlay"><h1 class="font-display font-black text-4xl md:text-6xl mb-4 hero-title">${esc(s.title)}</h1><p class="text-lg md:text-xl max-w-2xl mb-8 hero-subtitle">${esc(s.subtitle)}</p><a href="${esc(s.cta_link)}" class="btn-primary"><i class="${esc(s.icon || 'fa-solid fa-arrow-right')}" aria-hidden="true"></i> ${esc(s.cta_text)}</a></div></div>`).join('') + '<button class="carousel-arrow carousel-prev" aria-label="Previous slide"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button><button class="carousel-arrow carousel-next" aria-label="Next slide"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button><div class="carousel-controls">' + sections.hero.slides.map((_, i) => `<span class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}" role="button" tabindex="0" aria-label="Go to slide ${i + 1}"></span>`).join('') + '</div>';
      initCarousel(sections.hero.slides.length);
    }
  }
  if (sections.hero_title) {
    const heroData = sections.hero_title;
    const mainTitle = heroData.main_title || 'Aliver Biopharm';
    const subLine = heroData.sub_line || 'Advanced Biology & Pharmacy Learning Platform';
    document.getElementById('dynamic-main-title').innerHTML = mainTitle.split(' ').map((word, i) => `<span class="title-word ${i % 2 === 0 ? 'magenta-word' : 'cyan-word'}">${esc(word)}</span>`).join('');
    document.getElementById('title-sub-line').innerHTML = subLine.split(' ').map(word => {
      if (word.toLowerCase() === '&') return `<span class="sub-word magenta-word">&</span>`;
      if (word.toLowerCase() === 'biology' || word.toLowerCase() === 'pharmacy') return `<span class="sub-word cyan-word">${esc(word)}</span>`;
      return `<span class="sub-word">${esc(word)}</span>`;
    }).join(' ');
  }
  if (sections.daily_facts || sections.weekly_challenge) {
    const dailyContainer = document.getElementById('daily-fact');
    let html = '';
    if (sections.weekly_challenge?.question) {
      const wc = sections.weekly_challenge;
      html += `<div class="weekly-challenge-card"><div class="challenge-badge">WEEKLY CHALLENGE</div><h3 style="font-family:'Poppins',sans-serif;color:var(--clr-cyan);margin-bottom:0.5rem;"><i class="fa-solid fa-trophy" style="color:var(--clr-magenta);"></i> ${esc(wc.question)}</h3></div>`;
    }
    if (sections.daily_facts?.length) {
      const today = new Date().toISOString().slice(0, 10);
      let fact = sections.daily_facts.find(f => f.date === today) || sections.daily_facts[sections.daily_facts.length - 1];
      if (fact) {
        const icon = fact.icon || 'fa-flask';
        html += `<div class="daily-fact-card"><div class="daily-fact-icon" style="color:${fact.icon?.includes('capsules') || fact.icon?.includes('pills') ? 'var(--clr-magenta)' : 'var(--clr-cyan)'}"><i class="fa-solid ${esc(icon)}"></i></div><div><p style="font-weight:700;color:var(--clr-cyan);">SCIENCE FACT OF THE DAY</p><p style="color:var(--clr-white);">${esc(fact.fact)}</p><small style="color:var(--clr-text-muted);">Source: ${esc(fact.source || 'Unknown')}</small></div></div>`;
      }
    }
    dailyContainer.innerHTML = html;
    if (sections.weekly_challenge) initQuizCard(sections.weekly_challenge);
  }
  if (sections.team?.members?.length) {
    const teamGrid = document.getElementById('team-grid');
    teamGrid.className = 'team-scroll-container';
    teamGrid.innerHTML = sections.team.members.map(p => `<div class="team-card" style="min-width:280px;max-width:320px;"><div class="team-avatar">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="${esc(p.name)}">` : '<i class="fa-solid fa-user-tie"></i>'}</div><h3>${esc(p.name)}</h3><div class="team-title">${esc(p.title || 'Faculty Member')}</div><p>${esc(p.bio || '')}</p><div class="team-social">${p.linkedin ? `<a href="${esc(p.linkedin)}" target="_blank" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>` : ''} ${p.twitter ? `<a href="${esc(p.twitter)}" target="_blank" aria-label="Twitter"><i class="fa-brands fa-x-twitter"></i></a>` : ''}</div></div>`).join('');
    const scrollBtns = document.createElement('div');
    scrollBtns.style.cssText = 'text-align:center;margin-top:16px;display:flex;gap:12px;justify-content:center;';
    scrollBtns.innerHTML = '<button onclick="document.getElementById(\'team-grid\').scrollBy({left:-300,behavior:\'smooth\'})" style="background:var(--clr-navy-card);border:1.5px solid var(--clr-cyan);color:var(--clr-cyan);width:40px;height:40px;border-radius:50%;cursor:pointer;"><i class="fa-solid fa-chevron-left"></i></button><button onclick="document.getElementById(\'team-grid\').scrollBy({left:300,behavior:\'smooth\'})" style="background:var(--clr-navy-card);border:1.5px solid var(--clr-cyan);color:var(--clr-cyan);width:40px;height:40px;border-radius:50%;cursor:pointer;"><i class="fa-solid fa-chevron-right"></i></button>';
      teamGrid.parentNode.insertBefore(scrollBtns, teamGrid.nextSibling);
  }
  if (sections.testimonials?.quotes?.length) {
    const quotes = sections.testimonials.quotes;
    let currentQuote = 0;
    function showQuote(i) {
      const slider = document.getElementById('testimonial-slider');
      if (slider) {
        slider.innerHTML = `<blockquote class="testimonial-quote">"${esc(quotes[i].text)}"</blockquote><cite class="testimonial-author">— ${esc(quotes[i].author)}</cite><div class="testimonial-nav">${quotes.map((_, j) => `<span class="testimonial-dot${j === i ? ' active' : ''}" data-index="${j}" role="button" tabindex="0" aria-label="Testimonial ${j + 1}"></span>`).join('')}</div>`;
        document.querySelectorAll('.testimonial-dot').forEach(d => d.onclick = () => showQuote(+d.dataset.index));
      }
    }
    showQuote(0);
    setInterval(() => showQuote((currentQuote + 1) % quotes.length), 5000);
  }
  if (sections.pricing?.plans?.length) {
    document.getElementById('pricing-grid').innerHTML = sections.pricing.plans.map(pl => `<div class="card pricing-card${pl.featured ? ' featured' : ''}"><h3>${esc(pl.name)}</h3><p style="font-size:0.84rem;color:var(--clr-text-dim);">${esc(pl.description || '')}</p><div class="price my-3">${esc(pl.price)}<span style="font-size:1rem;color:var(--clr-text-dim);">${esc(pl.period || '')}</span></div><ul class="pricing-features">${(pl.features || []).map(f => `<li><i class="fa-solid fa-check"></i> ${esc(f)}</li>`).join('')}</ul><button class="btn-primary mt-4" style="width:auto; display:inline-flex; margin-left:auto; margin-right:auto;">${esc(pl.cta_text || 'Subscribe')}</button></div>`).join('');
  }
  if (sections.blog?.posts?.length) {
    document.getElementById('blog-grid').innerHTML = sections.blog.posts.map(p => `<article class="card">${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.title)}" style="width:100%;height:200px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:1rem;">` : ''}<div class="flex gap-4 text-xs" style="color:var(--clr-text-muted);margin-bottom:0.5rem;"><span><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${esc(p.date || '')}</span><span><i class="fa-regular fa-user" aria-hidden="true"></i> ${esc(p.author || '')}</span></div><h3 style="font-family:'Poppins',sans-serif;font-weight:700;font-size:1.15rem;color:var(--clr-white);">${esc(p.title)}</h3><p style="font-size:0.84rem;line-height:1.7;color:var(--clr-text-dim);">${esc(p.excerpt || '')}</p><a href="#" style="color:var(--clr-magenta);font-weight:600;font-size:0.875rem;">Read Article <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></article>`).join('');
  }
  if (sections.faq?.items?.length) {
    document.getElementById('faq-list').innerHTML = sections.faq.items.map(i => `<div class="faq-item"><button class="faq-question" onclick="this.parentElement.classList.toggle('active')"><span>${esc(i.question)}</span><span style="color:var(--clr-cyan);">+</span></button><div class="faq-answer" role="region"><p>${esc(i.answer)}</p></div></div>`).join('');
  }
  if (sections.contact?.info) {
    const contactInfoCard = document.getElementById('contact-info-card');
    if (contactInfoCard) {
      contactInfoCard.innerHTML += sections.contact.info.map(c => `<div style="display:flex;align-items:center;gap:1rem;padding:0.8rem 0;border-bottom:1px solid var(--clr-border-glow);"><div class="contact-icon"><i class="${esc(c.icon)}" aria-hidden="true"></i></div><div><div style="font-size:0.7rem;color:var(--clr-text-muted);">${esc(c.label)}</div><a href="${esc(c.href)}" style="color:var(--clr-white);text-decoration:none;">${esc(c.value)}</a></div></div>`).join('');
    }
  }
  if (sections.footer) {
    const footerGrid = document.getElementById('footer-grid');
    if (footerGrid) {
      footerGrid.innerHTML = (sections.footer.columns || []).map(c => `<div><h4 style="font-weight:700;color:var(--clr-white);font-size:0.9rem;margin-bottom:16px;">${esc(c.heading)}</h4><ul style="list-style:none;display:flex;flex-direction:column;gap:10px;">${(c.items || []).map(i => `<li><a href="${esc(i.href || '#')}" style="font-size:0.875rem;color:var(--clr-text-dim);text-decoration:none;">${i.icon ? `<i class="${esc(i.icon)}" style="color:var(--clr-magenta);margin-right:0.5rem;"></i>` : ''}${esc(i.label)}</a></li>`).join('')}</ul></div>`).join('');
    }
    const footerSocial = document.getElementById('footer-social');
    if (footerSocial) {
      footerSocial.innerHTML = (sections.footer.social_links || []).map(s => `<a href="${esc(s.url)}" aria-label="${esc(s.platform)}" target="_blank" rel="noopener noreferrer"><i class="${esc(s.icon)}" aria-hidden="true"></i></a>`).join('');
    }
  }
  loadPublicStats();
}

function initCarousel(count) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.carousel-dot');
  if (count <= 1 || slides.length !== count) return;
  let current = 0;
  let interval;
  function go(i) {
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');
    current = i;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
  }
  function nxt() { go((current + 1) % count); }
  function prv() { go((current - 1 + count) % count); }
  function reset() { clearInterval(interval); interval = setInterval(nxt, 5000); }
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { prv(); reset(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { nxt(); reset(); });
  dots.forEach(d => d.addEventListener('click', () => { go(+d.dataset.index); reset(); }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { prv(); reset(); }
    else if (e.key === 'ArrowRight') { nxt(); reset(); }
  });
  reset();
}

function initQuizCard(weeklyChallenge) {
  const container = document.getElementById('daily-fact');
  if (!container || !weeklyChallenge?.question) return;
  if (!isAuthenticated) {
    const existingCard = container.querySelector('.weekly-challenge-card');
    if (existingCard) existingCard.innerHTML += '<p style="text-align:center;color:var(--clr-text-dim);">Sign in to attempt the weekly challenge.</p>';
    return;
  }
  async function checkStatus() {
    try {
      return await apiCall('submit_weekly_challenge', { week_start: weeklyChallenge.week_start, selected_option: null });
    } catch (e) {
      return { already_answered: false };
    }
  }
  async function render() {
    const status = await checkStatus();
    let quizHTML = '';
    const now = new Date();
    const nextMonday = new Date(weeklyChallenge.week_start);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const remaining = Math.max(0, nextMonday - now);
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    const countdownStr = days + 'd ' + hours + 'h ' + mins + 'm';
    if (status.already_answered) {
      const isCorrect = status.correct;
      quizHTML = `<p style="text-align:center;color:var(--clr-white);margin-top:0.5rem;"><i class="fa-solid fa-${isCorrect ? 'check-circle' : 'times-circle'}" style="color:${isCorrect ? '#0ab5b5' : '#e74c3c'};"></i> ${isCorrect ? 'Correct!' : 'Incorrect.'} ${String.fromCharCode(65 + weeklyChallenge.correct)}) ${weeklyChallenge.options[weeklyChallenge.correct]}<br><small style="color:var(--clr-text-dim);">${esc(weeklyChallenge.explanation)}</small><br><small style="color:var(--clr-text-muted);">Next challenge in: ${countdownStr}</small></p>`;
    } else {
      quizHTML = '<div style="text-align:center;margin-top:0.5rem;">' + weeklyChallenge.options.map((opt, i) => `<button class="quiz-option-btn" data-idx="${i}">${String.fromCharCode(65 + i)}) ${esc(opt)}</button>`).join('') + `<p style="color:var(--clr-text-muted);font-size:0.8rem;margin-top:0.5rem;">Submissions close in ${countdownStr}</p></div>`;
    }
    const existingCard = container.querySelector('.weekly-challenge-card');
    if (existingCard) {
      existingCard.querySelectorAll('.quiz-option-btn, p').forEach(el => el.remove());
      existingCard.insertAdjacentHTML('beforeend', quizHTML);
      if (!status.already_answered) {
        existingCard.querySelectorAll('.quiz-option-btn').forEach(btn => {
          btn.addEventListener('click', async function(e) {
            const idx = parseInt(this.dataset.idx);
            const isCorrect = idx === weeklyChallenge.correct;
            this.classList.add(isCorrect ? 'correct' : 'incorrect');
            this.parentElement.querySelectorAll('.quiz-option-btn').forEach(b => b.disabled = true);
            try {
              await apiCall('submit_weekly_challenge', { week_start: weeklyChallenge.week_start, selected_option: idx });
            } catch (e) {}
            setTimeout(() => {
              this.parentElement.innerHTML = `<p style="text-align:center;color:var(--clr-white);margin-top:0.5rem;"><i class="fa-solid fa-${isCorrect ? 'check-circle' : 'times-circle'}" style="color:${isCorrect ? '#0ab5b5' : '#e74c3c'};"></i> ${isCorrect ? 'Correct!' : 'Incorrect.'} ${String.fromCharCode(65 + weeklyChallenge.correct)}) ${weeklyChallenge.options[weeklyChallenge.correct]}<br><small style="color:var(--clr-text-dim);">${esc(weeklyChallenge.explanation)}</small><br><small style="color:var(--clr-text-muted);">Next challenge in: ${countdownStr}</small></p>`;
            }, 800);
          });
        });
      }
    }
  }
  render();
}

async function submitMood() {
  if (!window.selectedMood || !currentUser) return;
  const message = document.getElementById('mood-message').value.trim();
  try {
    await apiCall('submit_mood', { mood: window.selectedMood, message });
    document.getElementById('mood-message-form').style.display = 'none';
    document.getElementById('mood-response').textContent = "Thanks for sharing! We're here to help.";
    document.getElementById('mood-response').style.display = 'block';
    setTimeout(() => {
      document.querySelectorAll('.mood-emoji').forEach(e => e.classList.remove('selected'));
      window.selectedMood = null;
      document.getElementById('mood-message').value = '';
      document.getElementById('mood-response').style.display = 'none';
    }, 5000);
  } catch (e) { alert('Failed to submit mood.'); }
}

async function loadPublicStats() {
  try {
    const stats = await apiCall('get_public_stats');
    const grid = document.getElementById('stats-grid');
    if (!grid || !stats) return;
    grid.innerHTML = '';
    const items = [
      { value: stats.resources_count || 0, label: 'Resources' },
      { value: stats.users_count || 0, label: 'Learners' },
      { value: stats.downloads_count || 0, label: 'Downloads' },
      { value: stats.quiz_attempts || 0, label: 'Quiz Attempts' }
    ];
    items.forEach(item => {
      const div = document.createElement('div');
      div.setAttribute('role', 'listitem');
      div.innerHTML = `<div class="stat-number" data-target="${item.value}">0</div><div style="color:var(--clr-text-dim);margin-top:0.25rem;font-size:0.875rem;">${item.label}</div>`;
      grid.appendChild(div);
    });
    animateStats();
  } catch (e) {
    const grid = document.getElementById('stats-grid');
    if (grid) grid.innerHTML = '<p style="text-align:center;color:var(--clr-text-dim);">Statistics coming soon.</p>';
  }
}

function animateStats() {
  const counters = document.querySelectorAll('.stat-number[data-target]');
  if (!counters.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = +el.dataset.target;
        if (target === 0) { el.textContent = '0'; observer.unobserve(el); return; }
        const duration = 1500;
        const step = target / (duration / 16);
        let current = 0;
        const update = () => {
          current += step;
          if (current < target) { el.textContent = Math.floor(current); requestAnimationFrame(update); }
          else { el.textContent = target; }
        };
        update();
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => observer.observe(el));
}

async function loadFilters() {
  try {
    const data = await apiCall('get_filter_options');
    const categories = data?.categories || [];
    const container = document.getElementById('filter-options-category');
    if (container && categories.length) {
      const allOption = container.querySelector('input[value=""]').parentElement;
      container.innerHTML = '';
      container.appendChild(allOption);
      categories.forEach(cat => {
        const label = document.createElement('label');
        label.className = 'filter-option';
        label.innerHTML = `<input type="radio" name="category" value="${esc(cat)}"> ${esc(cat)}`;
        label.querySelector('input').addEventListener('change', () => { document.getElementById('selected-category').textContent = cat; });
        container.appendChild(label);
      });
    }
  } catch (err) { console.error('Filter load error:', err); }
}

async function buildResources() {
  const container = document.getElementById('resources-container');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--clr-text-dim);">Loading resources…</p>';
  try {
    const data = await apiCall('get_resources');
    if (!data || !data.length) {
      container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--clr-text-dim);">No resources found.</p>';
      return;
    }
    window.allResources = data;
    renderFilteredResources();
  } catch (err) { container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--clr-magenta);">Failed to load resources.</p>'; }
}

function lazyLoad(selector, fn) {
  const el = document.querySelector(selector);
  if (!el) return;
  const obs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { fn(); obs.disconnect(); }
  }, { rootMargin: '200px' });
  obs.observe(el);
}

async function loadFlashcards() {
  const container = document.getElementById('flashcards-container');
  if (!container) return;
  try {
    container.innerHTML = '<p style="text-align:center;color:var(--clr-text-dim);">Loading flashcards...</p>';
    const data = await apiCall('get_flashcards');
    if (!data || !Array.isArray(data) || !data.length) {
      container.innerHTML = '<p style="text-align:center;color:var(--clr-text-dim);">No flashcards yet. Check back soon!</p>';
      return;
    }
    const decks = {};
    data.forEach(card => {
      const cat = (card.category && String(card.category).trim()) || 'General';
      if (!decks[cat]) decks[cat] = [];
      decks[cat].push(card);
    });
    window.flashcardState.decks = decks;
    window.flashcardState.shuffledDecks = { ...decks };
    if (currentUser) {
      try {
        const progress = await apiCall('get_flashcard_progress');
        window.flashcardState.deckProgress = progress || {};
      } catch (e) {}
    }
    let knownIds = [];
    if (currentUser) {
      try { knownIds = await apiCall('get_known_flashcards') || []; } catch (e) {}
    }
    renderAllDecks(knownIds);
    updateDeckCount();
    document.getElementById('level-select').addEventListener('change', (e) => {
      window.flashcardState.selectedLevel = e.target.value;
      filterDecks();
      updateDeckCount();
    });
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.flashcardState.mode = btn.dataset.mode;
        window.flashcardState.quizAnswered = false;
        window.flashcardState.currentCardIndex = 0;
        filterDecks();
      });
    });
    document.getElementById('shuffle-btn').addEventListener('click', () => {
      window.flashcardState.shuffledDecks = {};
      Object.keys(decks).forEach(cat => {
        window.flashcardState.shuffledDecks[cat] = [...decks[cat]].sort(() => Math.random() - 0.5);
      });
      window.flashcardState.currentCardIndex = 0;
      window.flashcardState.quizAnswered = false;
      filterDecks();
    });
    document.addEventListener('keydown', handleFlashcardKeyboard);
  } catch (err) { container.innerHTML = '<p style="text-align:center;color:var(--clr-magenta);">Failed to load flashcards.</p>'; }
}

function getCurrentDeckCards() {
  const deckName = window.flashcardState.currentDeck;
  if (!deckName) return null;
  const source = window.flashcardState.shuffledDecks[deckName] || window.flashcardState.decks[deckName];
  return source || null;
}

function navigateCards(direction) {
  const cards = getCurrentDeckCards();
  if (!cards) return;
  const newIndex = window.flashcardState.currentCardIndex + direction;
  if (newIndex >= 0 && newIndex < cards.length) {
    window.flashcardState.currentCardIndex = newIndex;
    window.flashcardState.quizAnswered = false;
    renderActiveDeck();
  }
}

function flipCurrentCard() {
  if (window.flashcardState.mode !== 'study') return;
  const face = document.querySelector('.flashcard-face.active-card');
  if (face) face.classList.toggle('flipped');
}

function focusDeck(category) {
  window.flashcardState.currentDeck = category;
  window.flashcardState.currentCardIndex = 0;
  window.flashcardState.quizAnswered = false;
  filterDecks();
  setTimeout(() => { document.getElementById('deck-' + category.replace(/\s+/g, '-'))?.scrollIntoView({ behavior: 'smooth' }); }, 100);
}

function handleCardClick(faceElement, cardId, deckName, cardIndex) {
  if (window.flashcardState.mode === 'quiz') return;
  window.flashcardState.currentDeck = deckName;
  window.flashcardState.currentCardIndex = cardIndex;
  faceElement.classList.toggle('flipped');
  renderActiveDeck();
}

function renderActiveDeck() {
  const deckName = window.flashcardState.currentDeck;
  if (!deckName) return;
  const container = document.getElementById('flashcards-container');
  if (!container) return;
  const escapedDeckName = deckName.replace(/"/g, '\\"');
  const deckContainer = container.querySelector('[data-category="' + escapedDeckName + '"]');
  if (deckContainer) {
    const grid = deckContainer.querySelector('.flashcard-grid');
    const cards = getCurrentDeckCards();
    if (grid && cards) {
      const counter = deckContainer.querySelector('.card-counter');
      if (counter) { counter.textContent = 'Card ' + (window.flashcardState.currentCardIndex + 1) + ' of ' + cards.length; }
      grid.querySelectorAll('.flashcard-face').forEach((face, idx) => { face.classList.toggle('active-card', idx === window.flashcardState.currentCardIndex); });
    }
  }
}

function updateDeckCount() {
  let totalCards = 0, totalDecks = 0;
  Object.entries(window.flashcardState.shuffledDecks).forEach(([cat, cards]) => {
    const filtered = window.flashcardState.selectedLevel ? cards.filter(c => c.level === window.flashcardState.selectedLevel) : cards;
    if (filtered.length) { totalDecks++; totalCards += filtered.length; }
  });
  const countEl = document.getElementById('deck-count');
  if (countEl) countEl.textContent = totalDecks + ' decks · ' + totalCards + ' cards';
}

function renderAllDecks(knownIds) {
  const container = document.getElementById('flashcards-container');
  if (!container) return;
  renderDecksHTML(container, window.flashcardState.shuffledDecks, knownIds);
}

function filterDecks() {
  const container = document.getElementById('flashcards-container');
  if (!container) return;
  let filteredDecks = {};
  Object.entries(window.flashcardState.shuffledDecks).forEach(([cat, cards]) => {
    const filtered = window.flashcardState.selectedLevel ? cards.filter(c => c.level === window.flashcardState.selectedLevel) : cards;
    if (filtered.length) filteredDecks[cat] = filtered;
  });
  if (currentUser) {
    apiCall('get_known_flashcards').then(k => { const knownIds = k || []; renderDecksHTML(container, filteredDecks, knownIds); }).catch(() => { renderDecksHTML(container, filteredDecks, []); });
  } else { renderDecksHTML(container, filteredDecks, []); }
}

function renderDecksHTML(container, decks, knownIds) {
  const totalDecks = Object.keys(decks).length;
  const totalCards = Object.values(decks).flat().length;
  container.innerHTML = Object.entries(decks).map(([category, cards]) => {
    const progress = window.flashcardState.deckProgress[category] || { reviewed: 0, total: cards.length };
    const progressPercent = cards.length > 0 ? (progress.reviewed / cards.length) * 100 : 0;
    const escapedCat = esc(category).replace(/'/g, "\\'");
    return `<div class="flashcard-category" data-category="${esc(category)}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px;">
        <h3 style="font-family:var(--font-display);color:var(--clr-magenta);font-size:1.35rem;font-weight:700;padding-left:14px;border-left:4px solid var(--clr-cyan);line-height:1.3;"><i class="fa-solid fa-layer-group" style="margin-right:8px;"></i>${esc(category)}<span style="font-size:0.8rem;color:var(--clr-text-muted);margin-left:8px;">(${cards.length} cards)</span></h3>
        <div style="display:flex;gap:8px;align-items:center;">
          <div style="width:100px;"><div class="progress-bar"><div class="progress-fill" style="width:${progressPercent}%;"></div></div><small style="color:var(--clr-text-muted);font-size:0.7rem;">${progress.reviewed}/${cards.length} reviewed</small></div>
          <button class="btn-download" onclick="focusDeck('${escapedCat}')" style="white-space:nowrap;"><i class="fa-solid fa-play"></i> Study</button>
        </div>
      </div>
      <div class="flashcard-grid" id="deck-${esc(category).replace(/\s+/g, '-')}">
        ${cards.slice(0, window.flashcardState.currentDeck === category ? cards.length : 3).map((card, idx) => {
          const isKnown = knownIds.includes(card.id);
          const hasImage = card.image_url && String(card.image_url).trim() !== '';
          return renderFlashcardHTML(card, isKnown, hasImage, category, idx);
        }).join('')}
        ${cards.length > 3 && window.flashcardState.currentDeck !== category ? `<div class="flashcard-deck" style="display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="focusDeck('${escapedCat}')"><div style="text-align:center;color:var(--clr-cyan);"><i class="fa-solid fa-ellipsis" style="font-size:2rem;"></i><p>Show all ${cards.length} cards</p></div></div>` : ''}
      </div>
    </div>`;
  }).join('');
  document.getElementById('deck-count').textContent = totalDecks + ' decks · ' + totalCards + ' cards';
  attachFlashcardListeners();
}

function renderFlashcardHTML(card, isKnown, hasImage, deckName, cardIndex) {
  const activeClass = (window.flashcardState.currentDeck === deckName && window.flashcardState.currentCardIndex === cardIndex) ? ' active-card' : '';
  const escapedDeckName = esc(deckName).replace(/'/g, "\\'");
  return `<div class="flashcard-deck" data-id="${card.id}" data-known="${isKnown}" data-deck="${esc(deckName)}" data-index="${cardIndex}">
    <div class="flashcard-face${activeClass}" onclick="handleCardClick(this,'${card.id}','${escapedDeckName}',${cardIndex})">
      <div class="front${hasImage ? '' : ' no-image'}">
        ${hasImage ? `<div class="flashcard-image-wrap"><img src="${esc(card.image_url)}" alt="${esc(card.front_text || 'Flashcard image')}" loading="lazy" onerror="this.onerror=null;this.parentElement.style.display='none';this.closest('.front').classList.add('no-image');"></div>` : ''}
        <div class="flashcard-question"><strong>${esc(card.front_text || 'No question')}</strong>${card.audio_url ? ` <button class="audio-btn" onclick="event.stopPropagation();speakText('${esc(card.front_text || card.back_text || 'No text').replace(/'/g, "\\'")}', this)" title="Pronounce term"><i class="fa-solid fa-volume-high"></i></button>` : ''}</div>
      </div>
      <div class="back">${esc(card.back_text || 'No answer available.')}</div>
    </div>
    ${window.flashcardState.mode === 'quiz' ? `<div class="quiz-input-container" data-card-id="${card.id}"><input type="text" class="quiz-answer-input" placeholder="Type your answer..." data-card-id="${card.id}"><button class="quiz-check-btn" onclick="checkQuizAnswer('${card.id}', this.previousElementSibling)"><i class="fa-solid fa-check"></i></button></div><div class="quiz-result" id="quiz-result-${card.id}" style="display:none;"></div>` : ''}
    <div class="difficulty-rating"><button class="difficulty-btn easy" onclick="rateFlashcard('easy')">Easy</button><button class="difficulty-btn medium" onclick="rateFlashcard('medium')">Medium</button><button class="difficulty-btn hard" onclick="rateFlashcard('hard')">Hard</button></div>
    ${window.flashcardState.currentDeck === deckName ? `<div class="card-counter">Card ${cardIndex + 1} of ${getCurrentDeckCards()?.length || 0}</div>` : ''}
    <div><span>${card.thumb_url ? `<img src="${esc(card.thumb_url)}" alt="" loading="lazy" onerror="this.style.display='none';" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid var(--clr-cyan);">` : ''}</span>
    <div style="display:flex;gap:4px;align-items:center;"><button class="bookmark-btn${isKnown ? ' bookmarked' : ''}" onclick="toggleBookmark('${card.id}', this)" title="Bookmark"><i class="fa-solid fa-bookmark"></i></button><button class="btn-download" onclick="toggleKnown('${card.id}', this)">${isKnown ? 'Known' : 'Mark Known'}</button></div></div>
    <div class="interaction-section"><div class="like-comment-bar"><button class="like-btn" onclick="toggleLike('${card.id}', this)"><i class="fa-regular fa-heart"></i><span>0</span></button><button class="comment-toggle-btn" onclick="toggleCommentForm('${card.id}', this)"><i class="fa-regular fa-comment"></i><span>0</span></button></div>
    <div class="comment-form" id="comment-form-${card.id}" style="display:none;"><input type="text" class="comment-input" placeholder="Add a comment..."><button class="comment-submit-btn" onclick="submitComment('${card.id}', this.previousElementSibling)">Post</button></div>
    <div class="comments-list" id="comments-${card.id}"></div></div>
  </div>`;
}

function attachFlashcardListeners() {
  document.querySelectorAll('.flashcard-deck').forEach(deck => {
    const cardId = deck.dataset.id;
    if (cardId) loadInteractions(cardId);
  });
}

async function loadInteractions(cardId) {
  try {
    const interactions = await apiCall('get_resource_interactions', { resource_id: cardId });
    const deck = document.querySelector(`.flashcard-deck[data-id="${cardId}"]`);
    if (deck && interactions) {
      const likeBtn = deck.querySelector('.like-btn span');
      if (likeBtn) likeBtn.textContent = interactions.like_count || 0;
      const commentBtn = deck.querySelector('.comment-toggle-btn span');
      if (commentBtn) commentBtn.textContent = (interactions.comments?.length || 0);
      const commentsContainer = deck.querySelector('.comments-list');
      if (commentsContainer && interactions.comments) {
        commentsContainer.innerHTML = interactions.comments.map(c => `<div class="comment-item"><strong>${esc(c.user_name || 'User')}:</strong> ${esc(c.comment)}</div>`).join('');
      }
    }
  } catch (e) {}
}

function handleFlashcardKeyboard(e) {
  const deckCards = getCurrentDeckCards();
  if (!deckCards || !deckCards.length) return;
  const flashcardsSection = document.getElementById('flashcards');
  if (!flashcardsSection) return;
  const rect = flashcardsSection.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) return;
  switch (e.key) {
    case 'ArrowRight': e.preventDefault(); navigateCards(1); break;
    case 'ArrowLeft': e.preventDefault(); navigateCards(-1); break;
    case ' ': e.preventDefault(); flipCurrentCard(); break;
    case '1': e.preventDefault(); rateFlashcard('easy'); break;
    case '2': e.preventDefault(); rateFlashcard('medium'); break;
    case '3': e.preventDefault(); rateFlashcard('hard'); break;
  }
}

window.rateFlashcard = async function(difficulty) {
  const cards = getCurrentDeckCards();
  if (!cards || !cards[window.flashcardState.currentCardIndex]) return;
  const card = cards[window.flashcardState.currentCardIndex];
  if (!currentUser) { alert('Sign in to rate flashcards.'); return; }
  try {
    await apiCall('rate_flashcard', { flashcard_id: card.id, difficulty });
    const btns = document.querySelectorAll('.difficulty-btn');
    btns.forEach(b => b.classList.remove('selected'));
    const activeBtn = document.querySelector('.difficulty-btn.' + difficulty);
    if (activeBtn) activeBtn.classList.add('selected');
    setTimeout(() => navigateCards(1), 500);
  } catch (e) { console.error('Rating failed:', e); }
};

window.checkQuizAnswer = async function(cardId, inputElement) {
  if (!currentUser) { alert('Sign in to check answers.'); return; }
  const userAnswer = inputElement.value.trim();
  if (!userAnswer) return;
  const resultDiv = document.getElementById('quiz-result-' + cardId);
  try {
    const result = await apiCall('check_flashcard_answer', { flashcard_id: cardId, user_answer: userAnswer });
    window.flashcardState.quizAnswered = true;
    if (result.correct) {
      resultDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i> Correct!';
      resultDiv.className = 'quiz-result correct';
    } else {
      resultDiv.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Incorrect. Correct answer: ' + esc(result.correct_answer);
      resultDiv.className = 'quiz-result incorrect';
    }
    resultDiv.style.display = 'flex';
    const face = inputElement.closest('.flashcard-deck')?.querySelector('.flashcard-face');
    if (face) { setTimeout(() => face.classList.add('flipped'), 800); }
    setTimeout(() => { navigateCards(1); resultDiv.style.display = 'none'; }, 3000);
  } catch (e) {
    resultDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error checking answer';
    resultDiv.className = 'quiz-result incorrect';
    resultDiv.style.display = 'flex';
  }
};

window.toggleBookmark = async function(cardId, btn) {
  if (!currentUser) { alert('Sign in to bookmark cards.'); return; }
  try {
    const result = await apiCall('toggle_flashcard_bookmark', { flashcard_id: cardId });
    if (result.bookmarked) btn.classList.add('bookmarked');
    else btn.classList.remove('bookmarked');
  } catch (e) {}
};

window.toggleLike = async function(resourceId, btn) {
  if (!currentUser) { alert('Sign in to like.'); return; }
  try {
    const result = await apiCall('like_resource', { resource_id: resourceId });
    const countSpan = btn.querySelector('span');
    countSpan.textContent = result.like_count;
    if (result.liked) {
      btn.classList.add('liked');
      btn.querySelector('i').className = 'fa-solid fa-heart';
    } else {
      btn.classList.remove('liked');
      btn.querySelector('i').className = 'fa-regular fa-heart';
    }
  } catch (e) {}
};

function toggleCommentForm(cardId, btn) {
  const form = document.getElementById('comment-form-' + cardId);
  if (form) form.style.display = form.style.display === 'none' ? 'flex' : 'none';
}

window.submitComment = async function(cardId, inputElement) {
  const comment = inputElement.value.trim();
  if (!comment || !currentUser) return;
  try {
    await apiCall('comment_resource', { resource_id: cardId, comment });
    inputElement.value = '';
    loadComments(cardId);
  } catch (e) {}
};

async function loadComments(cardId) {
  try {
    const interactions = await apiCall('get_resource_interactions', { resource_id: cardId });
    const container = document.getElementById('comments-' + cardId);
    if (container && interactions?.comments) {
      container.innerHTML = interactions.comments.map(c => `<div class="comment-item"><strong>${esc(c.user_name)}:</strong> ${esc(c.comment)}<small style="color:var(--clr-text-muted);">${new Date(c.created_at).toLocaleDateString()}</small></div>`).join('');
    }
  } catch (e) {}
}

window.toggleKnown = async function(id, btn) {
  if (!currentUser) { alert('Sign in to track progress.'); return; }
  try {
    const res = await apiCall('toggle_flashcard_known', { flashcard_id: id });
    btn.textContent = res.known ? 'Known' : 'Mark Known';
    const deck = btn.closest('.flashcard-deck');
    const bookmarkBtn = deck?.querySelector('.bookmark-btn');
    if (bookmarkBtn) bookmarkBtn.classList.toggle('bookmarked', res.known);
  } catch (e) { alert('Error updating.'); }
};

function initPdfLibrary() {
  const levelBtns = document.querySelectorAll('.pdf-level-btn');
  if (levelBtns.length) {
    levelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        levelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.currentPdfLevel = btn.dataset.level;
        window.currentSelectedTopic = null;
        loadPdfsByLevel(window.currentPdfLevel);
      });
    });
  }
  loadPdfsByLevel('O-Level');
}

async function loadPdfsByLevel(level) {
  const cardsArea = document.getElementById('pdf-cards-area');
  if (!cardsArea) return;
  cardsArea.innerHTML = '<div class="pdf-loading">Loading PDFs...</div>';
  try {
    const data = await apiCall('get_pdfs_by_level', { level });
    if (!data || !data.pdfs || data.pdfs.length === 0) {
      cardsArea.innerHTML = '<div class="pdf-loading">No PDFs available for ' + level + ' level.</div>';
      return;
    }
    window.currentPdfs = data.pdfs;
    const uniqueTopics = [...new Set(data.pdfs.map(p => p.topic).filter(t => t))];
    window.currentTopics = uniqueTopics;
    renderTopicsColumn(uniqueTopics);
    const groupedByTopic = {};
    data.pdfs.forEach(pdf => { const topic = pdf.topic || 'General'; if (!groupedByTopic[topic]) groupedByTopic[topic] = []; groupedByTopic[topic].push(pdf); });
    let cardsHtml = '';
    for (const [topic, pdfs] of Object.entries(groupedByTopic)) {
      cardsHtml += `<div class="pdf-topic-group" data-topic="${esc(topic)}"><h4>${esc(topic)}</h4><div class="pdf-cards-grid">`;
      pdfs.forEach(pdf => {
        cardsHtml += `<div class="pdf-card" data-pdf-id="${pdf.id}" data-pdf-title="${esc(pdf.title)}" data-pdf-author="${esc(pdf.author || 'Unknown')}" data-pdf-url="${esc(pdf.file_url)}" data-pdf-topic="${esc(pdf.topic)}"><div class="pdf-card-icon"><i class="fa-solid fa-file-pdf"></i></div><div class="pdf-card-title">${esc(pdf.title.length > 45 ? pdf.title.substring(0, 42) + '...' : pdf.title)}</div><div class="pdf-card-author">${esc(pdf.author || 'Unknown')}</div></div>`;
      });
      cardsHtml += `</div></div>`;
    }
    cardsArea.innerHTML = cardsHtml;
    attachPdfCardEvents();
  } catch (err) { cardsArea.innerHTML = '<div class="pdf-loading">Error loading PDFs.</div>'; }
}

function renderTopicsColumn(topics) {
  const topicsList = document.getElementById('pdf-subtopics-list');
  if (!topicsList) return;
  if (!topics || topics.length === 0) { topicsList.innerHTML = '<p class="pdf-subtopics-placeholder">No topics available</p>'; return; }
  const topicCounts = {};
  window.currentPdfs.forEach(pdf => { const t = pdf.topic || 'General'; topicCounts[t] = (topicCounts[t] || 0) + 1; });
  topicsList.innerHTML = topics.map(topic => `<div class="pdf-subtopic-item" data-topic="${esc(topic)}"><div class="pdf-subtopic-title">${esc(topic)}</div><div class="pdf-subtopic-author">${topicCounts[topic] || 0} resource${topicCounts[topic] !== 1 ? 's' : ''}</div></div>`).join('');
  document.querySelectorAll('.pdf-subtopic-item').forEach(item => {
    item.addEventListener('click', () => {
      const topic = item.dataset.topic;
      window.currentSelectedTopic = topic;
      document.querySelectorAll('.pdf-subtopic-item').forEach(i => i.style.borderColor = 'transparent');
      item.style.borderColor = 'var(--clr-magenta)';
      filterPdfsByTopic(topic);
    });
  });
}

function filterPdfsByTopic(topic) {
  const cardsArea = document.getElementById('pdf-cards-area');
  if (!cardsArea) return;
  const filteredPdfs = window.currentPdfs.filter(pdf => (pdf.topic || 'General') === topic);
  if (!filteredPdfs.length) { cardsArea.innerHTML = '<div class="pdf-loading">No PDFs in this topic.</div>'; return; }
  let cardsHtml = '<div class="pdf-cards-grid">';
  filteredPdfs.forEach(pdf => {
    cardsHtml += `<div class="pdf-card" data-pdf-id="${pdf.id}" data-pdf-title="${esc(pdf.title)}" data-pdf-author="${esc(pdf.author || 'Unknown')}" data-pdf-url="${esc(pdf.file_url)}"><div class="pdf-card-icon"><i class="fa-solid fa-file-pdf"></i></div><div class="pdf-card-title">${esc(pdf.title.length > 45 ? pdf.title.substring(0, 42) + '...' : pdf.title)}</div><div class="pdf-card-author">${esc(pdf.author || 'Unknown')}</div></div>`;
  });
  cardsHtml += '</div>';
  cardsArea.innerHTML = cardsHtml;
  attachPdfCardEvents();
}

function attachPdfCardEvents() {
  document.querySelectorAll('.pdf-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const pdfId = card.dataset.pdfId, pdfTitle = card.dataset.pdfTitle, pdfUrl = card.dataset.pdfUrl, pdfAuthor = card.dataset.pdfAuthor;
      handlePdfCardClick(pdfId, pdfTitle, pdfUrl, pdfAuthor);
    });
  });
}

async function handlePdfCardClick(pdfId, pdfTitle, pdfUrl, pdfAuthor) {
  if (!currentUser) { alert('Please sign in to access PDF resources.'); return; }
  const userChoice = confirm(`📄 ${pdfTitle}\n✍️ ${pdfAuthor}\n\n✅ OK to Preview\n❌ Cancel to Download`);
  if (userChoice) await previewPdf(pdfId, pdfTitle, pdfUrl);
  else await downloadPdf(pdfId, pdfTitle, pdfUrl);
}

async function previewPdf(pdfId, pdfTitle, pdfUrl) {
  try {
    const restriction = await apiCall('check_pdf_restriction', { pdf_id: pdfId, restriction_type: 'preview' });
    if (restriction.is_restricted) { alert(`Preview restricted: ${restriction.reason}`); return; }
    setPdfModalOpen(true);
    document.getElementById('preview-title').textContent = pdfTitle;
    const iframe = document.getElementById('pdf-preview-iframe');
    const previewBody = document.getElementById('pdf-preview-body');
    if (!pdfUrl || pdfUrl === '' || pdfUrl === '/') {
      previewBody.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; background:#f5f5f5;"><i class="fa-solid fa-file-pdf" style="font-size:4rem; color:#e74c3c;"></i><h3 style="margin-top:20px; color:#333;">PDF File Not Available</h3></div>`;
      iframe.style.display = 'none';
    } else {
      iframe.style.display = 'block';
      previewBody.innerHTML = '';
      previewBody.appendChild(iframe);
      iframe.src = pdfUrl;
    }
    document.getElementById('pdf-preview-download-btn').onclick = () => downloadPdf(pdfId, pdfTitle, pdfUrl);
    await apiCall('track_pdf_preview', { pdf_id: pdfId });
  } catch (err) { alert('Failed to load preview: ' + err.message); }
}

async function downloadPdf(pdfId, pdfTitle, pdfUrl) {
  try {
    const restriction = await apiCall('check_pdf_restriction', { pdf_id: pdfId, restriction_type: 'download' });
    if (restriction.is_restricted) { alert(`Download restricted: ${restriction.reason}`); return; }
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = pdfTitle.replace(/[^a-z0-9]/gi, '_') + '.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    await apiCall('track_pdf_download', { pdf_id: pdfId });
    setPdfModalOpen(false);
  } catch (err) { alert('Download failed.'); }
}

async function loadNotesStructure() {
  try {
    const data = await apiCall('get_notes_structure');
    if (!data || !Array.isArray(data)) throw new Error('Invalid notes data');
    window.notesStructureData = data;
  } catch (err) { console.error('loadNotesStructure failed:', err); window.notesStructureData = []; }
}

function renderLevelButtons() {
  const container = document.getElementById('notes-level-buttons');
  if (!container) return;
  if (!window.notesStructureData.length) { container.innerHTML = '<p style="color:var(--clr-text-dim);">No levels available.</p>'; return; }
  const levels = {};
  window.notesStructureData.forEach(item => { if (!item.level) return; levels[item.level] = { level_order: Number(item.level_order) || 999 }; });
  const sortedLevels = Object.entries(levels).sort((a, b) => a[1].level_order - b[1].level_order);
  let html = '';
  sortedLevels.forEach(([levelName]) => {
    const isActive = window.notesCurrentLevel === levelName;
    html += `<button class="level-btn" data-level="${esc(levelName)}" style="background:${isActive ? 'var(--clr-cyan)' : 'transparent'}; border:2px solid ${getLevelColor(levelName)}; color:${isActive ? '#fff' : 'var(--clr-white)'}; padding:8px 24px; border-radius:50px; cursor:pointer; font-weight:600; transition:all 0.2s;">${esc(levelName)}</button>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.dataset.level;
      window.notesCurrentLevel = level;
      window.notesCurrentTopic = null;
      window.notesCurrentSubtopic = null;
      renderLevelButtons();
      renderTopicsForLevel(level);
      document.getElementById('notes-subtopics-container').innerHTML = '';
    });
  });
  if (window.notesCurrentLevel) renderTopicsForLevel(window.notesCurrentLevel);
}

function getLevelColor(level) {
  if (level === 'O-Level') return '#e67e22';
  if (level === 'A-Level') return '#b8873a';
  if (level === 'Pharmacy') return '#0ab5b5';
  return '#888';
}

function renderTopicsForLevel(level) {
  const container = document.getElementById('notes-topics-container');
  if (!container) return;
  const topics = {};
  window.notesStructureData.forEach(item => { if (item.level === level) { if (!topics[item.topic]) topics[item.topic] = { topic_order: Number(item.topic_order) || 999 }; } });
  const sortedTopics = Object.entries(topics).sort((a, b) => a[1].topic_order - b[1].topic_order);
  let html = '<h4 style="color:var(--clr-magenta); margin-bottom:12px; font-size:0.9rem;"><i class="fa-solid fa-folder-tree"></i> Topics</h4><div style="display:flex; flex-wrap:wrap; gap:10px;">';
  sortedTopics.forEach(([topicName]) => {
    const isActive = window.notesCurrentTopic === topicName;
    html += `<button class="topic-btn" data-topic="${esc(topicName)}" style="background:${isActive ? 'var(--clr-magenta)' : 'rgba(184,135,58,0.15)'}; border:1px solid var(--clr-magenta); color:${isActive ? '#fff' : 'var(--clr-magenta)'}; padding:6px 18px; border-radius:50px; cursor:pointer; font-size:0.85rem; transition:all 0.2s;">${esc(topicName)}</button>`;
  });
  html += '</div>';
  container.innerHTML = html;
  container.querySelectorAll('.topic-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const topic = btn.dataset.topic;
      window.notesCurrentTopic = topic;
      window.notesCurrentSubtopic = null;
      renderTopicsForLevel(window.notesCurrentLevel);
      renderSubtopicsForTopic(window.notesCurrentLevel, topic);
    });
  });
  if (window.notesCurrentTopic) renderSubtopicsForTopic(level, window.notesCurrentTopic);
}

function handleReadNote(e) {
  const btn = e.currentTarget;
  const level = btn.getAttribute('data-level');
  const subtopicId = btn.getAttribute('data-subtopic-id');
  const subtopicName = btn.getAttribute('data-subtopic-name');
  let levelPath = '';
  if (level === 'O-Level') levelPath = 'olevel';
  else if (level === 'A-Level') levelPath = 'alevel';
  else if (level === 'Pharmacy') levelPath = 'pharmacy';
  else return;
  window.location.href = `/notes/${levelPath}?subtopic=${subtopicId}&title=${encodeURIComponent(subtopicName)}`;
}

function renderSubtopicsForTopic(level, topic) {
  const subtopics = [];
  window.notesStructureData.forEach(item => { if (item.level === level && item.topic === topic) subtopics.push({ id: item.subtopic_id, name: item.subtopic_name, order: item.subtopic_order }); });
  subtopics.sort((a, b) => a.order - b.order);
  let html = '<h4 style="color:var(--clr-cyan); margin:16px 0 16px 0; font-size:0.9rem;"><i class="fa-solid fa-file-lines"></i> Study Notes</h4><div class="subtopics-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:24px; margin-top:8px;">';
  subtopics.forEach(sub => {
    html += `<div class="subtopic-card" data-subtopic-id="${sub.id}" data-subtopic-name="${esc(sub.name)}" data-level="${level}" style="background:var(--clr-navy-card); border-radius:20px; border:1px solid var(--clr-border-glow); overflow:hidden; transition:all 0.3s ease;">
      <div style="padding:20px;">
        <span class="topic-badge" style="background:rgba(184,135,58,0.12); color:var(--clr-magenta); padding:4px 14px; border-radius:30px; font-size:0.7rem; font-weight:700; text-transform:uppercase; margin-bottom:16px; display:inline-block;">${esc(topic)}</span>
        <h3 style="font-family:'Poppins',sans-serif; font-size:1.3rem; font-weight:700; margin:12px 0 8px; color:var(--clr-white);">${esc(sub.name)}</h3>
        <p class="subtopic-preview" style="color:var(--clr-text-dim); font-size:0.85rem; line-height:1.6; margin-bottom:20px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;"></p>
        <div class="note-meta" style="display:flex; gap:16px; margin-bottom:20px; padding-top:12px; border-top:1px solid var(--clr-border-glow); font-size:0.75rem; color:var(--clr-text-muted);">
          <span><i class="fa-regular fa-clock"></i> 5-10 min read</span>
          <span><i class="fa-regular fa-file-lines"></i> Comprehensive notes</span>
        </div>
        <button class="read-note-btn" data-level="${level}" data-subtopic-id="${sub.id}" data-subtopic-name="${esc(sub.name)}" style="width:100%; background:transparent; border:2px solid var(--clr-cyan); color:var(--clr-cyan); padding:12px 20px; border-radius:50px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;"><i class="fa-solid fa-book-open-reader"></i> Read Full Note</button>
      </div>
    </div>`;
  });
  html += '</div>';
  document.getElementById('notes-subtopics-container').innerHTML = html;
  document.querySelectorAll('.read-note-btn').forEach(btn => { btn.removeEventListener('click', handleReadNote); btn.addEventListener('click', handleReadNote); });
}

async function loadNoteContentDirect(subtopicId, level, topic, subtopic) {
  const container = document.getElementById('notes-container');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading notes...</div>';
  try {
    const data = await apiCall('get_note_content', { subtopic_id: subtopicId });
    const contentHtml = `<div class="notes-content-container" style="padding:24px; background:var(--clr-navy-card); border-radius:16px; animation:slideIn 0.3s ease;">
      <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div><span style="font-size:0.8rem; color:var(--clr-text-muted);">${esc(level)} / ${esc(topic)}</span><h1 style="font-family:var(--font-display); font-size:1.8rem; color:var(--clr-white); margin-top:8px;">${esc(subtopic)}</h1></div>
        <div style="display:flex; gap:8px;"><button class="btn-download" onclick="downloadNoteAsPDF()" style="background:var(--clr-cyan);"><i class="fa-solid fa-download"></i> Save as PDF</button></div>
      </div>
      <div id="note-rendered-content">${data?.content || '<p>No content available for this note.</p>'}</div>
      <div class="notes-reaction-bar" data-note-id="${subtopicId}" style="display:flex; gap:16px; margin-top:24px; padding-top:20px; border-top:2px solid var(--clr-border-glow);">
        <button class="reaction-btn" data-reaction="like" onclick="toggleNoteReaction('${subtopicId}', 'like')"><i class="fa-regular fa-thumbs-up"></i> <span class="reaction-count">0</span></button>
        <button class="reaction-btn" data-reaction="love" onclick="toggleNoteReaction('${subtopicId}', 'love')"><i class="fa-regular fa-heart"></i> <span class="reaction-count">0</span></button>
        <button class="reaction-btn" data-reaction="helpful" onclick="toggleNoteReaction('${subtopicId}', 'helpful')"><i class="fa-regular fa-lightbulb"></i> <span class="reaction-count">0</span></button>
      </div>
      <div class="comment-section" style="margin-top:20px;">
        <div class="comment-input-group" style="display:flex; gap:8px; margin-bottom:16px;"><input type="text" id="comment-input-${subtopicId}" placeholder="Add a comment or question..." style="flex:1; padding:10px 16px; border-radius:30px; border:1px solid var(--clr-border-glow); background:var(--clr-navy-card); color:var(--clr-white);"><button class="btn-primary" onclick="submitNoteComment('${subtopicId}')" style="padding:8px 20px;">Post</button></div>
        <div class="comment-list" id="comments-${subtopicId}" style="max-height:200px; overflow-y:auto;"></div>
      </div>
    </div>`;
    container.innerHTML = contentHtml;
    loadNoteReactions(subtopicId);
    loadNoteComments(subtopicId);
  } catch (err) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--clr-magenta);">Failed to load note content.</div>'; }
}

window.toggleNoteReaction = async function(noteId, reactionType) {
  if (!currentUser) { alert('Please sign in to react.'); return; }
  try {
    await apiCall('toggle_note_reaction', { note_id: noteId, reaction_type: reactionType });
    loadNoteReactions(noteId);
  } catch (e) {}
};

async function loadNoteReactions(noteId) {
  try {
    const data = await apiCall('get_note_reactions', { note_id: noteId });
    const bar = document.querySelector(`.notes-reaction-bar[data-note-id="${noteId}"]`);
    if (bar) {
      bar.querySelector('.reaction-btn[data-reaction="like"] .reaction-count').textContent = data.counts.like || 0;
      bar.querySelector('.reaction-btn[data-reaction="love"] .reaction-count').textContent = data.counts.love || 0;
      bar.querySelector('.reaction-btn[data-reaction="helpful"] .reaction-count').textContent = data.counts.helpful || 0;
      bar.querySelectorAll('.reaction-btn').forEach(b => b.style.background = (b.dataset.reaction === data.user_reaction) ? 'linear-gradient(135deg, #e67e22, #b8873a)' : 'none');
    }
  } catch (e) {}
}

window.submitNoteComment = async function(noteId) {
  if (!currentUser) { alert('Please sign in to comment.'); return; }
  const input = document.getElementById(`comment-input-${noteId}`);
  const comment = input.value.trim();
  if (!comment) return;
  try {
    await apiCall('comment_resource', { resource_id: noteId, comment });
    input.value = '';
    loadNoteComments(noteId);
  } catch (e) {}
};

async function loadNoteComments(noteId) {
  try {
    const interactions = await apiCall('get_resource_interactions', { resource_id: noteId });
    const container = document.getElementById(`comments-${noteId}`);
    if (container) {
      if (!interactions.comments || interactions.comments.length === 0) { container.innerHTML = '<div style="text-align:center; color:var(--clr-text-muted); padding:20px;">No comments yet. Be the first!</div>'; }
      else { container.innerHTML = interactions.comments.map(c => `<div class="comment-item"><strong>${esc(c.user_name)}:</strong> ${esc(c.comment)}<small>${new Date(c.created_at).toLocaleDateString()}</small></div>`).join(''); }
    }
  } catch (e) {}
}

window.downloadNoteAsPDF = function() {
  const contentDiv = document.getElementById('note-rendered-content');
  if (!contentDiv) return;
  const win = window.open();
  win.document.write(`<html><head><title>${document.querySelector('.notes-content-container h1')?.innerText || 'Note'}</title></head><body>${contentDiv.innerHTML}</body></html>`);
  win.document.close();
  win.print();
};

async function loadCommunityActivity() {
  const container = document.getElementById('community-stream');
  if (!container) return;
  try {
    const activities = await apiCall('get_community_activity');
    if (!activities || !activities.length) { container.innerHTML = '<p style="text-align:center;color:var(--clr-text-dim);">No recent activity.</p>'; return; }
    container.innerHTML = activities.map(a => `<div class="stream-item"><i class="fa-solid fa-${a.type === 'download' ? 'download' : 'graduation-cap'}" style="color:var(--clr-cyan);"></i><span>${esc(a.message)}</span><small style="margin-left:auto;color:var(--clr-text-muted);">${new Date(a.time).toLocaleDateString()}</small></div>`).join('');
  } catch (e) { container.innerHTML = '<p style="text-align:center;color:var(--clr-magenta);">Could not load stream.</p>'; }
}

async function loadContinueLearning() {
  if (!currentUser) return;
  const section = document.getElementById('continue-learning');
  if (!section) return;
  section.style.display = 'block';
  section.innerHTML = '<span class="sec-label">YOUR JOURNEY</span><h2 class="section-title">Continue Learning</h2><div class="continue-learning-grid" id="continue-grid">Loading...</div>';
  const grid = document.getElementById('continue-grid');
  try {
    const results = await Promise.allSettled([apiCall('get_recent_views', { limit: 3 }), apiCall('get_user_favorites'), apiCall('get_user_streak'), apiCall('get_user_achievements')]);
    let html = '';
    const v = results[0].value || [], f = results[1].value || [], s = results[2].value || { count: 0 }, a = results[3].value || [];
    if (s && s.count > 0) html += `<div class="continue-card"><i class="fa-solid fa-fire" style="color:var(--clr-magenta);"></i> <strong>${s.count}-Day Streak</strong><p style="font-size:0.8rem;">Keep it up!</p></div>`;
    if (v && v.length) html += `<div class="continue-card"><strong>Recent Views</strong><ul style="list-style:none;margin-top:0.4rem;">${v.map(r => `<li><a href="#" style="color:var(--clr-cyan);text-decoration:none;">${esc(r.title || 'Resource')}</a></li>`).join('')}</ul></div>`;
    if (f && f.length) html += `<div class="continue-card"><strong>Favorites</strong><ul style="list-style:none;margin-top:0.4rem;">${f.slice(0, 3).map(r => `<li>${esc(r.title || 'Resource')}</li>`).join('')}</ul></div>`;
    if (a && a.length) html += `<div class="continue-card"><strong>Achievements</strong><div style="display:flex;gap:0.5rem;margin-top:0.4rem;">${a.map(b => `<span title="${esc(b.badge)}" style="font-size:1.4rem;">🏅</span>`).join('')}</div></div>`;
    grid.innerHTML = html || '<p style="color:var(--clr-text-dim);">Complete quizzes and download resources to build your journey.</p>';
  } catch (e) { grid.innerHTML = '<p style="color:var(--clr-magenta);">Could not load your data.</p>'; }
}

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const siteData = useSiteData();
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  window.homePageSetPdfModalOpen = setPdfModalOpen;
  window.currentUser = user;
  window.isAuthenticated = isAuthenticated;

  useHomePageEffects(siteData, isAuthenticated);

  return (
    <>
      <section id="home" className="hero-carousel" aria-label="Hero carousel">
        <div className="carousel-slide active" style={{ background: 'linear-gradient(135deg,#0a4f4f,#0e7070)' }}>
          <div className="slide-overlay">
            <h1 className="font-display font-black text-4xl md:text-6xl mb-4 hero-title">Welcome to AliverBiopharm</h1>
            <p className="text-lg md:text-xl max-w-2xl mb-8 hero-subtitle">Advanced Biology & Pharmacy Learning Platform</p>
            <a href="#courses" className="btn-primary"><i className="fa-solid fa-arrow-right" aria-hidden="true"></i> Explore Resources</a>
          </div>
        </div>
      </section>

      <section id="hero-title-section" className="section reveal" style={{ paddingTop: '20px', paddingBottom: '0' }} aria-label="AliverBiopharm Hero Title">
        <div className="dynamic-hero-container" id="dynamic-hero-container">
          <h1 className="dynamic-main-title" id="dynamic-main-title">
            <span className="title-word magenta-word">Aliver</span>
            <span className="title-word cyan-word">Biopharm</span>
          </h1>
          <div className="title-sub-line" id="title-sub-line">
            <span className="sub-word">Advanced</span>
            <span className="sub-word">Biology</span>
            <span className="sub-word magenta-word">&amp;</span>
            <span className="sub-word cyan-word">Pharmacy</span>
            <span className="sub-word">Learning</span>
            <span className="sub-word">Platform</span>
          </div>
        </div>
      </section>

      <section id="daily-fact" className="section reveal" style={{ paddingTop: '30px', paddingBottom: '30px' }} aria-label="Daily fact and weekly challenge"></section>

      <section id="mood-check" className="section reveal" style={{ paddingTop: '20px', paddingBottom: '20px' }} aria-label="How are you feeling?">
        <div className="mood-section">
          <h3 style={{ textAlign: 'center', color: 'var(--clr-white)', marginBottom: '.5rem' }}><i className="fa-solid fa-face-smile" style={{ color: 'var(--clr-magenta)' }}></i> How are you feeling about your studies?</h3>
          <div className="mood-emojis" id="mood-emojis">
            <button className="mood-emoji" data-mood="struggling" title="Struggling">😭</button>
            <button className="mood-emoji" data-mood="confused" title="Confused">🤔</button>
            <button className="mood-emoji" data-mood="okay" title="Okay">😐</button>
            <button className="mood-emoji" data-mood="good" title="Good">😊</button>
            <button className="mood-emoji" data-mood="great" title="Great!">🚀</button>
          </div>
          <div id="mood-message-form" style={{ display: 'none', textAlign: 'center' }}>
            <textarea id="mood-message" placeholder="Tell us more (optional)..." style={{ width: '100%', maxWidth: '400px', padding: '8px', borderRadius: '10px', border: '1px solid var(--clr-border-glow)', background: 'rgba(10,181,181,.05)', color: 'var(--clr-white)', resize: 'vertical', minHeight: '60px', fontFamily: 'var(--font-body)', fontSize: '.85rem' }}></textarea>
            <br />
            <button className="btn-primary" id="mood-submit-btn" style={{ marginTop: '8px', fontSize: '.8rem', padding: '8px 20px' }}>Submit <i className="fa-solid fa-paper-plane"></i></button>
          </div>
          <div id="mood-response" style={{ textAlign: 'center', color: 'var(--clr-cyan)', marginTop: '8px', display: 'none' }}></div>
        </div>
      </section>

      <section id="continue-learning" className="section reveal" style={{ display: isAuthenticated ? 'block' : 'none' }} aria-label="Continue learning"></section>

      <section id="team" className="section reveal" aria-label="Faculty">
        <span className="sec-label">FACULTY</span>
        <h2 className="section-title">Meet Our Expert Faculty</h2>
        <p className="section-subtitle">Learn from distinguished pharmacologists and molecular biologists.</p>
        <div className="grid-3" id="team-grid"><p style={{ textAlign: 'center', gridColumn: '1/-1', color: 'var(--clr-text-dim)' }}>Loading…</p></div>
      </section>

      <section id="testimonials" className="section alt-bg reveal" aria-label="Testimonials">
        <span className="sec-label">TESTIMONIALS</span>
        <h2 className="section-title">Learner Success Stories</h2>
        <p className="section-subtitle">Hear from students who transformed their understanding of biology and pharmacy.</p>
        <div className="testimonial-slider" id="testimonial-slider">Loading…</div>
      </section>

      <section id="courses" className="section reveal" aria-label="Learning resources">
        <span className="sec-label">LEARNING TOOLS</span>
        <h2 className="section-title">Learning Resources</h2>
        <p className="section-subtitle">Browse our comprehensive library of biology and pharmacy materials. Download notes, past papers, lab manuals, and study guides curated by subject experts.</p>
        <div className="filter-bar">
          <div className="filter-bar-inner">
            <button className="filter-toggle-btn" id="filter-toggle-btn" aria-expanded="false"><i className="fa-solid fa-filter" aria-hidden="true"></i> Filter Resources <i className="fa-solid fa-chevron-down" id="filter-chevron" aria-hidden="true"></i></button>
            <div className="filter-dropdown" id="filter-dropdown" style={{ display: 'none' }}>
              <input type="text" className="f-input" id="resource-search" placeholder="Search resources..." aria-label="Search resources" />
              <div className="filter-accordion">
                <button className="filter-accordion-btn" data-filter="level" aria-expanded="false"><span>Level</span><span className="filter-selected" id="selected-level">All Levels</span><i className="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
                <div className="filter-options" id="filter-options-level">
                  <label className="filter-option"><input type="radio" name="level" value="" defaultChecked /> All Levels</label>
                  <label className="filter-option"><input type="radio" name="level" value="O-Level" /> O-Level</label>
                  <label className="filter-option"><input type="radio" name="level" value="A-Level" /> A-Level</label>
                  <label className="filter-option"><input type="radio" name="level" value="Pharmacy" /> Pharmacy</label>
                </div>
              </div>
              <div className="filter-accordion">
                <button className="filter-accordion-btn" data-filter="category" aria-expanded="false"><span>Category</span><span className="filter-selected" id="selected-category">All Categories</span><i className="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
                <div className="filter-options" id="filter-options-category">
                  <label className="filter-option"><input type="radio" name="category" value="" defaultChecked /> All Categories</label>
                </div>
              </div>
              <button className="btn-primary" id="filter-apply">Apply Filters</button>
              <button className="filter-clear-btn" id="filter-clear">Clear All</button>
            </div>
          </div>
        </div>
        <div id="resources-container">Loading resources…</div>
      </section>

      <section id="flashcards" className="section reveal" aria-label="Flashcards">
        <span className="sec-label">STUDY TOOLS</span>
        <h2 className="section-title">Flashcard Decks</h2>
        <p className="section-subtitle">Active recall is the most effective way to retain complex scientific concepts. Flip each card to reveal detailed answers and mark your progress.</p>
        <div className="flashcard-filter" id="flashcard-filter">
          <i className="fa-solid fa-filter" style={{ color: 'var(--clr-cyan)' }}></i>
          <label htmlFor="level-select">Filter by Level:</label>
          <select id="level-select" aria-label="Filter flashcards by level">
            <option value="">All Levels</option>
            <option value="O-Level">O-Level</option>
            <option value="A-Level">A-Level</option>
            <option value="Pharmacy">Pharmacy</option>
          </select>
          <span id="deck-count" style={{ fontSize: '.8rem', color: 'var(--clr-text-muted)', marginLeft: 'auto' }}></span>
        </div>
        <div className="mode-toggle" id="mode-toggle">
          <button className="mode-btn active" data-mode="study"><i className="fa-solid fa-eye"></i> Study Mode</button>
          <button className="mode-btn" data-mode="quiz"><i className="fa-solid fa-pen-to-square"></i> Quiz Mode</button>
          <button style={{ marginLeft: 'auto' }} className="shuffle-btn" id="shuffle-btn"><i className="fa-solid fa-shuffle"></i> Shuffle</button>
        </div>
        <div id="flashcards-container"></div>
        <p className="keyboard-hint"><i className="fa-regular fa-keyboard"></i> Keyboard: ← → navigate | Space flip | 1-3 rate difficulty</p>
      </section>

      <section id="pdf-library" className="section reveal" aria-label="PDF Library" style={{ margin: '60px 0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px', paddingLeft: '20px' }}>
            <span className="sec-label" style={{ textAlign: 'left', marginBottom: '8px', display: 'block' }}>PDF RESOURCES</span>
            <h2 className="pdf-section-title" style={{ fontFamily: "'Poppins',sans-serif", fontSize: 'clamp(2rem,5vw,3rem)', margin: 0, background: 'linear-gradient(135deg, #e67e22, #b8873a, #0ab5b5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textAlign: 'left' }}>Study Materials Library</h2>
            <p className="section-subtitle" style={{ textAlign: 'left', margin: '8px 0 0 0', maxWidth: '600px' }}>Access comprehensive PDF resources for Biology and Pharmacy. Preview before downloading.</p>
          </div>
          <div className="pdf-main-container" id="pdf-main-container" style={{ background: 'var(--clr-navy-card)', backdropFilter: 'blur(12px)', borderRadius: '20px', overflow: 'hidden' }}>
            <div className="pdf-level-bar" id="pdf-level-bar" style={{ display: 'flex', justifyContent: 'center', gap: '16px', padding: '20px 20px 16px 20px', borderBottom: '1px solid var(--clr-border-glow)', background: 'rgba(0,0,0,0.02)' }}>
              <button className="pdf-level-btn active" data-level="O-Level" style={{ padding: '10px 28px', borderRadius: '50px', fontFamily: 'var(--font-body)', fontWeight: '700', fontSize: '0.9rem', background: 'var(--gradient-magenta)', border: 'none', color: '#fff', cursor: 'pointer' }}>O-Level</button>
              <button className="pdf-level-btn" data-level="A-Level" style={{ padding: '10px 28px', borderRadius: '50px', fontFamily: 'var(--font-body)', fontWeight: '700', fontSize: '0.9rem', background: 'transparent', border: '2px solid var(--clr-border-glow)', color: 'var(--clr-white)', cursor: 'pointer' }}>A-Level</button>
              <button className="pdf-level-btn" data-level="Pharmacy" style={{ padding: '10px 28px', borderRadius: '50px', fontFamily: 'var(--font-body)', fontWeight: '700', fontSize: '0.9rem', background: 'transparent', border: '2px solid var(--clr-border-glow)', color: 'var(--clr-white)', cursor: 'pointer' }}>Pharmacy</button>
            </div>
            <div className="pdf-content-wrapper" id="pdf-content-wrapper" style={{ display: 'flex', minHeight: '520px' }}>
              <div className="pdf-cards-area" id="pdf-cards-area" style={{ flex: 1, padding: '20px', overflowY: 'auto', maxHeight: '600px' }}><div className="pdf-loading">Loading PDFs...</div></div>
              <div className="pdf-subtopics-column" id="pdf-subtopics-column" style={{ width: '280px', minWidth: '280px', background: 'rgba(0,0,0,0.03)', borderLeft: '1px solid var(--clr-border-glow)', display: 'flex', flexDirection: 'column' }}>
                <div className="pdf-subtopics-header" style={{ padding: '18px 16px', fontFamily: "'Poppins',sans-serif", fontSize: '0.85rem', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--clr-magenta)', borderBottom: '2px solid var(--clr-magenta)', textAlign: 'center', background: 'rgba(0,0,0,0.02)' }}>Browse Topics</div>
                <div className="pdf-subtopics-list" id="pdf-subtopics-list" style={{ flex: 1, overflowY: 'auto', padding: '12px', maxHeight: '540px' }}><p className="pdf-subtopics-placeholder" style={{ textAlign: 'center', color: 'var(--clr-text-dim)', fontSize: '0.85rem', padding: '30px 20px' }}>Select a level to view topics</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {pdfModalOpen && (
        <div id="pdf-preview-modal" className="pdf-preview-modal active">
          <div className="pdf-preview-content">
            <div className="pdf-preview-header"><h3 id="preview-title">Loading...</h3><button className="pdf-preview-close" id="pdf-preview-close" onClick={() => setPdfModalOpen(false)}>&times;</button></div>
            <div className="pdf-preview-body" id="pdf-preview-body"><iframe id="pdf-preview-iframe" src="about:blank" frameBorder="0"></iframe></div>
            <div className="pdf-preview-footer">
              <button className="pdf-preview-download-btn" id="pdf-preview-download-btn">Download PDF</button>
              <button className="pdf-preview-back-btn" id="pdf-preview-back-btn" onClick={() => setPdfModalOpen(false)}>Back to Library</button>
            </div>
          </div>
        </div>
      )}

      <section id="notes-section" className="section-wrapper" style={{ margin: '60px 0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px', paddingLeft: '20px' }}>
            <span className="sec-label" style={{ textAlign: 'left', marginBottom: '8px', display: 'block' }}>STUDY NOTES</span>
            <h2 className="pdf-section-title" style={{ fontFamily: "'Poppins',sans-serif", fontSize: 'clamp(2rem,5vw,3rem)', margin: 0, background: 'linear-gradient(135deg, #e67e22, #b8873a, #0ab5b5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textAlign: 'left' }}>Notes Library</h2>
            <p className="section-subtitle" style={{ textAlign: 'left', margin: '8px 0 0 0', maxWidth: '600px' }}>Comprehensive study notes for Biology and Pharmacy. Structured by level, topic, and subtopic for easy learning.</p>
          </div>
          <div style={{ background: 'var(--clr-navy-card)', backdropFilter: 'blur(12px)', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <button id="notes-main-filter-btn" className="btn-primary" style={{ background: 'linear-gradient(135deg, #e67e22, #b8873a, #0ab5b5)', padding: '8px 20px', borderRadius: '50px', fontWeight: '700', fontSize: '0.85rem' }}><i className="fa-solid fa-filter"></i> Browse Notes by Level</button>
              </div>
              <div id="notes-filter-area" style={{ display: 'none', marginBottom: '20px' }}>
                <div id="notes-level-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}></div>
                <div id="notes-topics-container" style={{ marginBottom: '20px' }}></div>
                <div id="notes-subtopics-container"></div>
              </div>
              <div id="notes-content-area" style={{ minHeight: '300px' }}>
                <div id="notes-container" style={{ maxHeight: '600px', overflowY: 'auto', transition: 'all 0.3s ease' }}>
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--clr-text-dim)' }}>
                    <i className="fa-solid fa-book-open" style={{ fontSize: '3rem', marginBottom: '16px', display: 'block' }}></i>
                    Click "Browse Notes by Level" to start learning
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="community" className="section alt-bg reveal" aria-label="Community stream">
        <span className="sec-label">COMMUNITY</span>
        <h2 className="section-title">Live Learning Stream</h2>
        <div className="community-stream" id="community-stream">Loading activity…</div>
      </section>

      <section id="pricing" className="section alt-bg reveal" aria-label="Pricing">
        <span className="sec-label">MEMBERSHIP</span>
        <h2 className="section-title">Membership Plans</h2>
        <p className="section-subtitle">Choose the plan that fits your learning journey. All plans include access to our complete resource library with regular updates.</p>
        <div className="grid-3" id="pricing-grid"></div>
      </section>

      <section id="stats" className="section reveal" aria-label="Statistics">
        <span className="sec-label">IMPACT</span>
        <h2 className="section-title">Our Impact in Numbers</h2>
        <div className="stats-grid" id="stats-grid"></div>
      </section>

      <section id="blog" className="section alt-bg reveal" aria-label="Blog">
        <span className="sec-label">INSIGHTS</span>
        <h2 className="section-title">Latest Articles & Insights</h2>
        <p className="section-subtitle">Stay informed with the latest developments in biology, pharmacy, and life sciences from our expert contributors.</p>
        <div className="grid-3" id="blog-grid"></div>
      </section>

      <section id="faq" className="section reveal" aria-label="FAQ">
        <span className="sec-label">FAQ</span>
        <h2 className="section-title">Frequently Asked Questions</h2>
        <p className="section-subtitle">Quick answers to common questions about our platform, courses, resources, and membership options.</p>
        <div className="faq-list" id="faq-list"></div>
      </section>

      <section id="contact" className="section alt-bg reveal" aria-label="Contact">
        <span className="sec-label">SUPPORT</span>
        <h2 className="section-title">Get in Touch</h2>
        <p className="section-subtitle">Have questions or feedback? Our support team typically responds within 24 hours.</p>
        <div className="grid-2">
          <form id="contact-form" noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div><label className="f-label" htmlFor="contact-name">FULL NAME</label><input type="text" className="f-input" id="contact-name" placeholder="Your full name" required autoComplete="name" /></div>
            <div><label className="f-label" htmlFor="contact-email">EMAIL ADDRESS</label><input type="email" className="f-input" id="contact-email" placeholder="you@institution.edu" required autoComplete="email" /></div>
            <div><label className="f-label" htmlFor="contact-subject">SUBJECT</label><input type="text" className="f-input" id="contact-subject" placeholder="Subject" required /></div>
            <div><label className="f-label" htmlFor="contact-message">MESSAGE</label><textarea className="f-input" id="contact-message" placeholder="Your message" style={{ minHeight: '110px', resize: 'vertical' }} required></textarea></div>
            <button type="submit" className="f-btn"><i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Send Message</button>
            <div id="form-success" style={{ color: 'var(--clr-cyan)', textAlign: 'center', display: 'none', fontSize: '.875rem' }}></div>
            <div id="form-error" style={{ color: '#e74c3c', textAlign: 'center', display: 'none', fontSize: '.875rem' }}></div>
          </form>
          <aside className="contact-info-card" id="contact-info-card">
            <div className="text-center mb-4"><i className="fa-solid fa-headset text-4xl" style={{ color: 'var(--clr-cyan)' }} aria-hidden="true"></i><h3 style={{ color: 'var(--clr-white)', marginTop: '.5rem', fontSize: '1.1rem', fontWeight: '600' }}>24/7 Support</h3></div>
          </aside>
        </div>
      </section>

      <section className="section reveal" aria-label="Newsletter">
        <span className="sec-label">UPDATES</span>
        <h2 className="section-title">Stay Updated</h2>
        <p className="section-subtitle">Join our community of learners. Get weekly insights, study tips, and new resource alerts delivered to your inbox.</p>
        <form id="newsletter-form">
          <div className="newsletter-box">
            <input type="email" placeholder="Enter your email address" required autoComplete="email" aria-label="Email for newsletter" />
            <button type="submit">Subscribe <i className="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
          </div>
        </form>
      </section>

      <button className="back-to-top" id="back-to-top" aria-label="Back to top"><i className="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
      <a href="#pricing" className="sticky-cta"><i className="fa-solid fa-rocket" aria-hidden="true"></i> Start Learning</a>
      <div className="resource-modal-overlay" id="resource-modal-overlay" aria-hidden="true">
        <div className="resource-modal" id="resource-modal" role="dialog" aria-label="Resource details">
          <button className="resource-modal-close" id="resource-modal-close" aria-label="Close modal">✕</button>
          <div id="resource-modal-content"></div>
        </div>
      </div>
    </>
  );
}
