// ============================================================================
// ui.js —— 通用渲染（变体 / 字段 / 开关 / 动作 / 状态）
// ============================================================================

import { fieldInVariant, groupInVariant } from './operations.js';

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- 静态骨架
export function applyStaticI18n(ctx) {
  const { t, getLocale, profile, productLabel } = ctx;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  const warn = $('browser-warn');
  if (warn) warn.innerHTML = t('browserWarn');
  const notice = $('notice-list');
  if (notice) {
    notice.innerHTML = ['notice1', 'notice2', 'notice3', 'notice4', 'notice5', 'notice6']
      .map(k => `<li>${t(k)}</li>`).join('');
  }
  const footer = $('footer');
  if (footer) footer.textContent = t('footer');
  const zh = $('lang-zh'), en = $('lang-en');
  if (zh) zh.classList.toggle('active', getLocale() === 'zh');
  if (en) en.classList.toggle('active', getLocale() === 'en');
  document.documentElement.lang = getLocale() === 'zh' ? 'zh-CN' : 'en';
  if (profile) {
    const title = t('title', { product: productLabel });
    const h1 = $('app-title');
    if (h1) h1.textContent = title;
    document.title = title;
  }
  const sub = $('app-subtitle');
  if (sub) sub.textContent = t('subtitle');
}

// ---------------------------------------------------------------- 变体
export function renderVariants(container, variants, selected, onSelect, pickI18n) {
  container.innerHTML = '';
  if (variants.length <= 1 && variants[0] && !variants[0].id && !variants[0].group) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  for (const v of variants) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mode-btn';
    const label = pickI18n(v.label) || v.id;
    b.textContent = v.group ? (v.group + ' · ' + label) : label;
    b.dataset.vid = v.id == null ? '' : v.id;
    b.dataset.group = v.group || '';
    b.addEventListener('click', () => onSelect(v));
    container.appendChild(b);
  }
  syncVariants(container, selected ? selected.id : null, selected ? selected.group : '');
}

export function syncVariants(container, selectedId, selectedGroup) {
  [...container.children].forEach(b => {
    const same = (b.dataset.vid === (selectedId == null ? '' : String(selectedId))) &&
                 (b.dataset.group === (selectedGroup || ''));
    b.classList.toggle('active', same);
  });
}

// ---------------------------------------------------------------- 开关
function makeSwitch(id, label, help, checked) {
  const l = document.createElement('label');
  l.className = 'switch';
  l.innerHTML = `<input id="${id}" type="checkbox"${checked ? ' checked' : ''}>` +
    `<span>${label}</span><em>${help}</em>`;
  return l;
}

export function renderSwitches(switchesEl, eraseRow, profile, t) {
  switchesEl.innerHTML = '';
  eraseRow.innerHTML = '';
  const sw = (profile && profile.switches) || {};
  ['write', 'update', 'override'].forEach(key => {
    const def = sw[key] || {};
    if (def.visible === false) return;
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    switchesEl.appendChild(makeSwitch(`sw-${key}`, t('sw' + cap), t('sw' + cap + 'Help'), def.default !== false));
  });
  const edef = sw.erase || {};
  if (edef.visible !== false) {
    const lbl = document.createElement('label');
    lbl.className = 'switch inline';
    lbl.innerHTML = `<input id="sw-erase" type="checkbox"${edef.default !== false ? ' checked' : ''}>` +
      `<span>${t('swErase')}</span><em>${t('swEraseHelp')}</em>`;
    eraseRow.appendChild(lbl);
  }
}

export function swChecked(id) {
  const el = $(id);
  return el ? el.checked : false;
}

// ---------------------------------------------------------------- 字段
export function renderFields(fieldsEl, profile, variantId, pickI18n) {
  fieldsEl.innerHTML = '';
  const groups = (profile && profile.groups) || [];
  const fields = (profile && profile.fields) || [];
  const used = new Set();
  groups.filter(g => groupInVariant(g, variantId)).forEach(g => {
    const members = fields.filter(f => fieldInVariant(f, variantId) && f.group === g.id);
    if (!members.length) return;
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = pickI18n(g.label) || g.id;
    fieldsEl.appendChild(title);
    const box = document.createElement('div');
    fieldsEl.appendChild(box);
    members.forEach(f => { used.add(f.key); box.appendChild(makeField(f, pickI18n)); });
  });
  fields.filter(f => fieldInVariant(f, variantId) && !used.has(f.key))
    .forEach(f => fieldsEl.appendChild(makeField(f, pickI18n)));
}

