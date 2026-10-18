// ============================================================================
// protocol.js —— 串口会话（真实 + 模拟）
//   EventTalker : 事件队列 / 等待器公共实现（waitFor 支持 rejectEvts）
//   SerialTalker: Web Serial 读写（大载荷 ≤128B 分块 + 100–300ms 片间隔）
//   MockTalker  : ?mock=1 无硬件回放（ping/status/creds_saved/wifi_*）
//                 与真机同构：分块写入 → 按字节流组装整行；可模拟静默丢行
//   sendAndConfirm: 发送 + 等待确认 + 失败重试（重试前写裸 '\n' 清理残行）
// ============================================================================

import { DEFAULT_PROTOCOL } from './profile-model.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 将整行按 UTF-8 字节切成 ≤maxBytes 的片（设备按字节流拼行，可安全跨片）
export function chunkLine(line, maxBytes = 128) {
  const bytes = new TextEncoder().encode(line);
  const out = [];
  for (let i = 0; i < bytes.length; i += maxBytes) out.push(bytes.subarray(i, i + maxBytes));
  return out;
}

function gapDelay(minMs, maxMs) {
  return minMs + Math.random() * Math.max(0, maxMs - minMs);
}

function deviceError(msg) {
  const err = new Error('device error: ' + (msg.msg || msg.evt));
  err.evt = msg.evt;
  err.msg = msg.msg;
  return err;
}

export class EventTalker {
  constructor() {
    this.buf = '';
    this.events = [];
    this.waiters = [];
    this.onEvent = null;     // (msg) => void
    this.onLine = null;      // (line) => void      非 @ 行
    this.onParseFail = null; // (line) => void
    this.onSend = null;      // (obj, line) => void
    this.onChunks = null;    // (n) => void         分块发送（n > 1）
  }

  _emit(msg) {
    this.events.push(msg);
    if (this.onEvent) { try { this.onEvent(msg); } catch (e) {} }
    const keep = [];
    for (const w of this.waiters) {
      if (w.evts.includes(msg.evt)) { clearTimeout(w.timer); w.resolve(msg); }
      else if (w.rejectEvts && w.rejectEvts.includes(msg.evt)) {
        clearTimeout(w.timer);
        w.reject(deviceError(msg));
      }
      else keep.push(w);
    }
    this.waiters = keep;
  }

  _feed(text) {
    this.buf += text;
    let idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      let line = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 1);
      line = line.replace(/\r$/, '');
      if (!line) continue;
      if (line.startsWith('@')) {
        try { this._emit(JSON.parse(line.slice(1))); }
        catch (e) { if (this.onParseFail) this.onParseFail(line); }
      } else if (this.onLine) {
        this.onLine(line.trim());
      }
    }
  }

  resetEvents() { this.events = []; }

  waitFor(evts, timeoutMs = 15000, rejectEvts = []) {
    const list = Array.isArray(evts) ? evts : [evts];
    const rlist = Array.isArray(rejectEvts) ? rejectEvts : [rejectEvts];
    const past = [...this.events].reverse().find(e => list.includes(e.evt));
    if (past) return Promise.resolve(past);
    const pastErr = [...this.events].reverse().find(e => rlist.includes(e.evt));
    if (pastErr) return Promise.reject(deviceError(pastErr));
    return new Promise((resolve, reject) => {
      const w = { evts: list, rejectEvts: rlist, resolve, reject };
      w.timer = setTimeout(() => {
        this.waiters = this.waiters.filter(x => x !== w);
        const err = new Error('wait timeout: ' + list.join(' / '));
        err.evts = list;
        reject(err);
      }, timeoutMs);
      this.waiters.push(w);
    });
  }
}

export class SerialTalker extends EventTalker {
  constructor(port) {
    super();
    this.port = port;
    this.reader = null;
    this.writer = null;
  }
  async open(baud = 115200) {
    await this.port.open({ baudRate: baud, bufferSize: 8192 });
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    this._pump();
  }
  async _pump() {
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value && value.length) this._feed(new TextDecoder().decode(value));
      }
    } catch (e) { /* port closed */ }
  }
  async send(obj) {
    const line = '@' + JSON.stringify(obj) + '\n';
    if (this.onSend) this.onSend(obj, line.trim());
    await this._writeChunks(line);
  }
  // 裸写文本（重试用：写 '\n' 终结设备侧未闭合残行）
  async sendRaw(text) {
    if (this.onSend) this.onSend({ raw: true }, JSON.stringify(text));
    await this.writer.write(new TextEncoder().encode(text));
  }
  // 大载荷分块：每片 ≤128B，片间隔 100–300ms（规避设备 RX 环形缓冲上限）
  async _writeChunks(line) {
    const chunks = chunkLine(line, 128);
    if (chunks.length > 1 && this.onChunks) this.onChunks(chunks.length);
    for (let i = 0; i < chunks.length; i++) {
      if (i) await sleep(gapDelay(100, 300));
      await this.writer.write(chunks[i]);
    }
  }
  async close() {
    try { if (this.reader) await this.reader.cancel(); } catch (e) {}
    try { if (this.writer) await this.writer.releaseLock(); } catch (e) {}
    try { await this.port.close(); } catch (e) {}
  }
}

