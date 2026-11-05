/* ============================================
   Marutetsu admin — full CMS dashboard (JA)
   ============================================ */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let content = null;
  let currentSection = null;
  let dirty = false;
  let libraryCallback = null;

  /* ------------------------------ utils ------------------------------ */

  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, val) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = val;
  }

  function markDirty() {
    dirty = true;
    $('#save-bar').classList.add('show');
    $('#save-state').textContent = '● 未保存の変更があります';
  }
  function clearDirty() {
    dirty = false;
    $('#save-bar').classList.remove('show');
    $('#save-state').textContent = '';
  }

  function el(tag, className, html) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function confirmDelete(msg) {
    return window.confirm(msg || 'この項目を削除しますか？');
  }

  /* --------------------------- field builders --------------------------- */

  function fText(label, path, placeholder) {
    const wrap = el('div', 'field');
    wrap.innerHTML = `<label>${label}</label>`;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getPath(content, path) || '';
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener('input', () => {
      setPath(content, path, input.value);
      markDirty();
    });
    wrap.appendChild(input);
    return wrap;
  }

  function fArea(label, path, rows) {
    const wrap = el('div', 'field');
    wrap.innerHTML = `<label>${label}</label>`;
    const ta = document.createElement('textarea');
    if (rows) ta.rows = rows;
    ta.value = getPath(content, path) || '';
    ta.addEventListener('input', () => {
      setPath(content, path, ta.value);
      markDirty();
    });
    wrap.appendChild(ta);
    return wrap;
  }

  function fImage(label, path) {
    const wrap = el('div', 'field');
    wrap.innerHTML = `<label>${label}</label>`;
    const box = el('div', 'image-field');
    const preview = el('div', 'preview', '画像なし');
    const controls = el('div', 'controls');
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = '/uploads/... または https://...';
    urlInput.value = getPath(content, path) || '';
    urlInput.addEventListener('input', () => {
      setPath(content, path, urlInput.value);
      updatePreview();
      markDirty();
    });
    const btnRow = el('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';

    const libBtn = el('button', 'btn-secondary', '🖼 ライブラリから選択');
    libBtn.type = 'button';
    libBtn.addEventListener('click', () => {
      openLibrary((url) => {
        urlInput.value = url;
        setPath(content, path, url);
        updatePreview();
        markDirty();
      });
    });

    function updatePreview() {
      const v = urlInput.value;
      if (v) {
        preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = v;
        img.onerror = () => { preview.innerHTML = '画像が見つかりません'; };
        preview.appendChild(img);
      } else {
        preview.innerHTML = '画像なし';
      }
    }

    btnRow.appendChild(libBtn);
    controls.appendChild(urlInput);
    controls.appendChild(btnRow);
    box.appendChild(preview);
    box.appendChild(controls);
    wrap.appendChild(box);
    updatePreview();
    return wrap;
  }

  function fToggle(label, path, onChange) {
    const wrap = el('div', 'field');
    const row = el('div', 'toggle-row');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'toggle';
    input.checked = !!getPath(content, path);
    input.addEventListener('change', () => {
      setPath(content, path, input.checked);
      markDirty();
      if (onChange) onChange(input.checked);
    });
    row.appendChild(input);
    row.appendChild(el('span', '', label));
    wrap.appendChild(row);
    return wrap;
  }

  /* ----------------------------- list editor ----------------------------- */
  /**
   * Generic repeatable list editor bound to content[path] (an array).
   * cfg: { title, desc, addLabel, makeItem, titleOf(item), render(itemEl, item, refresh) }
   */
  function listEditor(path, cfg) {
    const card = el('div', 'card');
    card.appendChild(el('h3', '', cfg.title));
    if (cfg.desc) card.appendChild(el('div', 'card-desc', cfg.desc));
    const holder = el('div');

    function getArr() {
      const v = getPath(content, path);
      if (!Array.isArray(v)) {
        setPath(content, path, []);
        return getPath(content, path);
      }
      return v;
    }

    function refresh() {
      holder.innerHTML = '';
      const arr = getArr();
      arr.forEach((item, i) => {
        const li = el('div', 'list-item');
        const head = el('div', 'item-head');
        head.appendChild(el('span', 'drag-num', String(i + 1)));
        head.appendChild(el('span', 'item-title', cfg.titleOf(item, i)));
        const actions = el('div', 'actions');
        const up = el('button', 'icon-btn', '↑');
        up.title = '上へ';
        up.type = 'button';
        up.onclick = () => {
          if (i === 0) return;
          const a = getArr();
          [a[i - 1], a[i]] = [a[i], a[i - 1]];
          markDirty(); refresh();
        };
        const down = el('button', 'icon-btn', '↓');
        down.title = '下へ';
        down.type = 'button';
        down.onclick = () => {
          const a = getArr();
          if (i >= a.length - 1) return;
          [a[i + 1], a[i]] = [a[i], a[i + 1]];
          markDirty(); refresh();
        };
        const del = el('button', 'icon-btn danger', '✕');
        del.title = '削除';
        del.type = 'button';
        del.onclick = () => {
          if (!confirmDelete('この項目を削除しますか？')) return;
          getArr().splice(i, 1);
          markDirty(); refresh();
        };
        actions.appendChild(up); actions.appendChild(down); actions.appendChild(del);
        head.appendChild(actions);
        li.appendChild(head);
        cfg.render(li, item, refresh);
        holder.appendChild(li);
      });
    }

    const addBtn = el('button', 'add-btn', '＋ ' + (cfg.addLabel || '追加する'));
    addBtn.type = 'button';
    addBtn.onclick = () => {
      const item = cfg.makeItem();
      if (item !== null) {
        getArr().push(item);
        markDirty(); refresh();
        const items = holder.querySelectorAll('.list-item');
        const last = items[items.length - 1];
        if (last) {
          last.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const firstInput = last.querySelector('input, textarea');
          if (firstInput) firstInput.focus();
        }
      }
    };

    refresh();
    card.appendChild(holder);
    card.appendChild(addBtn);
    return card;
  }

  // helper: draw a text field inside a list item (writes directly into item object)
  function itemText(li, item, key, label, isArea) {
    const wrap = el('div', 'field');
    wrap.innerHTML = `<label>${label}</label>`;
    let input;
    if (isArea) {
      input = document.createElement('textarea');
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }
    input.value = item[key] || '';
    input.addEventListener('input', () => {
      item[key] = input.value;
      markDirty();
    });
    wrap.appendChild(input);
    li.appendChild(wrap);
  }

  function itemImage(li, item, key, label) {
    const saved = fImage(label, '__noop__');
    // rebind to item
    const urlInput = saved.querySelector('input');
    urlInput.value = item[key] || '';
    urlInput.oninput = () => { item[key] = urlInput.value; markDirty(); };
    const libBtn = saved.querySelector('.btn-secondary');
    libBtn.onclick = () => {
      openLibrary((url) => {
        urlInput.value = url;
        item[key] = url;
        urlInput.dispatchEvent(new Event('input'));
      });
    };
    const preview = saved.querySelector('.preview');
    const upd = () => {
      if (urlInput.value) {
        preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = urlInput.value;
        preview.appendChild(img);
      } else preview.innerHTML = '画像なし';
    };
    urlInput.addEventListener('input', upd);
    upd();
    li.appendChild(saved);
  }

  /* --------------------------- library modal --------------------------- */

  async function openLibrary(callback) {
    libraryCallback = callback;
    $('#library-modal').hidden = false;
    await loadLibrary();
  }

  async function loadLibrary() {
    const grid = $('#library-grid');
    grid.innerHTML = '<p style="grid-column:1/-1;color:#9ca3af;text-align:center">読み込み中...</p>';
    try {
      const res = await fetch('/api/images');
      const files = await res.json();
      grid.innerHTML = '';
      if (!files.length) {
        grid.innerHTML = '<p style="grid-column:1/-1;color:#9ca3af;text-align:center">画像がありません — 上からアップロードしてください</p>';
        return;
      }
      files.forEach((f) => {
        const t = el('div', 'thumb');
        t.innerHTML = `<img src="${f.url}" alt=""><div class="name">${f.name}</div>`;
        t.addEventListener('click', () => {
          $('#library-modal').hidden = true;
          if (libraryCallback) libraryCallback(f.url);
        });
        grid.appendChild(t);
      });
    } catch (e) {
      grid.innerHTML = '<p style="grid-column:1/-1;color:#dc2626">エラーが発生しました</p>';
    }
  }

  /* Resize/compress big images in the browser before uploading:
     max 1920px, JPEG 85% — faster uploads and works on every host. */
  async function compressImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 1920;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      if (scale >= 1 && file.size < 900 * 1024) {
        if (bitmap.close) bitmap.close();
        return file; // already small enough
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (bitmap.close) bitmap.close();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
      if (!blob || blob.size >= file.size) return file;
      const name = String(file.name || 'image.jpg').replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], name, { type: 'image/jpeg' });
    } catch (e) {
      return file; // unsupported browser / broken file — upload as-is
    }
  }

  async function uploadFiles(fileList) {
    const progress = $('#upload-progress');
    progress.hidden = false;
    progress.textContent = 'アップロード中...';
    let lastUrl = null;
    for (const rawFile of Array.from(fileList)) {
      const file = await compressImage(rawFile);
      const fd = new FormData();
      fd.append('file', file, file.name);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'エラー');
        lastUrl = data.url;
      } catch (e) {
        toast('アップロードできませんでした：' + e.message, true);
      }
    }
    progress.hidden = true;
    await loadLibrary();
    return lastUrl;
  }

  /* ------------------------------ sections ------------------------------ */

  const SECTIONS = {
    site: {
      label: 'サイト基本設定',
      icon: '🏢',
      group: '基本',
      render(root) {
        const c = el('div');
        const card1 = el('div', 'card');
        card1.appendChild(el('h3', '', '会社情報'));
        card1.appendChild(el('div', 'card-desc', 'ヘッダー・フッターに表示される会社名・電話番号・住所など。'));
        const r2 = el('div', 'row-2');
        r2.appendChild(fText('会社名（日本語）', 'site.companyName'));
        r2.appendChild(fText('会社名（英語）', 'site.companyNameEn'));
        card1.appendChild(r2);
        card1.appendChild(fText('キャッチコピー（ホームの大きい文字）', 'site.tagline'));
        card1.appendChild(fText('サブテキスト（ホーム）', 'site.heroTitle'));
        card1.appendChild(fImage('ヒーロー画像（ホーム）', 'site.heroImage'));
        const r3 = el('div', 'row-2');
        r3.appendChild(fText('電話番号', 'site.phone'));
        r3.appendChild(fText('受付時間', 'site.hours'));
        card1.appendChild(r3);
        card1.appendChild(fText('住所', 'site.address'));
        card1.appendChild(fText('コピーライト', 'site.copyright'));
        c.appendChild(card1);

        c.appendChild(listEditor('nav', {
          title: 'メニュー項目',
          desc: 'ヘッダーのメニューです。新しく作成したページは /page/スラッグ の形式でリンクできます。',
          addLabel: 'メニュー項目を追加',
          makeItem: () => ({ label: '新しい項目', url: '/' }),
          titleOf: (it) => it.label || '(無題)',
          render(li, item) {
            const r = el('div', 'row-2');
            const w1 = el('div');
            itemText(w1, item, 'label', '表示名');
            const w2 = el('div');
            itemText(w2, item, 'url', 'リンク（例：/business）');
            r.appendChild(w1); r.appendChild(w2);
            li.appendChild(r);
          }
        }));
        root.appendChild(c);
      }
    },

    home: {
      label: 'ホームページ',
      icon: '🏠',
      group: 'ページ',
      render(root) {
        root.appendChild((() => {
          const card = el('div', 'card');
          card.appendChild(el('h3', '', 'PHILOSOPHY — 私たちの想い'));
          const r = el('div', 'row-3');
          r.appendChild(fText('英語見出し', 'home.philosophy.en'));
          r.appendChild(fText('見出し', 'home.philosophy.title'));
          card.appendChild(r);
          card.appendChild(fArea('リード文', 'home.philosophy.lead'));
          return card;
        })());

        root.appendChild(listEditor('home.philosophy.images', {
          title: 'PHILOSOPHY の画像（3枚）',
          addLabel: '画像を追加',
          makeItem: () => ({ src: '', caption: '' }),
          titleOf: (it) => it.caption || it.src || '(画像)',
          render(li, item) {
            itemText(li, item, 'caption', 'キャプション');
            itemImage(li, item, 'src', '画像');
          }
        }));

        root.appendChild((() => {
          const card = el('div', 'card');
          card.appendChild(el('h3', '', 'BUSINESS — 事業内容'));
          const r = el('div', 'row-3');
          r.appendChild(fText('英語見出し', 'home.business.en'));
          r.appendChild(fText('見出し', 'home.business.title'));
          card.appendChild(r);
          return card;
        })());

        root.appendChild(listEditor('home.business.cards', {
          title: 'ホームの事業カード',
          addLabel: 'カードを追加',
          makeItem: () => ({ title: '新しいカード', text: '', image: '', url: '/business' }),
          titleOf: (it) => it.title || '(カード)',
          render(li, item) {
            itemText(li, item, 'title', 'カード名');
            itemText(li, item, 'url', 'クリック時のリンク先');
            itemImage(li, item, 'image', '画像');
            itemText(li, item, 'text', '説明文', true);
          }
        }));

        root.appendChild((() => {
          const card = el('div', 'card');
          card.appendChild(el('h3', '', 'MESSAGE — 代表挨拶'));
          const r = el('div', 'row-3');
          r.appendChild(fText('英語見出し', 'home.message.en'));
          r.appendChild(fText('見出し', 'home.message.title'));
          card.appendChild(r);
          const r2 = el('div', 'row-2');
          r2.appendChild(fText('役職', 'home.message.role'));
          r2.appendChild(fText('氏名', 'home.message.name'));
          card.appendChild(r2);
          card.appendChild(fImage('画像', 'home.message.image'));
          card.appendChild(fArea('本文', 'home.message.text'));
          const r3 = el('div', 'row-2');
          r3.appendChild(fText('ボタンの文言', 'home.message.linkLabel'));
          r3.appendChild(fText('ボタンのリンク先', 'home.message.linkUrl'));
          card.appendChild(r3);
          return card;
        })());

        root.appendChild((() => {
          const card = el('div', 'card');
          card.appendChild(el('h3', '', 'QUALITY — こだわり'));
          const r = el('div', 'row-3');
          r.appendChild(fText('英語見出し', 'home.quality.en'));
          r.appendChild(fText('見出し', 'home.quality.title'));
          card.appendChild(r);
          card.appendChild(fArea('リード文', 'home.quality.lead'));
          return card;
        })());

        root.appendChild(listEditor('home.quality.blocks', {
          title: 'QUALITY のブロック',
          addLabel: 'ブロックを追加',
          makeItem: () => ({ title: '新しいブロック', text: '' }),
          titleOf: (it) => it.title || '(ブロック)',
          render(li, item) {
            itemText(li, item, 'title', '見出し');
            itemText(li, item, 'text', '本文', true);
          }
        }));

        root.appendChild((() => {
          const card = el('div', 'card');
          card.appendChild(el('h3', '', 'NEWS / RECRUIT / CONTACT セクション'));
          const g1 = el('div', 'row-2');
          g1.appendChild(fText('NEWS 英語見出し', 'home.news.en'));
          g1.appendChild(fText('NEWS 見出し', 'home.news.title'));
          card.appendChild(g1);
          const g2 = el('div', 'row-2');
          g2.appendChild(fText('NEWS ボタンの文言', 'home.news.linkLabel'));
          g2.appendChild(fText('NEWS ボタンのリンク先', 'home.news.linkUrl'));
          card.appendChild(g2);
          card.appendChild(el('div', 'card-desc', 'お知らせの一覧は「お知らせ管理」から編集します。'));
          const hr = el('hr');
          hr.style.border = 'none'; hr.style.borderTop = '1px solid var(--line)'; hr.style.margin = '14px 0';
          card.appendChild(hr);
          card.appendChild(fArea('RECRUIT の本文', 'home.recruit.text'));
          const g3 = el('div', 'row-2');
          g3.appendChild(fText('RECRUIT ボタンの文言', 'home.recruit.linkLabel'));
          g3.appendChild(fText('RECRUIT ボタンのリンク先', 'home.recruit.linkUrl'));
          card.appendChild(g3);
          card.appendChild(fArea('CONTACT のリード文', 'home.contact.lead'));
          const g4 = el('div', 'row-2');
          g4.appendChild(fText('CONTACT ボタンの文言', 'home.contact.linkLabel'));
          g4.appendChild(fText('CONTACT ボタンのリンク先', 'home.contact.linkUrl'));
          card.appendChild(g4);
          return card;
        })());

        root.appendChild(listEditor('home.contact.targets', {
          title: 'CONTACT の対象者',
          addLabel: '項目を追加',
          makeItem: () => '',
          titleOf: (it, i) => (typeof it === 'string' ? it : '') || '(無題)',
          render(li, item) {
            const wrap = el('div', 'field');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = item;
            input.addEventListener('input', () => {
              const arr = getPath(content, 'home.contact.targets');
              const i2 = arr.indexOf(item);
              if (i2 > -1) arr[i2] = input.value;
              markDirty();
            });
            wrap.appendChild(input);
            li.appendChild(wrap);
          }
        }));
      }
    },

    businessPage: {
      label: '事業内容ページ',
      icon: '🍱',
      group: 'ページ',
      render(root) {
        const card = el('div', 'card');
        card.appendChild(el('h3', '', 'ページの見出し'));
        const r = el('div', 'row-2');
        r.appendChild(fText('英語見出し', 'businessPage.en'));
        r.appendChild(fText('見出し', 'businessPage.title'));
        card.appendChild(r);
        card.appendChild(fImage('ヒーロー画像', 'businessPage.heroImage'));
        root.appendChild(card);

        root.appendChild(listEditor('businessPage.cards', {
          title: '事業カード',
          addLabel: 'カードを追加',
          makeItem: () => ({ title: '新しい事業', text: '', image: '' }),
          titleOf: (it) => it.title || '(カード)',
          render(li, item) {
            itemText(li, item, 'title', '見出し');
            itemImage(li, item, 'image', '画像');
            itemText(li, item, 'text', '説明文', true);
          }
        }));

        const nb = el('div', 'card');
        nb.appendChild(el('h3', '', 'NEW BUSINESS — 新しい事業'));
        const r2 = el('div', 'row-2');
        r2.appendChild(fText('英語見出し', 'businessPage.newBusiness.en'));
        r2.appendChild(fText('見出し', 'businessPage.newBusiness.title'));
        nb.appendChild(r2);
        nb.appendChild(fArea('本文', 'businessPage.newBusiness.text'));
        root.appendChild(nb);
      }
    },

    companyPage: {
      label: '会社情報ページ',
      icon: '🏛',
      group: 'ページ',
      render(root) {
        const card = el('div', 'card');
        card.appendChild(el('h3', '', 'ページの見出し'));
        const r = el('div', 'row-2');
        r.appendChild(fText('英語見出し', 'companyPage.en'));
        r.appendChild(fText('見出し', 'companyPage.title'));
        card.appendChild(r);
        card.appendChild(fImage('ヒーロー画像', 'companyPage.heroImage'));
        root.appendChild(card);

        const m = el('div', 'card');
        m.appendChild(el('h3', '', '代表挨拶'));
        const r2 = el('div', 'row-2');
        r2.appendChild(fText('見出し', 'companyPage.message.title'));
        r2.appendChild(fText('役職', 'companyPage.message.role'));
        m.appendChild(r2);
        m.appendChild(fText('氏名', 'companyPage.message.name'));
        m.appendChild(fImage('画像', 'companyPage.message.image'));
        root.appendChild(m);

        root.appendChild(listEditor('companyPage.message.paragraphs', {
          title: '代表挨拶の本文（段落）',
          addLabel: '段落を追加',
          makeItem: () => '',
          titleOf: (it) => (typeof it === 'string' ? it.slice(0, 40) : '') || '(無題)',
          render(li, item) {
            const wrap = el('div', 'field');
            const ta = document.createElement('textarea');
            ta.rows = 3;
            ta.value = item;
            ta.addEventListener('input', () => {
              const arr = getPath(content, 'companyPage.message.paragraphs');
              const i = arr.indexOf(item);
              if (i > -1) arr[i] = ta.value;
              markDirty();
            });
            wrap.appendChild(ta);
            li.appendChild(wrap);
          }
        }));

        const pp = el('div', 'card');
        pp.appendChild(el('h3', '', '企業理念 / 企業方針'));
        const pa = el('div', 'row-2');
        pa.appendChild(fText('見出し（左）', 'companyPage.philosophy.title'));
        pa.appendChild(fText('見出し（右）', 'companyPage.policy.title'));
        pp.appendChild(pa);
        const pb = el('div', 'row-2');
        pb.appendChild(fArea('左の本文', 'companyPage.philosophy.text'));
        pb.appendChild(fArea('右の本文', 'companyPage.policy.text'));
        pp.appendChild(pb);
        root.appendChild(pp);

        const prCard = el('div', 'card');
        prCard.appendChild(el('h3', '', '会社概要'));
        prCard.appendChild(fText('見出し', 'companyPage.profile.title'));
        root.appendChild(prCard);

        root.appendChild(listEditor('companyPage.profile.rows', {
          title: '会社概要の表（項目 → 内容）',
          addLabel: '行を追加',
          makeItem: () => ['', ''],
          titleOf: (it) => it[0] || '(行)',
          render(li, item) {
            const r3 = el('div', 'row-2');
            const w1 = el('div');
            itemText(w1, item, '0', '項目名');
            const w2 = el('div');
            itemText(w2, item, '1', '内容');
            r3.appendChild(w1); r3.appendChild(w2);
            li.appendChild(r3);
          }
        }));

        const hCard = el('div', 'card');
        hCard.appendChild(el('h3', '', '沿革'));
        hCard.appendChild(fText('見出し', 'companyPage.history.title'));
        root.appendChild(hCard);

        root.appendChild(listEditor('companyPage.history.rows', {
          title: '沿革の項目',
          addLabel: '項目を追加',
          makeItem: () => ['', ''],
          titleOf: (it) => it[0] || '(項目)',
          render(li, item) {
            const r4 = el('div', 'row-3');
            const w1 = el('div');
            itemText(w1, item, '0', '年月');
            const w2 = el('div');
            itemText(w2, item, '1', '内容');
            r4.appendChild(w1); r4.appendChild(w2);
            li.appendChild(r4);
          }
        }));
      }
    },

    recruitPage: {
      label: '採用情報ページ',
      icon: '👤',
      group: 'ページ',
      render(root) {
        const card = el('div', 'card');
        card.appendChild(el('h3', '', '採用情報ページ'));
        const r = el('div', 'row-2');
        r.appendChild(fText('英語見出し', 'recruitPage.en'));
        r.appendChild(fText('見出し', 'recruitPage.title'));
        card.appendChild(r);
        card.appendChild(fImage('ヒーロー画像', 'recruitPage.heroImage'));
        card.appendChild(fArea('リード文', 'recruitPage.lead'));
        card.appendChild(fArea('本文', 'recruitPage.text'));
        const r2 = el('div', 'row-2');
        r2.appendChild(fText('ボタンの文言', 'recruitPage.ctaLabel'));
        r2.appendChild(fText('ボタンのリンク先', 'recruitPage.ctaUrl'));
        card.appendChild(r2);
        root.appendChild(card);
      }
    },

    contactPage: {
      label: 'お問い合わせページ',
      icon: '📞',
      group: 'ページ',
      render(root) {
        const card = el('div', 'card');
        card.appendChild(el('h3', '', 'お問い合わせページ'));
        const r = el('div', 'row-2');
        r.appendChild(fText('英語見出し', 'contactPage.en'));
        r.appendChild(fText('見出し', 'contactPage.title'));
        card.appendChild(r);
        card.appendChild(fArea('リード文', 'contactPage.lead'));
        card.appendChild(fImage('ヒーロー画像', 'contactPage.heroImage'));
        root.appendChild(card);

        root.appendChild(listEditor('contactPage.targets', {
          title: '対象となる方',
          addLabel: '項目を追加',
          makeItem: () => '',
          titleOf: (it) => (typeof it === 'string' ? it : '') || '(無題)',
          render(li, item) {
            const wrap = el('div', 'field');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = item;
            input.addEventListener('input', () => {
              const arr = getPath(content, 'contactPage.targets');
              const i = arr.indexOf(item);
              if (i > -1) arr[i] = input.value;
              markDirty();
            });
            wrap.appendChild(input);
            li.appendChild(wrap);
          }
        }));

        const card2 = el('div', 'card');
        card2.appendChild(el('h3', '', 'MAIL / TEL セクション'));
        card2.appendChild(fText('MAIL の見出し', 'contactPage.mailTitle'));
        card2.appendChild(fArea('MAIL の本文', 'contactPage.mailText'));
        card2.appendChild(fText('電話ボタンの文言', 'contactPage.phoneButton'));
        card2.appendChild(fText('電話番号（大きく表示）', 'contactPage.phoneTitle'));
        card2.appendChild(fText('受付時間の表示', 'contactPage.phoneHours'));
        card2.appendChild(fText('発信ボタンの文言', 'contactPage.callButton'));
        root.appendChild(card2);
      }
    },

    news: {
      label: 'お知らせ管理',
      icon: '📰',
      group: 'コンテンツ',
      render(root) {
        const head = el('div', 'card');
        head.appendChild(el('h3', '', 'お知らせページの見出し'));
        const r = el('div', 'row-2');
        r.appendChild(fText('英語見出し', 'newsPage.en'));
        r.appendChild(fText('見出し', 'newsPage.title'));
        head.appendChild(r);
        head.appendChild(fImage('ヒーロー画像', 'newsPage.heroImage'));
        root.appendChild(head);

        root.appendChild(listEditor('news', {
          title: 'お知らせ一覧',
          desc: 'ホームとお知らせページに表示されます。タイトルをクリックすると本文が開閉します。',
          addLabel: 'お知らせを追加',
          makeItem: () => ({
            id: 'n' + Date.now(),
            date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
            title: '新しいお知らせ',
            body: ''
          }),
          titleOf: (it) => `${it.date || ''} — ${it.title || '(無題)'}`,
          render(li, item) {
            const r = el('div', 'row-3');
            const w1 = el('div');
            itemText(w1, item, 'date', '日付（例：2021.02.13）');
            const w2 = el('div');
            itemText(w2, item, 'title', 'タイトル');
            r.appendChild(w1); r.appendChild(w2);
            li.appendChild(r);
            itemText(li, item, 'body', '本文', true);
          }
        }));
      }
    },

    pages: {
      label: 'ページ作成',
      icon: '📄',
      group: 'コンテンツ',
      render(root) {
        root.appendChild(listEditor('customPages', {
          title: '独自ページ',
          desc: '見出し・テキスト・画像のブロックを組み合わせて、新しいページを作成できます。スラッグは半角英数字と「-」で入力してください。ページは /page/スラッグ で開きます。',
          addLabel: '新しいページを作成',
          makeItem: () => ({
            id: 'p' + Date.now(),
            slug: 'page-' + Date.now().toString(36),
            title: '新しいページ',
            headingEn: 'PAGE',
            heroImage: '',
            showInNav: true,
            blocks: [{ type: 'heading', value: '見出し' }, { type: 'text', value: 'ここに本文を入力してください。' }]
          }),
          titleOf: (it) => `${it.title || '(無題)'} — /page/${it.slug || '?'}`,
          render(li, item) {
            const r = el('div', 'row-2');
            const w1 = el('div');
            itemText(w1, item, 'title', 'ページ名');
            const w2 = el('div');
            itemText(w2, item, 'slug', 'スラッグ（URL）');
            r.appendChild(w1); r.appendChild(w2);
            li.appendChild(r);
            const r2 = el('div', 'row-2');
            const w3 = el('div');
            itemText(w3, item, 'headingEn', '英語見出し');
            r2.appendChild(w3);
            const w4 = el('div');
            itemText(w4, item, 'heroImage', 'ヒーロー画像URL');
            r2.appendChild(w4);
            li.appendChild(r2);
            itemImage(li, item, 'heroImage', 'ヒーロー画像');

            // showInNav toggle
            const tw = el('div', 'field');
            const row = el('div', 'toggle-row');
            const tg = document.createElement('input');
            tg.type = 'checkbox';
            tg.className = 'toggle';
            tg.checked = !!item.showInNav;
            tg.addEventListener('change', () => { item.showInNav = tg.checked; markDirty(); });
            row.appendChild(tg);
            row.appendChild(el('span', '', 'メニューに表示する'));
            tw.appendChild(row);
            li.appendChild(tw);

            // blocks
            const bl = el('div');
            bl.style.marginTop = '8px';
            bl.appendChild(el('label', '', '<b style="font-size:12.5px;color:#6b7280">ページの内容（ブロック）</b>'));
            const bHolder = el('div');
            bHolder.style.marginTop = '8px';

            function renderBlocks() {
              bHolder.innerHTML = '';
              (item.blocks || []).forEach((b, bi) => {
                const bli = el('div', 'list-item');
                const head = el('div', 'item-head');
                head.appendChild(el('span', 'drag-num', String(bi + 1)));
                const typeSel = document.createElement('select');
                typeSel.style.padding = '5px 8px';
                typeSel.style.border = '1px solid var(--line)';
                typeSel.style.borderRadius = '6px';
                ['heading', 'text', 'image'].forEach((t) => {
                  const o = document.createElement('option');
                  o.value = t;
                  o.textContent = t === 'heading' ? '見出し' : t === 'text' ? 'テキスト' : '画像';
                  typeSel.appendChild(o);
                });
                typeSel.value = b.type;
                typeSel.addEventListener('change', () => {
                  b.type = typeSel.value;
                  if (b.type === 'image' && b.src == null) { b.src = ''; delete b.value; }
                  if (b.type !== 'image' && b.value == null) { b.value = ''; delete b.src; }
                  markDirty(); renderBlocks();
                });
                head.appendChild(typeSel);
                head.appendChild(el('span', 'item-title', ''));
                const actions = el('div', 'actions');
                const up = el('button', 'icon-btn', '↑');
                up.type = 'button';
                up.onclick = () => { if (bi > 0) { [item.blocks[bi - 1], item.blocks[bi]] = [item.blocks[bi], item.blocks[bi - 1]]; markDirty(); renderBlocks(); } };
                const down = el('button', 'icon-btn', '↓');
                down.type = 'button';
                down.onclick = () => { if (bi < item.blocks.length - 1) { [item.blocks[bi + 1], item.blocks[bi]] = [item.blocks[bi], item.blocks[bi + 1]]; markDirty(); renderBlocks(); } };
                const del = el('button', 'icon-btn danger', '✕');
                del.type = 'button';
                del.onclick = () => { item.blocks.splice(bi, 1); markDirty(); renderBlocks(); };
                actions.appendChild(up); actions.appendChild(down); actions.appendChild(del);
                head.appendChild(actions);
                bli.appendChild(head);

                if (b.type === 'image') {
                  itemImage(bli, b, 'src', '画像のURL');
                } else {
                  const wrap = el('div', 'field');
                  const ta = document.createElement('textarea');
                  ta.rows = b.type === 'heading' ? 1 : 4;
                  ta.value = b.value || '';
                  ta.addEventListener('input', () => { b.value = ta.value; markDirty(); });
                  wrap.appendChild(ta);
                  bli.appendChild(wrap);
                }
                bHolder.appendChild(bli);
              });
            }
            const addB = el('button', 'add-btn', '＋ ブロックを追加');
            addB.type = 'button';
            addB.onclick = () => {
              item.blocks = item.blocks || [];
              item.blocks.push({ type: 'text', value: '' });
              markDirty(); renderBlocks();
            };
            renderBlocks();
            bl.appendChild(bHolder);
            bl.appendChild(addB);
            li.appendChild(bl);
          }
        }));
      }
    },

    images: {
      label: '画像ライブラリ',
      icon: '🖼',
      group: 'ツール',
      render(root) {
        const card = el('div', 'card');
        card.appendChild(el('h3', '', '画像ライブラリ'));
        card.appendChild(el('div', 'card-desc', '画像をアップロードして管理します。各編集画面の「ライブラリから選択」から選べます。画像をクリックするとURLがコピーされます。'));
        const zone = el('div', 'upload-zone');
        zone.innerHTML = '<p>📁 クリックして画像を選択、またはここにドラッグ＆ドロップ</p>';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.multiple = true;
        fileInput.hidden = true;
        const pickBtn = el('button', 'btn-secondary', '画像を選択');
        pickBtn.type = 'button';
        pickBtn.onclick = () => fileInput.click();
        zone.appendChild(pickBtn);
        zone.appendChild(fileInput);
        fileInput.addEventListener('change', () => {
          if (fileInput.files.length) uploadFiles(fileInput.files).then(() => loadGrid());
        });
        ['dragover', 'dragenter'].forEach((ev) =>
          zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); })
        );
        ['dragleave', 'drop'].forEach((ev) =>
          zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); })
        );
        zone.addEventListener('drop', (e) => {
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files).then(() => loadGrid());
        });
        card.appendChild(zone);
        const grid = el('div', 'library-grid');
        grid.style.marginTop = '16px';
        card.appendChild(grid);
        root.appendChild(card);

        async function loadGrid() {
          grid.innerHTML = '';
          const res = await fetch('/api/images');
          const files = await res.json();
          if (!files.length) {
            grid.innerHTML = '<p style="grid-column:1/-1;color:#9ca3af;text-align:center">画像がありません</p>';
            return;
          }
          files.forEach((f) => {
            const t = el('div', 'thumb');
            t.innerHTML = `<img src="${f.url}" alt=""><div class="name">${f.name}</div>`;
            t.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(location.origin + f.url);
                toast('コピーしました：' + f.url);
              } catch (e) {
                toast(f.url);
              }
            });
            grid.appendChild(t);
          });
        }
        loadGrid();
      }
    },

    settings: {
      label: '設定 / パスワード',
      icon: '⚙️',
      group: 'ツール',
      render(root) {
        const card = el('div', 'card cred-form');
        card.appendChild(el('h3', '', 'ログイン情報の変更'));
        card.appendChild(el('div', 'card-desc', '現在のユーザー名：<b>' + (window._me ? window._me.username : '') + '</b>'));

        const errBox = el('div', 'login-error');

        const f1 = el('div', 'field');
        f1.innerHTML = '<label>現在のパスワード</label>';
        const cur = document.createElement('input');
        cur.type = 'password';
        cur.autocomplete = 'current-password';
        f1.appendChild(cur);

        const f2 = el('div', 'field');
        f2.innerHTML = '<label>新しいユーザー名（変更しない場合は空欄）</label>';
        const nu = document.createElement('input');
        nu.type = 'text';
        nu.placeholder = window._me ? window._me.username : '';
        f2.appendChild(nu);

        const f3 = el('div', 'field');
        f3.innerHTML = '<label>新しいパスワード（変更しない場合は空欄）</label>';
        const np = document.createElement('input');
        np.type = 'password';
        np.autocomplete = 'new-password';
        f3.appendChild(np);

        const submit = el('button', 'btn-primary', '変更する');
        submit.type = 'button';
        submit.addEventListener('click', async () => {
          errBox.textContent = '';
          try {
            const res = await fetch('/api/change-credentials', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                currentPassword: cur.value,
                newUsername: nu.value.trim() || undefined,
                newPassword: np.value || undefined
              })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'エラー');
            window._me.username = data.username;
            toast('✓ 変更しました');
            cur.value = nu.value = np.value = '';
            renderSection('settings');
          } catch (e) {
            errBox.textContent = e.message;
          }
        });

        card.appendChild(f1); card.appendChild(f2); card.appendChild(f3);
        card.appendChild(errBox); card.appendChild(submit);
        root.appendChild(card);

        const info = el('div', 'card cred-form');
        info.appendChild(el('h3', '', '初期ログイン情報について'));
        info.appendChild(el('p', '', '初期設定の <span class="kbd">admin</span> / <span class="kbd">marutetsu123</span> は必ず変更してください。変更すると、ログイン画面の案内は表示されなくなります。'));
        root.appendChild(info);

        const backup = el('div', 'card cred-form');
        backup.appendChild(el('h3', '', 'バックアップについて'));
        backup.appendChild(el('p', '', '保存するたびに、前のバージョンが <span class="kbd">data/content.backup.json</span> に自動保存されます。'));
        root.appendChild(backup);
      }
    }
  };

  /* ------------------------------ navigation ------------------------------ */

  function buildSidebar() {
    const nav = $('#sidebar-nav');
    nav.innerHTML = '';
    const groups = {};
    Object.entries(SECTIONS).forEach(([key, s]) => {
      (groups[s.group] = groups[s.group] || []).push([key, s]);
    });
    Object.entries(groups).forEach(([g, items]) => {
      const label = { '基本': '基本設定', 'ページ': 'ページ', 'コンテンツ': 'コンテンツ', 'ツール': 'ツール' }[g] || g;
      nav.appendChild(el('div', 'group-label', label));
      items.forEach(([key, s]) => {
        const b = el('button', 'nav-item', `<span>${s.icon}</span><span>${s.label}</span>`);
        b.type = 'button';
        b.dataset.key = key;
        b.addEventListener('click', () => {
          renderSection(key);
          $('#sidebar').classList.remove('open');
        });
        nav.appendChild(b);
      });
    });
  }

  function renderSection(key) {
    if (!SECTIONS[key]) return;
    currentSection = key;
    $$('#sidebar-nav .nav-item').forEach((b) =>
      b.classList.toggle('active', b.dataset.key === key)
    );
    $('#section-title').textContent = SECTIONS[key].label;
    const root = $('#admin-content');
    root.innerHTML = '';
    SECTIONS[key].render(root);
  }

  /* -------------------------------- save -------------------------------- */

  async function saveContent() {
    const btn = $('#save-btn');
    btn.disabled = true;
    btn.textContent = '保存中...';
    try {
      const res = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'エラー');
      clearDirty();
      toast('✓ 保存しました');
    } catch (e) {
      toast('保存できませんでした：' + e.message, true);
    }
    btn.disabled = false;
    btn.textContent = '💾 保存する';
  }

  /* -------------------------------- boot -------------------------------- */

  async function loadContent() {
    const res = await fetch('/api/content');
    content = await res.json();
  }

  async function boot() {
    let me = null;
    try {
      const res = await fetch('/api/me');
      me = await res.json();
    } catch (e) {
      $('#login-view').hidden = false;
      $('#login-error').textContent = 'サーバーに接続できません。start.bat が起動しているかご確認ください。';
      return;
    }

    if (me.authenticated) {
      window._me = me;
      await loadContent();
      showAdmin();
    } else {
      const lv = $('#login-view');
      lv.hidden = false;
      if (me.defaultActive) $('#login-hint').hidden = false;
      $('#login-username').focus();
    }
  }

  function showAdmin() {
    $('#login-view').hidden = true;
    $('#admin-view').hidden = false;
    buildSidebar();
    renderSection('site');
  }

  /* ------------------------------ bindings ------------------------------ */

  document.addEventListener('DOMContentLoaded', () => {
    boot();

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#login-error').textContent = '';
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: $('#login-username').value.trim(),
            password: $('#login-password').value
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'エラー');
        window._me = data;
        await loadContent();
        showAdmin();
        toast('ようこそ、' + data.username + ' さん');
      } catch (err) {
        $('#login-error').textContent = err.message;
      }
    });

    $('#logout-btn').addEventListener('click', async () => {
      if (dirty && !window.confirm('未保存の変更があります。ログアウトしますか？')) return;
      await fetch('/api/logout', { method: 'POST' });
      location.reload();
    });

    $('#view-site').addEventListener('click', () => {
      window.open('/', '_blank');
    });

    $('#save-btn').addEventListener('click', saveContent);

    $('#burger').addEventListener('click', () => {
      $('#sidebar').classList.toggle('open');
    });

    // modal
    $$('[data-close]').forEach((b) =>
      b.addEventListener('click', () => { $('#library-modal').hidden = true; })
    );
    $('#library-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.hidden = true;
    });

    // library upload controls
    $('#upload-btn').addEventListener('click', () => $('#upload-input').click());
    $('#upload-input').addEventListener('change', function () {
      if (this.files.length) {
        uploadFiles(this.files).then((url) => {
          if (url && libraryCallback) { /* keep modal open for choosing */ }
        });
      }
    });
    const zone = $('#upload-zone');
    ['dragover', 'dragenter'].forEach((ev) =>
      zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); })
    );
    zone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    });

    // ctrl+s
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!$('#admin-view').hidden && dirty) saveContent();
      }
    });

    window.addEventListener('beforeunload', (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  });
})();