export function makeField(f, pickI18n) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.id = 'wrap-' + f.key;
  wrap.dataset.key = f.key;
  const label = document.createElement('label');
  label.textContent = pickI18n(f.label) || f.key;
  label.setAttribute('for', 'cfg-' + f.key);
  wrap.appendChild(label);

  const type = f.type || 'text';
  const ph = pickI18n(f.placeholder);
  const help = f.help ? pickI18n(f.help) : '';

  if (type === 'textarea') {
    const ta = document.createElement('textarea');
    ta.id = 'cfg-' + f.key;
    ta.rows = 3; ta.spellcheck = false;
    if (ph) ta.placeholder = ph;
    if (f.default != null) ta.value = f.default;
    if (f.maxlength) ta.maxLength = f.maxlength;
    wrap.appendChild(ta);
  } else if (type === 'radio') {
    const row = document.createElement('div');
    row.className = 'radio-row';
    (f.options || []).forEach(opt => {
      const l = document.createElement('label');
      l.className = 'radio';
      const checked = (f.default != null ? f.default : (f.options[0] && f.options[0].value)) === opt.value;
      l.innerHTML = `<input type="radio" name="f-${f.key}" value="${opt.value}"${checked ? ' checked' : ''}>` +
        `<span>${pickI18n(opt.label) || opt.value}</span>`;
      row.appendChild(l);
    });
    wrap.appendChild(row);
  } else if (type === 'select') {
    const sel = document.createElement('select');
    sel.id = 'cfg-' + f.key;
    (f.options || []).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = pickI18n(opt.label) || opt.value;
      sel.appendChild(o);
    });
    if (f.default != null) sel.value = f.default;
    wrap.appendChild(sel);
  } else if (type === 'checkbox') {
    const l = document.createElement('label');
    l.className = 'radio';
    l.innerHTML = `<input type="checkbox" id="cfg-${f.key}"${f.default === 'true' || f.default === true ? ' checked' : ''}><span>${ph || ''}</span>`;
    wrap.appendChild(l);
  } else {
    const inp = document.createElement('input');
    inp.type = (type === 'number') ? 'number' : (f.sensitive || type === 'password' ? 'password' : 'text');
    inp.id = 'cfg-' + f.key;
    inp.autocomplete = 'off';
    if (ph) inp.placeholder = ph;
    if (f.default != null && f.default !== '') inp.value = f.default;
    if (f.maxlength) inp.maxLength = f.maxlength;
    if (f.min != null) inp.min = f.min;
    if (f.max != null) inp.max = f.max;
    wrap.appendChild(inp);
  }

  if (help) {
    const h = document.createElement('div');
    h.className = 'help';
    h.textContent = help;
    wrap.appendChild(h);
  }
  return wrap;
}

export function getControlValue(key) {
  const radios = document.getElementsByName('f-' + key);
  if (radios && radios.length) {
    const c = [...radios].find(r => r.checked);
    return c ? c.value : '';
  }
  const el = $('cfg-' + key);
  if (!el) return '';
  if (el.type === 'checkbox') return el.checked ? 'true' : '';
  return (el.value || '').trim();
}

export function setControlValue(key, val) {
  const radios = document.getElementsByName('f-' + key);
  if (radios && radios.length) {
    const r = [...radios].find(x => x.value === val);
    if (r) r.checked = true;
    return;
  }
  const el = $('cfg-' + key);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = (val === 'true');
  else el.value = val;
}

export function captureValues(profile, variantId) {
  const out = {};
  ((profile && profile.fields) || []).forEach(f => {
    if (!fieldInVariant(f, variantId)) return;
    const v = getControlValue(f.key);
    if (v !== '' && v != null) out[f.key] = v;
  });
  return out;
}

export function applyShowWhen(profile, getValue) {
  ((profile && profile.fields) || []).forEach(f => {
    if (!f.showWhen) return;
    const wrap = $('wrap-' + f.key);
    if (!wrap) return;
    let visible = true;
    for (const [dep, want] of Object.entries(f.showWhen)) {
      if (getValue(dep) !== want) { visible = false; break; }
    }
    wrap.classList.toggle('hidden', !visible);
  });
}