export class MockTalker extends EventTalker {
  constructor(opts = {}) {
    super();
    this.protocol = opts.protocol || DEFAULT_PROTOCOL;
    this.variantId = opts.variantId || '';
    this.proto = (opts.proto != null) ? opts.proto : 1;
    this.state = { configured: false, ssid: null };
    this._timers = [];
    this.chunkMaxBytes = opts.chunkMaxBytes || 128;
    this.gapMs = opts.gapMs || [100, 300];
    this.dropCreds = opts.dropCreds || 0;   // 模拟：静默丢弃前 N 条 creds 行
    this.rxBuf = '';
    this.sentChunks = [];                   // 每次写入的片字节数（测试断言）
    this.rawWrites = 0;
    this.droppedCreds = 0;
  }
  async open() {}
  async close() { this._timers.forEach(clearTimeout); this._timers = []; }
  async send(obj) {
    const line = '@' + JSON.stringify(obj) + '\n';
    if (this.onSend) this.onSend(obj, line.trim());
    const chunks = chunkLine(line, this.chunkMaxBytes);
    if (chunks.length > 1 && this.onChunks) this.onChunks(chunks.length);
    const dec = new TextDecoder();
    for (let i = 0; i < chunks.length; i++) {
      if (i) await sleep(gapDelay(this.gapMs[0], this.gapMs[1]));
      this.sentChunks.push(chunks[i].length);
      this._rxChunk(dec.decode(chunks[i], { stream: true }));
    }
  }
  async sendRaw(text) {
    if (this.onSend) this.onSend({ raw: true }, JSON.stringify(text));
    this.rawWrites++;
    this._rxChunk(text);
  }
  // 与真机一致：按字节流积累，遇 '\n' 才解析整行
  _rxChunk(text) {
    this.rxBuf += text;
    let idx;
    while ((idx = this.rxBuf.indexOf('\n')) >= 0) {
      const line = this.rxBuf.slice(0, idx).replace(/\r$/, '');
      this.rxBuf = this.rxBuf.slice(idx + 1);
      if (!line) continue;
      if (!line.startsWith('@')) {
        if (this.onLine) this.onLine(line.trim());
        continue;
      }
      let obj;
      try { obj = JSON.parse(line.slice(1)); }
      catch (e) { if (this.onParseFail) this.onParseFail(line); continue; }
      if (obj && obj.cmd === this.protocol.credsCmd && this.dropCreds > 0) {
        this.dropCreds--; this.droppedCreds++;
        if (this.onLine) this.onLine('[mock] dropped creds line (simulated)');
        continue;
      }
      this._react(obj);
    }
  }
  _later(ms, fn) { this._timers.push(setTimeout(fn, ms)); }
  _react(obj) {
    const p = this.protocol;
    if (obj.cmd === p.ping) {
      this._later(60, () => this._emit({
        evt: p.pongEvt, proto: this.proto, fw: 'MOCK',
        mode: this.variantId || undefined
      }));
      return;
    }
    if (obj.cmd === p.status) { this._later(60, () => this._emit(this._status())); return; }
    if (obj.cmd === p.credsCmd) {
      const groups = [];
      if (obj.ssid != null && obj.ssid !== '') { this.state.ssid = obj.ssid; groups.push('ssid'); }
      later(this, 80, () => this._emit({ evt: p.credsSavedEvt, groups: groups.length ? groups : ['creds'], skipped: [], override: !!obj.override }));
      if (obj.ssid != null && obj.ssid !== '') {
        later(this, 200, () => this._emit({ evt: p.wifiConnectingEvt }));
        if (String(obj.ssid).toLowerCase() === 'fail') {
          later(this, 1200, () => this._emit({ evt: p.wifiFailedEvt, status: 1 }));
        } else {
          later(this, 1500, () => { this.state.configured = true; this._emit({ evt: p.wifiConnectedEvt, ip: '192.168.1.123' }); });
        }
      }
      return;
    }
    if (obj.cmd === p.clearCmd) {
      later(this, 100, () => { this.state.configured = false; this.state.ssid = null; this._emit({ evt: p.clearAckEvt, groups: [], skipped: [] }); });
      return;
    }
    later(this, 50, () => this._emit({ evt: p.errorEvt, msg: 'unknown cmd: ' + obj.cmd }));
  }
  _status() {
    return {
      evt: this.protocol.statusEvt,
      compile: false,
      nvs: this.state.configured,
      override: false,
      state: this.state.configured ? 'connected' : 'provision',
      ip: this.state.configured ? '192.168.1.123' : ''
    };
  }
}

// 发送并等待确认；失败自动重试（重试前写裸 '\n' 清理设备残行）
// opts: { attempts=1, timeoutMs=15000, settleMs=500, rejectEvts=[], onRetry(info) }
// 返回 { saved, attempts }；耗尽时抛 err.attempts / err.evts / err.cause
export async function sendAndConfirm(talker, payload, evts, opts = {}) {
  const attempts = opts.attempts || 1;
  const timeoutMs = opts.timeoutMs || 15000;
  const settleMs = (opts.settleMs != null) ? opts.settleMs : 500;
  const rejectEvts = opts.rejectEvts || [];
  let last = null;
  for (let i = 1; i <= attempts; i++) {
    if (i > 1) {
      if (opts.onRetry) opts.onRetry({ attempt: i, total: attempts, error: last });
      await talker.sendRaw('\n');
      await sleep(settleMs);
    }
    talker.resetEvents();
    await talker.send(payload);
    try {
      const saved = await talker.waitFor(evts, timeoutMs, rejectEvts);
      return { saved, attempts: i };
    } catch (e) { last = e; }
  }
  const err = new Error(last ? last.message : 'confirm failed');
  err.attempts = attempts;
  err.evts = Array.isArray(evts) ? evts : [evts];
  err.cause = last;
  throw err;
}

function later(self, ms, fn) { self._later(ms, fn); }
