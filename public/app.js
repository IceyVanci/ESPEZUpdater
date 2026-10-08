import { ESPLoader, Transport } from './esptool-js/bundle.js';
import { initLocale, getLocale, setLocale, onLocaleChange, t, pickI18n } from './i18n.js';

// ============================================================================
// DOM
// ============================================================================
const $ = id => document.getElementById(id);
const appTitle = $('app-title');
const appSubtitle = $('app-subtitle');
const btnLangZh = $('lang-zh');
const btnLangEn = $('lang-en');
const variantsEl = $('variants');
const fwBadge = $('fw-badge');
const fwInfo = $('fw-info');
const fieldsEl = $('fields');
const switchesEl = $('switches');
const eraseRow = $('erase-row');
const btnConnect = $('btn-connect');
const btnFlash = $('btn-flash');
const btnProvision = $('btn-provision');
const btnClear = $('btn-clear');
const statusEl = $('status');
const progressWrap = $('progress-wrap');
const progressBar = $('progress-bar');
const progressText = $('progress-text');
const credStatus = $('cred-status');
const browserWarn = $('browser-warn');
const logEl = $('log');
const noticeList = $('notice-list');
const footerEl = $('footer');
const modal = $('modal');
const modalTitle = $('modal-title');
const modalMsg = $('modal-msg');
const modalOk = $('modal-ok');

// ============================================================================
// 状态
// ============================================================================
let rootProfile = null;      // /firmware/profile.json（项目级：变体/分组/字段/协议）
let profile = null;          // 当前变体最终使用的 profile
let variants = [];
let selectedVariant = null;
let manifest = null;

let esploader = null;
let transport = null;
let selectedPort = null;
let connected = false;
let flashing = false;
let provisionBusy = false;
let pendingProvision = false; // 端口失效后等待用户重选串口继续配网

// ============================================================================
// 协议映射（默认 = 方案正典；profile.protocol 可覆盖）
// ============================================================================
const DEFAULT_PROTOCOL = {
  ping: 'ping',
  pongEvt: 'pong',
  status: 'status',
  statusEvt: 'status',
  credsCmd: 'creds',
  credsSavedEvt: 'creds_saved',
  clearCmd: 'creds_clear',
  clearAckEvt: 'creds_saved',
  wifiConnectingEvt: 'wifi_connecting',
  wifiConnectedEvt: 'wifi_connected',
  wifiFailedEvt: 'wifi_failed',
  errorEvt: 'error'
};
let proto = Object.assign({}, DEFAULT_PROTOCOL);
function refreshProto() {
  proto = Object.assign({}, DEFAULT_PROTOCOL, (profile && profile.protocol) || {});
}

