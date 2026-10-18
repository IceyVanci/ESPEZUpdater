// ============================================================================
// app.js —— 通用固件升级工具（编排层）
//   来源（内置 / 导入）→ profile（schema1/2）→ 渲染 → 连接 → 动作（烧录/串口）
// ============================================================================

import { ESPLoader, Transport } from './esptool-js/bundle.js';
import { initLocale, getLocale, setLocale, setDefaultLocale, onLocaleChange, t, pickI18n } from './i18n.js';
import { StaticSource, DirectorySource, DemoSource, sourceFromFileList, entriesFromDataTransfer, entriesFromDirectoryHandle } from './firmware-source.js';
import { readZip } from './zip.js';
import { normalizeProfile } from './profile-model.js';
import { SerialTalker, MockTalker, sendAndConfirm } from './protocol.js';
import { computeVisibility, buildActionPayload, dataKeysOf } from './operations.js';
import * as ui from './ui.js';

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- DOM
const appTitle = $('app-title');
const toolVersionEl = $('tool-version');
const sourceBadge = $('source-badge');
const importDrop = $('import-drop');
const btnImport = $('btn-import');
const btnImportZip = $('btn-import-zip');
const fileInput = $('file-input');
const zipInput = $('zip-input');
const importMsg = $('import-msg');
const importCard = $('import-card');
const variantsEl = $('variants');
const fwCard = $('fw-card');
const configCard = $('config-card');
const fwBadge = $('fw-badge');
const fwInfo = $('fw-info');
const fieldsEl = $('fields');
const switchesEl = $('switches');
const eraseRow = $('erase-row');
const btnConnect = $('btn-connect');
const actionsEl = $('actions');
const statusEl = $('status');
const progressWrap = $('progress-wrap');
const progressBar = $('progress-bar');
const progressText = $('progress-text');
const credStatus = $('cred-status');
const browserWarn = $('browser-warn');
const logEl = $('log');
const btnExportLog = $('btn-export-log');
const modal = $('modal');
const modalTitle = $('modal-title');
const modalMsg = $('modal-msg');
const modalOk = $('modal-ok');

// ---------------------------------------------------------------- 状态
const MOCK = new URLSearchParams(location.search).get('mock') === '1';
let toolInfo = { name: 'ESPEZUpdater', version: 'dev', profileSchema: 2 };
let source = null;
let pkg = null;
let profile = null;
let manifest = null;

let esploader = null;
let transport = null;
let selectedPort = null;
let connected = false;
let busy = false;
let mockTalker = null;

// ---------------------------------------------------------------- helpers
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

function chipRegex(chip) {
  const norm = String(chip || 'esp32c3').toLowerCase();
  const m = norm.match(/^(esp32|esp8266)(.*)$/);
  const alt = m ? (m[1] + '-' + m[2]) : norm;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(' + esc(norm) + '|' + esc(alt) + ')', 'i');
}

function labelOf(a) {
  return pickI18n(a.label) || (a.i18nKey ? t(a.i18nKey) : a.id);
}
function switchState() {
  return { write: ui.swChecked('sw-write'), update: ui.swChecked('sw-update'), override: ui.swChecked('sw-override'), erase: ui.swChecked('sw-erase') };
}
function actionById(id) { return profile && profile.actions.find(a => a.id === id); }
function submitAction() { return (profile && profile.actions.find(a => a.type === 'submit')) || null; }

// ---------------------------------------------------------------- 静态文案与版本
function applyStatic() {
  ui.applyStaticI18n({ t, getLocale, profile, productLabel: profile ? pickI18n(profile.product) : 'Firmware' });
  toolVersionEl.textContent = `${t('toolVersionLabel')} v${toolInfo.version}`;
  updateSourceBadge();
}
function updateSourceBadge() {
  if (!source) { sourceBadge.textContent = ''; return; }
  if (source.kind === 'static') sourceBadge.textContent = t('sourceBuiltin');
  else sourceBadge.textContent = t('sourceImported', { name: source.displayName });
}

