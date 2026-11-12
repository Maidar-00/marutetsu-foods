/* ============================================
   Marutetsu site — content renderer + motion
   Reads /api/content and fills every page,
   then applies classic, refined animations.
   ============================================ */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  const KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let CONTENT = null;

  /* ========================= header / footer ========================= */

  function buildNavLinks() {
    const items = (CONTENT.nav || []).map(
      (n) => `<li><a href="${esc(n.url)}">${esc(n.label)}</a></li>`
    );
    (CONTENT.customPages || [])
      .filter((p) => p.showInNav)
      .forEach((p) =>
        items.push(`<li><a href="/page/${esc(p.slug)}">${esc(p.title)}</a></li>`)
      );
    return items.join('');
  }

  function renderHeader() {
    const s = CONTENT.site;
    $('#site-header').innerHTML = `
      <div class="header-inner">
        <a class="logo" href="/">
          <img class="logo-mark" src="/images/logo-m.png" alt="MARUTETSU" width="72" height="42">
          <span class="logo-text">
            <span class="ja">マルテツフーズ</span>
            <span class="en">${esc(s.companyNameEn)}</span>
          </span>
        </a>
        <div class="header-right">
          <nav class="gnav" id="gnav"><ul>${buildNavLinks()}</ul></nav>
          <div class="header-phone">
            <span class="label">CONTACT</span>
            <a class="number" href="tel:${esc(String(s.phone).replace(/-/g, ''))}">${esc(s.phone)}</a>
          </div>
          <button class="nav-toggle" id="nav-toggle" aria-label="menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>`;

    const toggle = $('#nav-toggle'), nav = $('#gnav');
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      nav.classList.toggle('open');
    });
    $$('#gnav a').forEach((a) =>
      a.addEventListener('click', () => {
        toggle.classList.remove('open');
        nav.classList.remove('open');
      })
    );
  }

  function renderFooter() {
    const s = CONTENT.site;
    const sitemap =
      `<li><a href="/">ホーム</a></li>` +
      (CONTENT.nav || [])
        .map((n) => `<li><a href="${esc(n.url)}">${esc(n.label)}</a></li>`)
        .join('') +
      (CONTENT.customPages || [])
        .filter((p) => p.showInNav)
        .map((p) => `<li><a href="/page/${esc(p.slug)}">${esc(p.title)}</a></li>`)
        .join('');

    const business =
      ((CONTENT.businessPage && CONTENT.businessPage.cards) || [])
        .map((c) => `<li><a href="/business">${esc(c.title)}</a></li>`)
        .join('');

    $('#site-footer').innerHTML = `
      <div class="footer-top">
        <div class="container footer-cta">
          <div>
            <span class="label">CONTACT</span>
            <span class="title">お問い合わせ</span>
          </div>
          <a class="btn" href="/contact">お問い合わせはこちら</a>
        </div>
      </div>
      <div class="container footer-columns">
        <div class="footer-company">
          <div class="name">${esc(s.companyName)}</div>
          <p>${esc(s.address)}<br>受付時間 ${esc(s.hours)}<br>TEL. <a href="tel:${esc(String(s.phone).replace(/-/g, ''))}" style="color:#fff">${esc(s.phone)}</a></p>
        </div>
        <div class="footer-col">
          <h4>SITEMAP</h4>
          <ul>${sitemap}</ul>
        </div>
        <div class="footer-col">
          <h4>BUSINESS</h4>
          <ul>${business}</ul>
        </div>
      </div>
      <div class="container footer-bottom">
        <small>${esc(s.copyright)}</small>
        <a href="/admin">管理画面</a>
      </div>`;
  }

  /* ============================= helpers ============================= */

  function sectionHead(en, title, lead) {
    return `
      <div class="section-head section-head-bar reveal">
        <span class="section-en">${esc(en)}</span>
        <h2 class="section-title">${esc(title)}</h2>
        ${lead ? `<p class="section-lead">${esc(lead)}</p>` : ''}
        <span class="diamond"></span>
      </div>`;
  }

  function pageHero(en, title, image) {
    return `
      <div class="page-hero" data-parallax>
        <img src="${esc(image)}" alt="">
        <div class="page-hero-inner">
          <div class="page-hero-en">${esc(en)}</div>
          <h1 class="page-hero-title">${esc(title)}</h1>
          <div class="page-hero-rule"></div>
        </div>
      </div>`;
  }

  function cardNum(i) {
    return '0' + (i + 1);
  }

  /* ============================== pages ============================= */

  function renderHome() {
    const h = CONTENT.home, s = CONTENT.site;

    // hero
    $('.hero').innerHTML = `
      <img src="${esc(s.heroImage)}" alt="">
      <div class="hero-inner">
        <p class="hero-en">${esc(s.companyNameEn)}</p>
        <h1 class="hero-tagline" id="hero-tagline">${esc(s.tagline)}</h1>
        <p class="hero-title">${esc(s.heroTitle)}</p>
        <a class="hero-cta" href="/contact">お問い合わせ</a>
      </div>
      <div class="hero-vertical">MARUTETSU FOODS COMPANY</div>
      <div class="hero-scroll"><span class="txt">SCROLL</span><span class="line"></span></div>`;

    // philosophy
    const ph = h.philosophy;
    $('#philosophy').innerHTML = sectionHead(ph.en, ph.title, ph.lead) + `
      <div class="container">
        <div class="photo-grid" data-stagger>
          ${(ph.images || []).map((im) => `
            <figure>
              <img src="${esc(im.src)}" alt="${esc(im.caption || '')}">
              <figcaption>${esc(im.caption || '')}</figcaption>
            </figure>`).join('')}
        </div>
      </div>`;

    // business
    const bu = h.business;
    $('#business').innerHTML = sectionHead(bu.en, bu.title) + `
      <div class="container">
        <div class="card-grid" data-stagger>
          ${(bu.cards || []).map((c, i) => `
            <a class="card" href="${esc(c.url || '/business')}">
              <div class="card-img-wrap">
                <span class="card-num">${cardNum(i)}</span>
                <img src="${esc(c.image)}" alt="${esc(c.title)}">
              </div>
              <div class="card-body">
                <div class="card-title">${esc(c.title)}</div>
                <div class="card-text">${esc(c.text)}</div>
                <span class="card-link">READ MORE <span class="arrow">→</span></span>
              </div>
            </a>`).join('')}
        </div>
      </div>`;

    // message
    const m = h.message;
    $('#message').innerHTML = sectionHead(m.en, m.title) + `
      <div class="container">
        <div class="message-wrap">
          <div class="message-photo reveal reveal-l"><img src="${esc(m.image)}" alt="${esc(m.name)}"></div>
          <div class="message-body reveal reveal-r">
            <span class="msg-kanji">挨拶</span>
            <div class="role">${esc(m.role)}</div>
            <div class="name">${esc(m.name)}</div>
            <p class="text">${esc(m.text)}</p>
            <a class="message-more" href="${esc(m.linkUrl || '/company')}">${esc(m.linkLabel || '会社情報を見る')}</a>
          </div>
        </div>
      </div>`;

    // quality
    const q = h.quality;
    $('#quality').innerHTML = sectionHead(q.en, q.title, q.lead) + `
      <div class="container">
        <div class="quality-grid" data-stagger>
          ${(q.blocks || []).map((b, i) => `
            <div class="quality-block">
              <span class="quality-num">${esc(KANJI[i] || cardNum(i))}</span>
              <div class="quality-title">${esc(b.title)}</div>
              <p class="quality-text">${esc(b.text)}</p>
            </div>`).join('')}
        </div>
      </div>`;

    // news
    const nw = h.news;
    const latest = (CONTENT.news || []).slice(0, 3);
    $('#news').innerHTML = sectionHead(nw.en, nw.title) + `
      <div class="container">
        <div class="news-list">
          ${latest.map((n) => `
            <a class="news-item" href="/news">
              <span class="news-date">${esc(n.date)}</span>
              <span class="news-title">${esc(n.title)}</span>
            </a>`).join('') || '<p class="section-lead" style="text-align:center">お知らせはまだありません。</p>'}
        </div>
        <div class="more-link"><a href="${esc(nw.linkUrl || '/news')}">${esc(nw.linkLabel || '一覧を見る')}</a></div>
      </div>`;

    // recruit
    const r = h.recruit;
    $('#recruit').innerHTML = sectionHead(r.en, r.title) + `
      <div class="container recruit-banner">
        <div class="frame-box reveal">
          <span class="fb-en">NOW HIRING</span>
          <span class="fb-title">${esc(r.text)}</span>
        </div>
        <div class="more-link" style="margin-top:0"><a href="${esc(r.linkUrl || '/recruit')}">${esc(r.linkLabel || '採用情報を見る')}</a></div>
      </div>`;

    // contact
    const c = h.contact;
    $('#contact').innerHTML = sectionHead(c.en, c.title, c.lead) + `
      <div class="container">
        <ul class="targets" data-stagger>${(c.targets || []).map((t) => `<li class="reveal">${esc(t)}</li>`).join('')}</ul>
        <div class="more-link"><a href="${esc(c.linkUrl || '/contact')}">${esc(c.linkLabel || 'お問い合わせはこちら')}</a></div>
      </div>`;
  }

  function renderBusinessPage() {
    const p = CONTENT.businessPage;
    $('#page-hero').innerHTML = pageHero(p.en, p.title, p.heroImage);
    $('#cards').innerHTML = `
      <div class="container">
        <div class="card-grid" data-stagger>
          ${(p.cards || []).map((c, i) => `
            <div class="card">
              <div class="card-img-wrap">
                <span class="card-num">${cardNum(i)}</span>
                <img src="${esc(c.image)}" alt="${esc(c.title)}">
              </div>
              <div class="card-body">
                <div class="card-title">${esc(c.title)}</div>
                <div class="card-text">${esc(c.text)}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
    const nb = p.newBusiness;
    if (nb && nb.title) {
      $('#new-business').innerHTML = sectionHead(nb.en, nb.title) + `
        <div class="container" style="max-width:840px;text-align:center">
          <div class="frame-box reveal">
            <span class="fb-en">SINCE 2023</span>
            <p style="color:var(--ink-soft);font-size:14.5px;letter-spacing:.04em">${esc(nb.text)}</p>
          </div>
        </div>`;
    }
  }

  function renderCompanyPage() {
    const p = CONTENT.companyPage;
    $('#page-hero').innerHTML = pageHero(p.en, p.title, p.heroImage);

    const m = p.message;
    $('#greeting').innerHTML = sectionHead('MESSAGE', m.title) + `
      <div class="container">
        <div class="message-wrap">
          <div class="message-photo reveal reveal-l"><img src="${esc(m.image)}" alt="${esc(m.name)}"></div>
          <div class="message-body reveal reveal-r">
            <span class="msg-kanji">挨拶</span>
            <div class="role">${esc(m.role)}</div>
            <div class="name">${esc(m.name)}</div>
            ${(m.paragraphs || []).map((t) => `<p class="text" style="margin-bottom:18px">${esc(t)}</p>`).join('')}
          </div>
        </div>
      </div>`;

    $('#pp').innerHTML = `
      <div class="container">
        <div class="pp-grid" data-stagger>
          <div class="pp-block reveal">
            <h3>${esc(p.philosophy.title)}</h3>
            <p>${esc(p.philosophy.text)}</p>
          </div>
          <div class="pp-block reveal">
            <h3>${esc(p.policy.title)}</h3>
            <p>${esc(p.policy.text)}</p>
          </div>
        </div>
      </div>`;

    $('#profile').innerHTML = sectionHead('COMPANY', p.profile.title) + `
      <div class="container">
        <table class="table reveal">
          ${(p.profile.rows || []).map((r) => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}
        </table>
      </div>`;

    $('#history').innerHTML = sectionHead('HISTORY', p.history.title) + `
      <div class="container">
        <div class="history-list">
          ${(p.history.rows || []).map((r) => `
            <div class="history-item reveal">
              <span class="history-date">${esc(r[0])}</span>
              <span class="history-text">${esc(r[1])}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function bindNewsTitles() {
    $$('.news-title[data-news]').forEach((el) => {
      el.addEventListener('click', () => {
        const item = el.closest('.news-item');
        const body = item && item.nextElementSibling;
        if (body && body.classList.contains('news-body')) {
          body.style.display = body.style.display === 'none' ? '' : 'none';
        }
      });
    });
  }

  function renderNewsPage() {
    const p = CONTENT.newsPage;
    $('#page-hero').innerHTML = pageHero(p.en, p.title, p.heroImage || '/uploads/food-detail-DpB3b9yX.jpg');
    const items = CONTENT.news || [];
    $('#news-list').innerHTML = `
      <div class="container">
        <div class="news-list">
          ${items.map((n) => `
            <div class="news-item reveal">
              <span class="news-date">${esc(n.date)}</span>
              <span class="news-title" data-news="${esc(n.id)}" style="cursor:pointer">${esc(n.title)}</span>
            </div>
            <div class="news-body" style="display:none">${esc(n.body || '')}</div>`).join('') ||
            '<p class="section-lead" style="text-align:center">お知らせはまだありません。</p>'}
        </div>
      </div>`;
    bindNewsTitles();
  }

  function renderRecruitPage() {
    const p = CONTENT.recruitPage;
    $('#page-hero').innerHTML = pageHero(p.en, p.title, p.heroImage);
    $('#recruit-body').innerHTML = `
      <div class="container recruit-banner">
        <div class="frame-box reveal">
          <span class="fb-en">JOIN US</span>
          <span class="fb-title">${esc(p.lead)}</span>
        </div>
        <p class="text reveal" style="color:var(--ink-soft);max-width:740px;margin:0 auto 44px;letter-spacing:.04em">${esc(p.text)}</p>
        <a class="btn" href="${esc(p.ctaUrl || '/contact')}">${esc(p.ctaLabel || 'お問い合わせはこちら')}</a>
      </div>`;
  }

  function renderContactPage() {
    const p = CONTENT.contactPage, s = CONTENT.site;
    $('#page-hero').innerHTML = pageHero(p.en, p.title, p.heroImage || '/uploads/bento-box-Cub_Xfrs.jpg');
    $('#contact-body').innerHTML = `
      <div class="container">
        <p class="section-lead reveal" style="text-align:center;margin-bottom:40px;letter-spacing:.05em">${esc(p.lead)}</p>
        <ul class="targets">${(p.targets || []).map((t, i) => `<li class="reveal" style="transition-delay:${i * 90}ms">${esc(t)}</li>`).join('')}</ul>
        <div class="contact-columns" data-stagger>
          <div class="contact-box reveal">
            <div class="box-label">MAIL</div>
            <h3>${esc(p.mailTitle)}</h3>
            <p>${esc(p.mailText)}</p>
            <a class="btn line" href="tel:${esc(String(s.phone).replace(/-/g, ''))}">${esc(p.phoneButton)}</a>
          </div>
          <div class="contact-box reveal">
            <div class="box-label">TEL</div>
            <h3>${esc(p.phoneTitle || s.phone)}</h3>
            <p>${esc(p.phoneHours || s.hours)}</p>
            <a class="btn" href="tel:${esc(String(s.phone).replace(/-/g, ''))}">${esc(p.callButton)}</a>
          </div>
        </div>
      </div>`;
  }

  function renderCustomPage() {
    const slug = location.pathname.replace(/^\/page\//, '').replace(/\/$/, '');
    const page = (CONTENT.customPages || []).find((p) => p.slug === slug);
    if (!page) {
      $('#custom-body').innerHTML =
        '<div class="container" style="text-align:center;padding:80px 0">ページが見つかりません。<br><a href="/" style="color:var(--accent)">ホームへ戻る</a></div>';
      return;
    }
    document.title = `${page.title} | ${CONTENT.site.companyName}`;
    $('#page-hero').innerHTML = pageHero(page.headingEn || 'PAGE', page.title,
      page.heroImage || CONTENT.site.heroImage);
    const html = (page.blocks || []).map((b) => {
      if (b.type === 'heading') return `<h2 class="cp-heading reveal">${esc(b.value)}</h2>`;
      if (b.type === 'image') return `<img class="cp-image reveal" src="${esc(b.src)}" alt="">`;
      return `<p class="cp-text reveal">${esc(b.value)}</p>`;
    }).join('');
    $('#custom-body').innerHTML = `<div class="container">${html}</div>`;
  }

  /* ============================== motion ============================= */

  function initMotion() {
    // split hero tagline into staggered characters
    const tagline = $('#hero-tagline');
    if (tagline && !reducedMotion) {
      const text = tagline.textContent;
      tagline.textContent = '';
      Array.from(text).forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch;
        span.style.animationDelay = (0.4 + i * 0.045) + 's';
        tagline.appendChild(span);
      });
    }

    // reveal on scroll
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

    $$('.reveal').forEach((el) => io.observe(el));
    $$('[data-stagger]').forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        if (!child.classList.contains('reveal')) child.classList.add('reveal');
        child.style.transitionDelay = (i * 100) + 'ms';
        io.observe(child);
      });
    });

    // header state on scroll
    const header = $('#site-header');
    const onScrollHeader = () => header.classList.toggle('scrolled', window.scrollY > 8);

    // back to top
    const toTop = document.createElement('button');
    toTop.id = 'to-top';
    toTop.innerHTML = '↑';
    toTop.setAttribute('aria-label', 'page top');
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(toTop);
    const onScrollTop = () => toTop.classList.toggle('show', window.scrollY > 560);

    // gentle parallax for page heroes
    const pxEls = $$('[data-parallax] > img');
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        onScrollHeader();
        onScrollTop();
        if (!reducedMotion) {
          const y = window.scrollY;
          pxEls.forEach((img) => {
            const rect = img.parentElement.getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < window.innerHeight) {
              const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
              img.style.transform = `translateY(${(progress - 0.5) * 44}px)`;
            }
          });
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* =============================== boot ============================== */

  const RENDERERS = {
    home: renderHome,
    business: renderBusinessPage,
    company: renderCompanyPage,
    news: renderNewsPage,
    recruit: renderRecruitPage,
    contact: renderContactPage,
    custom: renderCustomPage
  };

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await fetch('/api/content');
      CONTENT = await res.json();
    } catch (e) {
      document.body.innerHTML =
        '<p style="padding:60px;text-align:center">コンテンツを読み込めませんでした。サーバーが起動しているかご確認ください。<br>（start.bat をダブルクリックして起動してください）</p>';
      return;
    }
    renderHeader();
    renderFooter();

    const page = document.body.dataset.page;
    if (page && RENDERERS[page]) RENDERERS[page]();

    initMotion();
  });
})();