// ---------------------------------------------------------------- 动作按钮
export function renderActions(container, actions, ctx) {
  const { t, pickI18n, onAction, labelOf } = ctx;
  container.innerHTML = '';
  for (const a of actions) {
    if (a.visible === false) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (a.type === 'flash' ? ' primary' : (a.id === 'clear' || a.style === 'danger' ? ' danger' : ''));
    b.textContent = labelOf(a);
    b.dataset.action = a.id;
    b.disabled = true;
    b.addEventListener('click', () => onAction(a));
    container.appendChild(b);
  }
}

// ---------------------------------------------------------------- 状态渲染
function pill(b, t) {
  return b ? `<span class="pill y">${t('yes')}</span>` : `<span class="pill n">${t('no')}</span>`;
}

const STATE_MAP = {
  provision: 'stateProvision', connecting: 'stateConnecting',
  connected: 'stateConnected', failed: 'stateFailed', disconnected: 'stateDisconnected'
};

function stateLabel(s, t) {
  return STATE_MAP[s] ? t(STATE_MAP[s]) : (s || '-');
}

export function renderStatus(container, st, statusView, profile, ctx) {
  const { t, pickI18n } = ctx;
  if (!st) { container.classList.add('hidden'); return; }
  const view = statusView || { mode: 'auto' };
  const mode = view.mode === 'auto' ? (st.groups ? 'table' : 'summary') : view.mode;
  const fieldLabel = {};
  ((profile && profile.fields) || []).forEach(f => { fieldLabel[f.key] = pickI18n(f.label) || f.key; });

  let html = `<div class="card-title" style="margin-top:12px">${t('sectionStatus')}</div>`;

  if (mode === 'table' && st.groups) {
    const rows = (view.rows && view.rows.length)
      ? view.rows
      : Object.keys(st.groups).map(k => ({ key: k }));
    let trs = '';
    for (const r of rows) {
      const v = st.groups[r.key];
      if (!v) continue;
      const label = pickI18n(r.label) || fieldLabel[r.key] || r.key;
      const ck = r.compile || 'compile', nk = r.nvs || 'nvs', ok = r.override || 'ovr', vk = r.value || 'value';
      const val0 = (v[vk] !== undefined && v[vk] !== '') ? String(v[vk]) : '-';
      trs += `<tr><td class="mono">${label}</td><td>${pill(v[ck], t)}</td><td>${pill(v[nk], t)}</td>` +
             `<td>${v[ok] ? t('on') : t('off')}</td><td class="v">${val0}</td></tr>`;
    }
    html += `<table class="cred"><tr><th>${t('thGroup')}</th><th>${t('thCompile')}</th><th>${t('thNvs')}</th><th>${t('thOverride')}</th><th>${t('thValue')}</th></tr>${trs}</table>`;
    const wifi = st.wifi != null ? st.wifi : (st.state != null ? stateLabel(st.state, t) : '-');
    const ip = st.ip ? '（IP ' + st.ip + '）' : '';
    html += `<div class="muted" style="margin-top:6px">${t('logCredsStatusNote', { wifi, ip })}</div>`;
  } else if (view.summary && view.summary.length) {
    const parts = view.summary.map(item => {
      const label = pickI18n(item.label) || item.key;
      const raw = st[item.key];
      const type = item.type || (typeof raw === 'boolean' ? 'bool' : 'value');
      let val;
      if (type === 'bool') val = raw ? t('yes') : t('no');
      else if (type === 'state') {
        const m = item.stateMap && item.stateMap[raw];
        val = m != null ? pickI18n(m) : stateLabel(raw, t);
      } else val = (raw === undefined || raw === '') ? '-' : raw;
      return `${label}: ${val}`;
    });
    html += `<div class="muted">${parts.join(' ｜ ')}</div>`;
  } else {
    // 传统扁平形态
    const wifi = st.state != null ? stateLabel(st.state, t) : '-';
    const ip = (st.state === 'connected' && st.ip) ? '（' + st.ip + '）' : '';
    html += `<div class="muted">${t('thCompile')}: ${st.compile ? t('yes') : t('no')} ｜ ` +
      `${t('thNvs')}: ${st.nvs ? t('yes') : t('no')} ｜ ${t('thOverride')}: ${st.override ? t('on') : t('off')} ｜ ` +
      `${t('wifiLabel')}: ${wifi}${ip}</div>`;
  }

  container.innerHTML = html;
  container.classList.remove('hidden');
}