// 未加载固件时：隐藏空卡片并高亮导入区
function setFirmwareReady(ready) {
  fwCard.classList.toggle('hidden', !ready);
  configCard.classList.toggle('hidden', !ready);
  importCard.classList.toggle('promo', !ready);
  if (!ready) {
    actionsEl.innerHTML = '';
    fwBadge.innerHTML = '';
    fwInfo.textContent = '';
    credStatus.classList.add('hidden');
  }
}

// ---------------------------------------------------------------- 来源激活
async function activateSource(src, opts = {}) {
  await src.load();
  source = src;
  updateSourceBadge();
  const pkgs = src.packages();
  if (!pkgs.length) throw Object.assign(new Error('no package'), { code: 'nopackage' });
  ui.renderVariants(variantsEl, pkgs, pkg, p => selectPackage(p), pickI18n);
  if (opts.silent !== true) {
    importMsg.classList.remove('err');
    importMsg.textContent = src.kind === 'static' ? t('importMsgIdle') : t('importOk', { name: src.displayName, count: pkgs.length });
    if (src.kind === 'dir') log(t('logSourceImported', { name: src.displayName }));
  }
  await selectPackage(pkgs[0]);
  setFirmwareReady(!!profile);
}

async function selectPackage(p) {
  pkg = p;
  ui.syncVariants(variantsEl, p.id, p.group);
  let raw;
  try { raw = await source.profileOf(p); }
  catch (e) { raw = null; }
  if (!raw) { setStatus(t('firmwareNotFound', { path: p.profilePath }), 'err'); return; }
  setDefaultLocale(raw.defaultLocale);
  try {
    profile = normalizeProfile(raw, toolInfo);
  } catch (e) {
    if (e.code === 'schemaTooNew') {
      log(t('logSchemaTooNew', { got: e.got, supported: e.supported }));
      showModal('⚠', t('logSchemaTooNew', { got: e.got, supported: e.supported }));
      profile = null;
      return;
    }
    throw e;
  }
  applyStatic();
  ui.renderSwitches(switchesEl, eraseRow, profile, t);
  ui.renderFields(fieldsEl, profile, p.id, pickI18n);
  fieldsEl.querySelectorAll('input,select,textarea').forEach(el => {
    el.addEventListener('input', () => ui.applyShowWhen(profile, ui.getControlValue));
    el.addEventListener('change', () => ui.applyShowWhen(profile, ui.getControlValue));
  });
  ui.applyShowWhen(profile, ui.getControlValue);
  ui.renderActions(actionsEl, profile.actions, {
    t, pickI18n, labelOf,
    onAction: a => { if (a.type === 'flash') doFlash(); else doSerialAction(a); }
  });
  log(t('logSwitched', { label: (p.group ? p.group + ' · ' : '') + (pickI18n(p.label) || p.id) }));
  await loadManifest();
  refreshActionButtons();
}