// ============================================================================
// 通用 helpers
// ============================================================================
function log(msg) {
  const ts = new Date().toLocaleTimeString(getLocale() === 'zh' ? 'zh-CN' : 'en-US', { hour12: false });
  logEl.textContent += `[${ts}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}
function setProgress(pct, text) {
  progressWrap.classList.remove('hidden');
  progressBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
  progressText.textContent = text || (pct.toFixed(1) + '%');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function sha256Hex(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function showModal(title, msg) {
  modalTitle.textContent = title;
  modalMsg.textContent = msg;
  modal.classList.remove('hidden');
}
modalOk.addEventListener('click', () => modal.classList.add('hidden'));

async function fetchJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function chipRegex(chip) {
  const norm = String(chip || 'esp32c3').toLowerCase();
  const m = norm.match(/^(esp32|esp8266)(.*)$/);
  const alt = m ? (m[1] + '-' + m[2]) : norm;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(' + esc(norm) + '|' + esc(alt) + ')', 'i');
}

const fieldLabelByKey = {};
function rebuildFieldLabelMap() {
  Object.keys(fieldLabelByKey).forEach(k => delete fieldLabelByKey[k]);
  ((profile && profile.fields) || []).forEach(f => {
    fieldLabelByKey[f.key] = pickI18n(f.label) || f.key;
  });
}

// ============================================================================
// i18n 应用到静态骨架
// ============================================================================
function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  browserWarn.innerHTML = t('browserWarn');
  noticeList.innerHTML = ['notice1', 'notice2', 'notice3', 'notice4', 'notice5', 'notice6']
    .map(k => `<li>${t(k)}</li>`).join('');
  footerEl.textContent = t('footer');
  btnConnect.textContent = connected ? t('btnConnected') : (pendingProvision ? t('btnReconnect') : t('btnConnect'));
  btnLangZh.classList.toggle('active', getLocale() === 'zh');
  btnLangEn.classList.toggle('active', getLocale() === 'en');
  document.documentElement.lang = getLocale() === 'zh' ? 'zh-CN' : 'en';
  if (rootProfile) {
    appTitle.textContent = t('title', { product: pickI18n(rootProfile.product) });
    document.title = appTitle.textContent;
    appSubtitle.textContent = t('subtitle');
  } else {
    appSubtitle.textContent = t('subtitle');
  }
  if (statusEl.dataset.key) setStatus(t(statusEl.dataset.key, JSON.parse(statusEl.dataset.vars || '{}')), statusEl.dataset.cls || '');
  if (!manifest) refreshFwInfoPlaceholder();
}

function refreshFwInfoPlaceholder() {
  if (manifest) return;
  fwInfo.textContent = t('loadingFirmware');
}

// ============================================================================
// 引导 & 变体/固件加载
// ============================================================================
async function bootstrap() {
  try {
    rootProfile = await fetchJSON('/firmware/profile.json');
  } catch (e) {
    fwInfo.innerHTML = `<span style="color:#d63031">${t('firmwareNotFound', { path: '/firmware/profile.json' })}</span>`;
    log(t('firmwareNotFound', { path: '/firmware/profile.json' }));
    return;
  }
  appTitle.textContent = t('title', { product: pickI18n(rootProfile.product) });
  document.title = appTitle.textContent;
  variants = (rootProfile.variants && rootProfile.variants.length)
    ? rootProfile.variants
    : [{ id: '', label: pickI18n(rootProfile.product) }];
  renderVariants();
  await selectVariant(variants[0]);
}

function basePathFor(v) {
  return (v && v.id) ? `/firmware/${v.id}/` : '/firmware/';
}

function renderVariants() {
  variantsEl.innerHTML = '';
  if (variants.length <= 1 && variants[0] && !variants[0].id) {
    variantsEl.classList.add('hidden');
    return;
  }
  variantsEl.classList.remove('hidden');
  variants.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mode-btn';
    b.textContent = pickI18n(v.label) || v.id;
    b.addEventListener('click', () => selectVariant(v));
    b.dataset.vid = v.id == null ? '' : v.id;
    variantsEl.appendChild(b);
  });
  syncVariantButtons();
}
function syncVariantButtons() {
  [...variantsEl.children].forEach(b => {
    b.classList.toggle('active', selectedVariant && (b.dataset.vid === (selectedVariant.id == null ? '' : selectedVariant.id)));
  });
}

async function selectVariant(v) {
  selectedVariant = v;
  syncVariantButtons();
  const base = basePathFor(v);
  // 优先使用变体自带 profile，其次项目级
  try { profile = await fetchJSON(base + 'profile.json'); }
  catch (e) { profile = rootProfile; }
  refreshProto();
  rebuildFieldLabelMap();
  renderSwitches();
  renderFields();
  log(t('logSwitched', { label: pickI18n(v.label) || v.id || '' }));
  await loadManifest();
}

async function loadManifest() {
  const base = basePathFor(selectedVariant);
  try {
    manifest = await fetchJSON(base + 'manifest.json');
  } catch (e) {
    manifest = null;
    fwBadge.innerHTML = '';
    fwInfo.innerHTML = `<span style="color:#d63031">${t('firmwareNotFound', { path: base + 'manifest.json' })}</span>`;
    log(t('firmwareNotFound', { path: base + 'manifest.json' }));
    return;
  }
  const empty = (manifest.credentials === 'empty');
  fwBadge.innerHTML = empty
    ? `<span class="badge-empty">${t('badgeEmpty')}</span>`
    : `<span class="badge-empty badge-warn">${t('badgeHasCreds')}</span>`;
  if (!empty) log(t('warnHasCreds'));

  let rows = '';
  for (const f of manifest.files) {
    rows += `<tr><td class="mono">${f.name}</td><td class="mono">0x${Number(f.offset).toString(16)}</td>` +
            `<td>${(f.size / 1024).toFixed(1)} KB</td></tr>`;
  }
  fwInfo.innerHTML =
    `<div class="fw-ver">${t('versionPrefix')} v${manifest.version}</div>` +
    `<table class="files"><tr><th>${t('thFile')}</th><th>${t('thOffset')}</th><th>${t('thSize')}</th></tr>${rows}</table>`;
  log(t('logPackageLoaded', { version: manifest.version, mode: manifest.flash.mode, freq: manifest.flash.freq, size: manifest.flash.size }));
}

// ============================================================================
// 渲染：开关
// ============================================================================
function renderSwitches() {
  switchesEl.innerHTML = '';
  eraseRow.innerHTML = '';
  const sw = (profile && profile.switches) || {};
  ['write', 'update', 'override'].forEach(key => {
    const def = sw[key] || {};
    if (def.visible === false) return;
    switchesEl.appendChild(makeSwitch(`sw-${key}`, t('sw' + key.charAt(0).toUpperCase() + key.slice(1)), t('sw' + key.charAt(0).toUpperCase() + key.slice(1) + 'Help'), def.default !== false));
  });
  // erase 开关（位于操作区）
  const edef = sw.erase || {};
  if (edef.visible !== false) {
    const lbl = document.createElement('label');
    lbl.className = 'switch inline';
    lbl.innerHTML = `<input id="sw-erase" type="checkbox"${edef.default !== false ? ' checked' : ''}>` +
      `<span>${t('swErase')}</span><em>${t('swEraseHelp')}</em>`;
    eraseRow.appendChild(lbl);
  }
}
function makeSwitch(id, label, help, checked) {
  const l = document.createElement('label');
  l.className = 'switch';
  l.innerHTML = `<input id="${id}" type="checkbox"${checked ? ' checked' : ''}>` +
    `<span>${label}</span><em>${help}</em>`;
  return l;
}
function swChecked(id) { const el = $(id); return el ? el.checked : false; }

// ============================================================================
// 渲染：字段（分组 + variants 过滤 + showWhen）
// ============================================================================
function variantId() { return selectedVariant ? (selectedVariant.id == null ? '' : selectedVariant.id) : ''; }
function fieldInVariant(f) {
  if (!f.variants || !f.variants.length) return true;
  return f.variants.includes(variantId());
}
function groupInVariant(g) {
  if (!g.variants || !g.variants.length) return true;
  return g.variants.includes(variantId());
}

function renderFields() {
  fieldsEl.innerHTML = '';
  const groups = (profile && profile.groups) || [];
  const fields = (profile && profile.fields) || [];
  const used = new Set();
  groups.filter(groupInVariant).forEach(g => {
    const members = fields.filter(f => fieldInVariant(f) && f.group === g.id);
    if (!members.length) return;
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = pickI18n(g.label) || g.id;
    fieldsEl.appendChild(title);
    const box = document.createElement('div');
    fieldsEl.appendChild(box);
    members.forEach(f => { used.add(f.key); box.appendChild(makeField(f)); });
  });
  const rest = fields.filter(f => fieldInVariant(f) && !used.has(f.key));
  rest.forEach(f => fieldsEl.appendChild(makeField(f)));

  // showWhen 初始 + 变更监听
  fieldsEl.querySelectorAll('input,select,textarea').forEach(el => {
    el.addEventListener('input', applyShowWhen);
    el.addEventListener('change', applyShowWhen);
  });
  applyShowWhen();
}

function makeField(f) {
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

function getControlValue(key) {
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

function captureValues() {
  const out = {};
  ((profile && profile.fields) || []).forEach(f => {
    const v = getControlValue(f.key);
    if (v !== '' && v != null) out[f.key] = v;
  });
  return out;
}
function setControlValue(key, val) {
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

function applyShowWhen() {
  ((profile && profile.fields) || []).forEach(f => {
    if (!f.showWhen) return;
    const wrap = $('wrap-' + f.key);
    if (!wrap) return;
    let visible = true;
    for (const [dep, want] of Object.entries(f.showWhen)) {
      if (getControlValue(dep) !== want) { visible = false; break; }
    }
    wrap.classList.toggle('hidden', !visible);
  });
}

// ============================================================================
// 凭据负载
// ============================================================================
function buildCredsPayload() {
  const p = {
    cmd: proto.credsCmd,
    write: true,
    update: swChecked('sw-update'),
    override: swChecked('sw-override')
  };
  ((profile && profile.fields) || []).forEach(f => {
    if (!fieldInVariant(f)) return;
    const wrap = $('wrap-' + f.key);
    if (wrap && wrap.classList.contains('hidden')) return;
    const v = getControlValue(f.key);
    if (v === '' || v == null) return;
    if (f.type === 'number') {
      const n = parseInt(v, 10);
      if (!isNaN(n)) p[f.key] = n;
    } else {
      p[f.key] = v;
    }
  });
  return p;
}

// ============================================================================
// 设备状态渲染（富 groups / 扁平）
// ============================================================================
function pill(b) { return b ? `<span class="pill y">${t('yes')}</span>` : `<span class="pill n">${t('no')}</span>`; }
function stateLabel(s) {
  const map = { provision: 'stateProvision', connecting: 'stateConnecting', connected: 'stateConnected', failed: 'stateFailed', disconnected: 'stateDisconnected' };
  return map[s] ? t(map[s]) : (s || '-');
}

function renderStatus(st) {
  if (!st) { credStatus.classList.add('hidden'); return; }
  rebuildFieldLabelMap();
  if (st.groups) {
    let rows = '';
    for (const [name, v] of Object.entries(st.groups)) {
      const label = fieldLabelByKey[name] || name;
      const val0 = (v.value !== undefined && v.value !== '') ? String(v.value) : '-';
      rows += `<tr><td class="mono">${label}</td><td>${pill(v.compile)}</td><td>${pill(v.nvs)}</td>` +
              `<td>${v.ovr ? t('on') : t('off')}</td><td class="v">${val0}</td></tr>`;
    }
    const wifi = st.wifi != null ? st.wifi : (st.state != null ? stateLabel(st.state) : '-');
    const ip = st.ip ? '（IP ' + st.ip + '）' : '';
    credStatus.innerHTML =
      `<div class="card-title" style="margin-top:12px">${t('sectionStatus')}</div>` +
      `<table class="cred"><tr><th>${t('thGroup')}</th><th>${t('thCompile')}</th><th>${t('thNvs')}</th><th>${t('thOverride')}</th><th>${t('thValue')}</th></tr>${rows}</table>` +
      `<div class="muted" style="margin-top:6px">${t('logCredsStatusNote', { wifi, ip })}</div>`;
  } else {
    const wifi = st.state != null ? stateLabel(st.state) : '-';
    const ip = (st.state === 'connected' && st.ip) ? '（' + st.ip + '）' : '';
    credStatus.innerHTML =
      `<div class="card-title" style="margin-top:12px">${t('sectionStatus')}</div>` +
      `<div class="muted">${t('thCompile')}: ${st.compile ? t('yes') : t('no')} ｜ ` +
      `${t('thNvs')}: ${st.nvs ? t('yes') : t('no')} ｜ ${t('thOverride')}: ${st.override ? t('on') : t('off')} ｜ ` +
      `${t('wifiLabel')}: ${wifi}${ip}</div>`;
  }
  credStatus.classList.remove('hidden');
}

// ============================================================================
// 串口配网会话
// ============================================================================
class SerialTalker {
  constructor(port) {
    this.port = port;
    this.reader = null;
    this.writer = null;
    this.buf = '';
    this.events = [];
    this.waiters = [];
    this.onEvent = null;
  }
  async open(baud = 115200) {
    await this.port.open({ baudRate: baud, bufferSize: 8192 });
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    this._pump();
  }
  async _pump() {
    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value && value.length) this._feed(new TextDecoder().decode(value));
      }
    } catch (e) { /* 端口关闭 */ }
  }
  _feed(text) {
    this.buf += text;
    let idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      let line = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 1);
      line = line.replace(/\r$/, '');
      if (!line) continue;
      if (line.startsWith('@')) this._event(line);
      else log(t('logDevice', { line: line.trim() }));
    }
  }
  _event(line) {
    let msg;
    try { msg = JSON.parse(line.slice(1)); } catch (e) { log(t('logParseFail', { line })); return; }
    log(t('logDeviceMsg', { msg: JSON.stringify(msg) }));
    this.events.push(msg);
    if (this.onEvent) this.onEvent(msg);
    const hit = this.waiters.filter(w => w.evt === msg.evt);
    this.waiters = this.waiters.filter(w => w.evt !== msg.evt);
    hit.forEach(w => { clearTimeout(w.timer); w.resolve(msg); });
  }
  resetEvents() { this.events = []; }
  waitFor(evt, timeoutMs = 15000) {
    const past = this.events.filter(e => e.evt === evt).pop();
    if (past) return Promise.resolve(past);
    return new Promise((resolve, reject) => {
      const w = { evt, resolve };
      w.timer = setTimeout(() => {
        this.waiters = this.waiters.filter(x => x !== w);
        reject(new Error(evt + ' timeout'));
      }, timeoutMs);
      this.waiters.push(w);
    });
  }
  async send(obj) {
    const line = '@' + JSON.stringify(obj) + '\n';
    log(t('logSend', { msg: line.trim() }));
    await this.writer.write(new TextEncoder().encode(line));
  }
  async close() {
    try { if (this.reader) await this.reader.cancel(); } catch (e) {}
    try { if (this.writer) await this.writer.releaseLock(); } catch (e) {}
    try { await this.port.close(); } catch (e) {}
  }
}

async function openWithRetry(port, tries = 12, gapMs = 500) {
  for (let i = 0; i < tries; i++) {
    try {
      const tk = new SerialTalker(port);
      await tk.open(115200);
      return tk;
    } catch (e) {
      try { await port.close(); } catch (_) {}
      if (i === tries - 1) throw e;
      await sleep(gapMs);
    }
  }
}

async function provisionOnPort(port) {
  let talker = null;
  try {
    log(t('logProvisionOpen', { baud: 115200 }));
    talker = await openWithRetry(port);

    let pong = null;
    for (let i = 0; i < 15 && !pong; i++) {
      talker.resetEvents();
      await talker.send({ cmd: proto.ping });
      try { pong = await talker.waitFor(proto.pongEvt, 1000); } catch (e) {}
    }
    if (!pong) throw new Error(t('errNoResponse'));
    log(t('logDeviceResponded', { fw: pong.fw || '?', mode: pong.mode || '-' }));

    if (profile && profile.proto != null && pong.proto != null && pong.proto !== profile.proto) {
      throw new Error(t('errProtoMismatch', { proto: pong.proto, expected: profile.proto }));
    }
    if (pong.mode != null && selectedVariant && selectedVariant.id && pong.mode !== selectedVariant.id) {
      log(t('logModeMismatch', { device: pong.mode, selected: selectedVariant.id }));
    }

    talker.resetEvents();
    await talker.send({ cmd: proto.status });
    const st = await talker.waitFor(proto.statusEvt, 3000).catch(() => null);
    if (st) renderStatus(st);

    if (!swChecked('sw-write')) {
      log(t('logSkipWrite'));
      return { pong, skippedAll: true };
    }

    const payload = buildCredsPayload();
    const keys = Object.keys(payload).filter(k => !['cmd', 'write', 'update', 'override'].includes(k));
    if (keys.length === 0) {
      log(t('logSkipNoCreds'));
      return { pong, skippedAll: true };
    }

    talker.resetEvents();
    await talker.send(payload);
    const saved = await talker.waitFor(proto.credsSavedEvt, 5000);
    const written = (saved.groups || []).join(', ') || '-';
    if (saved.skipped && saved.skipped.length) {
      log(t('logCredsSavedSkip', { written, skipped: saved.skipped.join(', ') }));
    } else {
      log(t('logCredsSaved', { written }));
    }

    const hasSsid = !!(payload.ssid);
    if (hasSsid) {
      setStatus(t('stProvisioningWait'));
      const evt = await talker.waitFor([proto.wifiConnectedEvt, proto.wifiFailedEvt, proto.errorEvt], 45000).catch(() => null);
      if (evt && evt.evt === proto.wifiConnectedEvt) {
        log(t('logWifiConnected', { ip: evt.ip }));
      } else if (evt && evt.evt === proto.wifiFailedEvt) {
        log(t('logWifiTimeoutStatus', { status: evt.status }));
        return { pong, wifiOk: false };
      } else if (evt && evt.evt === proto.errorEvt) {
        throw new Error(t('errDeviceError', { msg: evt.msg || 'unknown' }));
      } else {
        log(t('logWifiTimeout'));
        return { pong, wifiOk: false };
      }
    }
    return { pong, wifiOk: true };
  } finally {
    if (talker) await talker.close();
  }
}

async function clearOnPort(port) {
  let talker = null;
  try {
    talker = await openWithRetry(port);
    talker.resetEvents();
    await talker.send({ cmd: proto.clearCmd, groups: ['all'] });
    const ack = await talker.waitFor(proto.clearAckEvt, 5000).catch(() => null);
    if (!ack) throw new Error(t('errClearTimeout', { evt: proto.clearAckEvt }));
    log(t('logCleared'));
    talker.resetEvents();
    await talker.send({ cmd: proto.status });
    const st = await talker.waitFor(proto.statusEvt, 3000).catch(() => null);
    renderStatus(st);
  } finally {
    if (talker) await talker.close();
  }
}

// ============================================================================
// esptool 连接 / 烧录
// ============================================================================
btnConnect.addEventListener('click', async () => {
  if (pendingProvision) {
    try {
      selectedPort = await navigator.serial.requestPort();
      pendingProvision = false;
      btnConnect.textContent = t('btnConnect');
      setStatus(t('reopenHint'), 'ok');
      await runProvisionOnly();
    } catch (e) { log(t('logConnectFailed', { msg: e && e.message ? e.message : e })); }
    return;
  }
  if (connected) return;
  if (!('serial' in navigator)) { browserWarn.classList.remove('hidden'); return; }
  try {
    btnConnect.disabled = true;
    setStatus(t('stSelectPort'));
    selectedPort = await navigator.serial.requestPort();
    log(t('stSelectPort'));
    transport = new Transport(selectedPort, true);
    esploader = new ESPLoader({
      transport,
      baudrate: 921600,
      terminal: {
        clean() {},
        write(data) { if (data) { logEl.textContent += data; logEl.scrollTop = logEl.scrollHeight; } },
        writeLine(data) { log(String(data).trimEnd()); }
      },
      debugLogging: false
    });
    setStatus(t('stHandshaking'));
    const chip = await esploader.main();
    log(t('logChip', { chip }));
    const expect = (manifest && manifest.chip) || 'esp32c3';
    if (!chipRegex(expect).test(chip)) {
      throw new Error(t('errChipNotMatch', { expect, chip }));
    }
    connected = true;
    setStatus(t('stConnected', { chip }), 'ok');
    btnFlash.disabled = false;
    btnProvision.disabled = false;
    btnClear.disabled = false;
    btnConnect.textContent = t('btnConnected');
  } catch (e) {
    log(t('logConnectFailed', { msg: e && e.message ? e.message : e }));
    setStatus(t('stConnectFail'), 'err');
    await releasePort();
    btnConnect.disabled = false;
  }
});

async function releasePort() {
  if (transport) { try { await transport.disconnect(); } catch (e) {} }
  transport = null;
  esploader = null;
  connected = false;
  if (selectedPort) {
    for (let i = 0; i < 12 && (selectedPort.readable || selectedPort.writable); i++) {
      try { await selectedPort.close(); } catch (e) { break; }
      await sleep(100);
    }
  }
}

btnFlash.addEventListener('click', async () => {
  if (!connected || flashing) return;
  if (!manifest) { setStatus(t('stNoManifest'), 'err'); return; }
  flashing = true;
  btnFlash.disabled = true;
  btnProvision.disabled = true;
  btnClear.disabled = true;
  btnConnect.disabled = true;
  const base = basePathFor(selectedVariant);
  const doErase = swChecked('sw-erase');
  try {
    setStatus(t('stVerifying'));
    const fileArray = [];
    for (let i = 0; i < manifest.files.length; i++) {
      const f = manifest.files[i];
      setProgress(i / manifest.files.length * 5, t('stReading', { name: f.name }));
      const res = await fetch(base + f.name, { cache: 'no-store' });
      if (!res.ok) throw new Error(t('errReadFile', { name: f.name, status: res.status }));
      const buf = await res.arrayBuffer();
      const hex = await sha256Hex(buf);
      if (hex !== String(f.sha256).toLowerCase()) throw new Error(t('errSha', { name: f.name }));
      log(t('logShaOk', { name: f.name, kb: (buf.byteLength / 1024).toFixed(1) }));
      fileArray.push({ data: new Uint8Array(buf), address: f.offset });
    }
    const fl = manifest.flash || {};
    const flashMode = fl.mode || 'dio', flashFreq = fl.freq || '80m', flashSize = fl.size || '4MB';
    setStatus(t('stFlashing'));
    log(t('logFlashing', {
      variant: variantId() || '-', mode: flashMode, freq: flashFreq, size: flashSize,
      erase: doErase ? t('eraseYes') : t('eraseNo')
    }));
    await esploader.writeFlash({
      fileArray, flashMode, flashFreq, flashSize, eraseAll: doErase, compress: true,
      reportProgress: (fileIndex, written, total) => {
        const b = fileIndex / fileArray.length * 90;
        const span = 1 / fileArray.length * 90;
        setProgress(b + written / total * span);
      }
    });
    log(t('logWriteDone'));
    setProgress(100, t('stRestart'));
    try { await esploader.after('hard_reset'); } catch (e) { log(t('logResetHint', { msg: e })); }
    await releasePort();
    await sleep(2000);

    let tail = t('tailNotProvisioned');
    if (swChecked('sw-write')) {
      setProgress(100, t('stProvisioning'));
      try {
        const r = await provisionOnPort(selectedPort);
        tail = (r && r.skippedAll) ? t('tailSkipped') : t('tailProvisioned');
      } catch (e) {
        log(t('logProvisionFailed', { msg: e && e.message ? e.message : e }));
        tail = t('tailProvisionIncomplete');
      }
    }
    setProgress(100, '100%');
    setStatus(t('stDone', { tail }), 'ok');
    showModal('✅', t('stDone', { tail }));
  } catch (e) {
    log(t('logFlashFailed', { msg: e && e.message ? e.message : e }));
    setStatus(t('stFlashFail', { msg: e && e.message ? e.message : e }), 'err');
  } finally {
    flashing = false;
    btnConnect.disabled = false;
    btnProvision.disabled = false;
    btnClear.disabled = false;
    btnConnect.textContent = connected ? t('btnConnected') : t('btnConnect');
  }
});

async function ensureProvisionPort() {
  if (transport || connected) { await releasePort(); await sleep(800); }
  if (!selectedPort) {
    setStatus(t('stSelectPort'));
    selectedPort = await navigator.serial.requestPort();
  }
}

async function runProvisionOnly() {
  setStatus(t('stProvisioning'));
  const r = await provisionOnPort(selectedPort);
  if (r && r.skippedAll) setStatus(t('stProvisionDoneNoCreds'), 'ok');
  else if (r && r.wifiOk === false) setStatus(t('stProvisionWifiFail'), 'err');
  else setStatus(t('stProvisionDone'), 'ok');
}

btnProvision.addEventListener('click', async () => {
  if (flashing || provisionBusy) return;
  if (!('serial' in navigator)) { browserWarn.classList.remove('hidden'); return; }
  try {
    provisionBusy = true;
    btnProvision.disabled = true; btnFlash.disabled = true; btnClear.disabled = true;
    await ensureProvisionPort();
    await runProvisionOnly();
  } catch (e) {
    log(t('logProvisionFailed', { msg: e && e.message ? e.message : e }));
    setStatus(t('stProvisionFail', { msg: e && e.message ? e.message : e }), 'err');
  } finally {
    provisionBusy = false;
    btnProvision.disabled = false;
    btnFlash.disabled = !connected;
    btnClear.disabled = false;
    btnConnect.disabled = connected;
  }
});

btnClear.addEventListener('click', async () => {
  if (flashing || provisionBusy) return;
  if (!('serial' in navigator)) { browserWarn.classList.remove('hidden'); return; }
  try {
    provisionBusy = true;
    btnClear.disabled = true; btnProvision.disabled = true; btnFlash.disabled = true;
    await ensureProvisionPort();
    setStatus(t('stProvisioning'));
    await clearOnPort(selectedPort);
    setStatus(t('stCleared'), 'ok');
  } catch (e) {
    log(t('logProvisionFailed', { msg: e && e.message ? e.message : e }));
    setStatus(t('stProvisionFail', { msg: e && e.message ? e.message : e }), 'err');
  } finally {
    provisionBusy = false;
    btnClear.disabled = false;
    btnProvision.disabled = false;
    btnFlash.disabled = !connected;
  }
});

// ============================================================================
// 语言切换
// ============================================================================
btnLangZh.addEventListener('click', () => setLocale('zh'));
btnLangEn.addEventListener('click', () => setLocale('en'));
onLocaleChange(() => {
  const vals = profile ? captureValues() : {};
  const sw = {
    write: swChecked('sw-write'), update: swChecked('sw-update'),
    override: swChecked('sw-override'), erase: swChecked('sw-erase')
  };
  applyStaticI18n();
  if (profile) {
    renderSwitches();
    ['write', 'update', 'override'].forEach(k => { const el = $('sw-' + k); if (el) el.checked = sw[k]; });
    const e = $('sw-erase'); if (e) e.checked = sw.erase;
    renderFields();
    Object.entries(vals).forEach(([k, v]) => setControlValue(k, v));
    applyShowWhen();
  }
  if (manifest) loadManifest();
});

// ============================================================================
// 初始化
// ============================================================================
initLocale();
applyStaticI18n();
if (!('serial' in navigator)) {
  browserWarn.classList.remove('hidden');
  btnConnect.disabled = true;
  btnProvision.disabled = true;
  btnClear.disabled = true;
  setStatus(t('stNoWebSerial'), 'err');
} else {
  setStatus(t('stDisconnected'));
}
log(t('logReady'));
bootstrap();