async function loadManifest() {
  manifest = null;
  fwBadge.innerHTML = '';
  try { manifest = await source.manifest(pkg); } catch (e) { manifest = null; }
  if (!manifest) {
    fwInfo.innerHTML = `<span style="color:#d63031">${t('firmwareNotFound', { path: pkg.manifestPath })}</span>`;
    log(t('firmwareNotFound', { path: pkg.manifestPath }));
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

// ---------------------------------------------------------------- 按钮状态
function refreshActionButtons() {
  if (!profile) { actionsEl.innerHTML = ''; return; }
  const btns = [...actionsEl.querySelectorAll('button')];
  for (const b of btns) {
    const a = actionById(b.dataset.action);
    if (!a) continue;
    if (a.type === 'flash') b.disabled = !(connected && manifest && !busy);
    else b.disabled = !(connected && !busy);
  }
  btnConnect.disabled = connected || busy;
  btnConnect.textContent = connected ? t('btnConnected') : t('btnConnect');
}
function setBusy(v) { busy = v; refreshActionButtons(); }

// ---------------------------------------------------------------- 导入交互
function showImportError(err) {
  importMsg.classList.add('err');
  if (err && err.code === 'scan' && err.errors) {
    const items = err.errors.map(e => {
      if (e.type === 'missingProfile' || e.type === 'missingManifest') return t('importMissing', { file: e.file });
      if (e.type === 'unexpectedManifest') return t('importUnexpected', { file: e.file });
      return e.file;
    });
    importMsg.innerHTML = `${t('importStrictError')}<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  } else if (err && err.code === 'nopackage') {
    importMsg.textContent = t('importNoPackage');
  } else {
    importMsg.textContent = t('importZipFail', { msg: err && err.message ? err.message : err });
  }
}

async function importEntries(entries, displayName) {
  try {
    await activateSource(new DirectorySource(entries, displayName));
  } catch (err) {
    showImportError(err);
    log(t('importStrictError') + ' ' + (err && err.message ? err.message : err));
  }
}

async function importZipFile(file) {
  try {
    const map = await readZip(await file.arrayBuffer());
    const entries = [...map].map(([path, bytes]) => ({ path, bytes }));
    await importEntries(entries, file.name.replace(/\.zip$/i, ''));
  } catch (err) {
    showImportError(err);
  }
}

// 目录：优先 File System Access API（对话框为“选择文件夹”，无“上传”字样），回退 <input webkitdirectory>
btnImport.addEventListener('click', async () => {
  if (typeof window.showDirectoryPicker === 'function') {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      const { entries, displayName } = await entriesFromDirectoryHandle(handle);
      await importEntries(entries, displayName);
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  fileInput.click();
});
fileInput.addEventListener('change', async () => {
  if (!fileInput.files || !fileInput.files.length) return;
  const src = sourceFromFileList(fileInput.files, '');
  try { await activateSource(src); }
  catch (err) { showImportError(err); }
  fileInput.value = '';
});

// zip：优先 showOpenFilePicker（对话框为“打开”），回退普通文件选择
btnImportZip.addEventListener('click', async () => {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }]
      });
      await importZipFile(await handle.getFile());
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  zipInput.click();
});
zipInput.addEventListener('change', async () => {
  if (!zipInput.files || !zipInput.files.length) return;
  await importZipFile(zipInput.files[0]);
  zipInput.value = '';
});

['dragenter', 'dragover'].forEach(ev => importDrop.addEventListener(ev, e => {
  e.preventDefault(); importDrop.classList.add('drop-active');
}));
['dragleave', 'drop'].forEach(ev => importDrop.addEventListener(ev, e => {
  e.preventDefault(); importDrop.classList.remove('drop-active');
}));
importDrop.addEventListener('drop', async e => {
  const files = [...(e.dataTransfer.files || [])];
  try {
    if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
      await importZipFile(files[0]);
      return;
    }
    const { entries, displayName } = await entriesFromDataTransfer(e.dataTransfer.items);
    await importEntries(entries, displayName);
  } catch (err) {
    showImportError(err);
  }
});

// ---------------------------------------------------------------- 串口工具
// 提交确认参数（对应 接入与使用说明.md「写入时序与可靠性」）
const STABILIZE_MS = 4000;      // 刷机后自动提交前等待（规范 3–5s，取中值）
const SUBMIT_ATTEMPTS = 4;      // 首发 + 最多 3 次重试
const SUBMIT_TIMEOUT_MS = 15000;
const CONFIRM_SETTLE_MS = 500;  // 重试前写 '\n' 后等待设备消化残行

function attachLog(talker) {
  talker.onEvent = msg => log(t('logDeviceMsg', { msg: JSON.stringify(msg) }));
  talker.onLine = line => log(t('logDevice', { line }));
  talker.onParseFail = line => log(t('logParseFail', { line }));
  talker.onSend = (obj, line) => log(t('logSend', { msg: line }));
  talker.onChunks = n => log(t('logChunkedSend', { n }));
}

async function openSerialWithRetry(port, tries = 12, gapMs = 500) {
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

function newMockTalker() {
  const q = new URLSearchParams(location.search);
  const drop = parseInt(q.get('mockDrop') || '0', 10);
  return new MockTalker({
    protocol: profile.protocol, variantId: pkg.id, proto: profile.proto,
    dropCreds: isNaN(drop) ? 0 : drop
  });
}

// ---------------------------------------------------------------- 连接
btnConnect.addEventListener('click', async () => {
  if (busy) return;
  if (MOCK) {
    connected = true;
    setStatus(t('stConnected', { chip: 'MOCK' }), 'ok');
    log(t('logChip', { chip: 'MOCK' }));
    refreshActionButtons();
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
    if (!chipRegex(expect).test(chip)) throw new Error(t('errChipNotMatch', { expect, chip }));
    connected = true;
    setStatus(t('stConnected', { chip }), 'ok');
    refreshActionButtons();
  } catch (e) {
    log(t('logConnectFailed', { msg: e && e.message ? e.message : e }));
    setStatus(t('stConnectFail'), 'err');
    await releasePort();
  } finally {
    refreshActionButtons();
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
  refreshActionButtons();
}

async function ensureSerialPort() {
  if (MOCK) return;
  if (transport || connected) { await releasePort(); await sleep(800); }
  if (!selectedPort) {
    setStatus(t('stSelectPort'));
    selectedPort = await navigator.serial.requestPort();
  }
}

async function openTalker() {
  if (MOCK) {
    if (!mockTalker) mockTalker = newMockTalker();
    const tk = mockTalker;
    attachLog(tk);
    await tk.open();
    return tk;
  }
  const tk = await openSerialWithRetry(selectedPort);
  attachLog(tk);
  return tk;
}

// ---------------------------------------------------------------- 串口会话
async function runSession(talker, action, opts = {}) {
  const proto = profile.protocol;
  let pong = null;
  for (let i = 0; i < 15 && !pong; i++) {
    talker.resetEvents();
    await talker.send({ cmd: proto.ping });
    try { pong = await talker.waitFor(proto.pongEvt, 1000); } catch (e) {}
  }
  if (!pong) throw new Error(t('errNoResponse'));
  log(t('logDeviceResponded', { fw: pong.fw || '?', mode: pong.mode || '-' }));
  if (profile.proto != null && pong.proto != null && pong.proto !== profile.proto) {
    throw new Error(t('errProtoMismatch', { proto: pong.proto, expected: profile.proto }));
  }
  if (pong.mode != null && pkg && pkg.id && pong.mode !== pkg.id) {
    log(t('logModeMismatch', { device: pong.mode, selected: pkg.id }));
  }

  if (opts.stabilizeMs) {
    const sec = opts.stabilizeMs / 1000;
    log(t('logStabilize', { sec }));
    setStatus(t('stStabilizing', { sec }));
    await sleep(opts.stabilizeMs);
  }

  talker.resetEvents();
  await talker.send({ cmd: proto.status });
  const st0 = await talker.waitFor(proto.statusEvt, 3000).catch(() => null);
  if (st0) ui.renderStatus(credStatus, st0, profile.statusView, profile, { t, pickI18n });

  if (action.gate && !ui.swChecked('sw-' + action.gate)) {
    log(t('logActionSkip', { sw: t('sw' + action.gate.charAt(0).toUpperCase() + action.gate.slice(1)) }));
    return { pong, skipped: true };
  }
  if (!action.command) {
    if (action.type !== 'flash') throw new Error(t('errActionNoCommand', { id: action.id }));
    return { pong, skipped: true };
  }

  const visibility = computeVisibility(profile, pkg.id, ui.getControlValue);
  const payload = buildActionPayload(action, profile, {
    switches: switchState(), getValue: ui.getControlValue, visibility
  });
  const dataKeys = dataKeysOf(payload);
  if (action.type === 'submit' && dataKeys.length === 0) {
    log(t('logActionNoData'));
    return { pong, skipped: true };
  }

  const isSubmit = action.type === 'submit';
  if (action.waitFor && action.waitFor.length) {
    let saved = null;
    try {
      const r = await sendAndConfirm(talker, payload, action.waitFor, {
        attempts: isSubmit ? SUBMIT_ATTEMPTS : 1,
        timeoutMs: action.timeoutMs || (isSubmit ? SUBMIT_TIMEOUT_MS : 8000),
        settleMs: CONFIRM_SETTLE_MS,
        rejectEvts: [proto.errorEvt],
        onRetry: info => log(t('logSubmitRetry', {
          n: info.attempt, total: info.total,
          msg: (info.error && info.error.message) || ''
        }))
      });
      saved = r.saved;
    } catch (e) {
      const evts = action.waitFor.join(' / ');
      const tries = isSubmit ? SUBMIT_ATTEMPTS : 1;
      throw new Error(t('errSaveTimeout', {
        evt: evts, tries, msg: (e.cause && e.cause.message) || e.message
      }));
    }
    if (saved && (saved.groups || saved.skipped)) {
      const written = (saved.groups || []).join(', ') || '-';
      if (saved.skipped && saved.skipped.length) log(t('logCredsSavedSkip', { written, skipped: saved.skipped.join(', ') }));
      else log(t('logCredsSaved', { written }));
    }
  } else {
    talker.resetEvents();
    await talker.send(payload);
  }

  let wifiOk;
  if (action.followUp && action.followUp.waitFor &&
      (!action.followUp.ifField || payload[action.followUp.ifField])) {
    setStatus(t('stProvisioningWait'));
    const evt = await talker.waitFor(action.followUp.waitFor, action.followUp.timeoutMs || 45000).catch(() => null);
    if (evt && evt.evt === proto.wifiConnectedEvt) { log(t('logWifiConnected', { ip: evt.ip })); wifiOk = true; }
    else if (evt && evt.evt === proto.wifiFailedEvt) { log(t('logWifiTimeoutStatus', { status: evt.status })); wifiOk = false; }
    else if (evt && evt.evt === proto.errorEvt) { throw new Error(t('errDeviceError', { msg: evt.msg || 'unknown' })); }
    else { log(t('logWifiTimeout')); wifiOk = false; }
  }

  talker.resetEvents();
  await talker.send({ cmd: proto.status });
  const st1 = await talker.waitFor(proto.statusEvt, 3000).catch(() => null);
  if (st1) ui.renderStatus(credStatus, st1, profile.statusView, profile, { t, pickI18n });

  return { pong, wifiOk, skipped: false };
}

async function doSerialAction(action) {
  if (busy) return;
  setBusy(true);
  let talker = null;
  try {
    setStatus(t('stActionDoing', { label: labelOf(action) }));
    await ensureSerialPort();
    talker = await openTalker();
    const r = await runSession(talker, action);
    if (r.skipped) setStatus(t('stProvisionDoneNoCreds'), 'ok');
    else if (r.wifiOk === false) setStatus(t('stProvisionWifiFail'), 'err');
    else if (action.id === 'clear' || action.command === profile.protocol.clearCmd) setStatus(t('stCleared'), 'ok');
    else setStatus(t('stProvisionDone'), 'ok');
  } catch (e) {
    log(t('logProvisionFailed', { msg: e && e.message ? e.message : e }));
    setStatus(t('stProvisionFail', { msg: e && e.message ? e.message : e }), 'err');
  } finally {
    if (talker) await talker.close();
    setBusy(false);
  }
}

// ---------------------------------------------------------------- 烧录
async function doFlash() {
  if (busy || !manifest) return;
  if (!MOCK && (!connected || !esploader)) return;
  setBusy(true);
  const doErase = ui.swChecked('sw-erase');
  try {
    setStatus(t('stVerifying'));
    const fileArray = [];
    for (let i = 0; i < manifest.files.length; i++) {
      const f = manifest.files[i];
      setProgress(i / manifest.files.length * 5, t('stReading', { name: f.name }));
      const buf = await source.bytes(pkg, f.name);
      if (!MOCK) {
        const hex = await sha256Hex(buf);
        if (hex !== String(f.sha256).toLowerCase()) throw new Error(t('errSha', { name: f.name }));
      }
      log(t('logShaOk', { name: f.name, kb: (buf.byteLength / 1024).toFixed(1) }));
      fileArray.push({ data: buf, address: f.offset });
    }

    if (MOCK) {
      setStatus(t('stFlashing'));
      log(t('logFlashing', { variant: pkg.id || '-', mode: manifest.flash.mode, freq: manifest.flash.freq, size: manifest.flash.size, erase: doErase ? t('eraseYes') : t('eraseNo') }));
      setProgress(100, '100%');
    } else {
      const fl = manifest.flash || {};
      setStatus(t('stFlashing'));
      log(t('logFlashing', {
        variant: pkg.id || '-', mode: fl.mode || 'dio', freq: fl.freq || '80m', size: fl.size || '4MB',
        erase: doErase ? t('eraseYes') : t('eraseNo')
      }));
      await esploader.writeFlash({
        fileArray,
        flashMode: fl.mode || 'dio', flashFreq: fl.freq || '80m', flashSize: fl.size || '4MB',
        eraseAll: doErase, compress: true,
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
    }

    let tail = t('tailNotProvisioned');
    let provFail = null;
    const submit = submitAction();
    const willSubmit = submit && (!submit.gate || ui.swChecked('sw-' + submit.gate));
    if (willSubmit) {
      setProgress(100, t('stProvisioning'));
      try {
        await ensureSerialPort();
        const talker = await openTalker();
        try { await runSession(talker, submit, { stabilizeMs: STABILIZE_MS }); } finally { await talker.close(); }
        tail = t('tailProvisioned');
      } catch (e) {
        provFail = e;
        log(t('logProvisionFailed', { msg: e && e.message ? e.message : e }));
        tail = t('tailProvisionIncomplete');
      }
    }
    setProgress(100, '100%');
    if (provFail) {
      setStatus(t('stDoneConfigFail'), 'err');
      showModal('⚠', t('stDoneConfigFail'));
    } else {
      setStatus(t('stDone', { tail }), 'ok');
      showModal('✅', t('stDone', { tail }));
    }
  } catch (e) {
    log(t('logFlashFailed', { msg: e && e.message ? e.message : e }));
    setStatus(t('stFlashFail', { msg: e && e.message ? e.message : e }), 'err');
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------------- 日志导出
btnExportLog.addEventListener('click', () => {
  const text = logEl.textContent || '';
  if (!text.trim()) { log(t('logExportEmpty')); return; }
  const name = `ESPEZUpdater-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  log(t('logExported', { name }));
});

// ---------------------------------------------------------------- 语言切换
$('lang-zh').addEventListener('click', () => setLocale('zh'));
$('lang-en').addEventListener('click', () => setLocale('en'));
onLocaleChange(() => {
  const vals = profile ? ui.captureValues(profile, pkg ? pkg.id : '') : {};
  const sw = switchState();
  applyStatic();
  if (profile) {
    ui.renderSwitches(switchesEl, eraseRow, profile, t);
    ['write', 'update', 'override'].forEach(k => { const el = $('sw-' + k); if (el) el.checked = sw[k]; });
    const e = $('sw-erase'); if (e) e.checked = sw.erase;
    ui.renderFields(fieldsEl, profile, pkg.id, pickI18n);
    Object.entries(vals).forEach(([k, v]) => ui.setControlValue(k, v));
    ui.applyShowWhen(profile, ui.getControlValue);
    ui.renderActions(actionsEl, profile.actions, {
      t, pickI18n, labelOf,
      onAction: a => { if (a.type === 'flash') doFlash(); else doSerialAction(a); }
    });
    refreshActionButtons();
    if (manifest) loadManifest();
  }
});

// ---------------------------------------------------------------- 引导
async function loadToolInfo() {
  try {
    const res = await fetch('version.json', { cache: 'no-store' });
    if (res.ok) toolInfo = await res.json();
  } catch (e) { /* keep defaults */ }
}

async function bootstrap() {
  await loadToolInfo();
  initLocale();
  applyStatic();
  log(t('logReady'));
  log(t('logToolVersion', { version: toolInfo.version }));
  if (MOCK) log('MOCK mode enabled (?mock=1)');

  if (!('serial' in navigator) && !MOCK) {
    browserWarn.classList.remove('hidden');
    setStatus(t('stNoWebSerial'), 'err');
  } else {
    setStatus(t('stDisconnected'));
  }

  try {
    await activateSource(new StaticSource(), { silent: true });
    importMsg.textContent = t('importMsgIdle');
    log(t('logSourceBuiltin'));
  } catch (e) {
    if (MOCK) {
      try { await activateSource(new DemoSource(), { silent: true }); log('MOCK demo source loaded'); return; }
      catch (e2) { /* fall through */ }
    }
    importMsg.classList.remove('err');
    importMsg.textContent = t('importFirstHint');
    setFirmwareReady(false);
    if ('serial' in navigator || MOCK) setStatus(t('stNeedImport'));
    log(t('firmwareNotFound', { path: '/firmware/profile.json' }));
  }
}

bootstrap();
