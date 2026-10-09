// ============================================================================
// protocol.js —— 串口会话（真实 + 模拟）
//   EventTalker : 事件队列 / 等待器公共实现
//   SerialTalker: Web Serial 读写
//   MockTalker  : ?mock=1 无硬件回放（ping/status/creds_saved/wifi_*）
// ============================================================================

import { DEFAULT_PROTOCOL } from './profile-model.js';

export class EventTalker {
  constructor() {
    this.buf = '';
    this.events = [];
    this.waiters = [];
    this.onEvent = null;     // (msg) => void
    this.onLine = null;      // (line) => void      非 @ 行
    this.onParseFail = null; // (line) => void
    this.onSend = null;      // (obj, line) => void
  }

  _emit(msg) {
    this.events.push(msg);
    if (this.onEvent) { try { this.onEvent(msg); } catch (e) {} }
    const keep = [];
    for (const w of this.waiters) {
      if (w.evts.includes(msg.evt)) { clearTimeout(w.timer); w.resolve(msg); }
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

  waitFor(evts, timeoutMs = 15000) {
    const list = Array.isArray(evts) ? evts : [evts];
    const past = [...this.events].reverse().find(e => list.includes(e.evt));
    if (past) return Promise.resolve(past);
    return new Promise((resolve, reject) => {
      const w = { evts: list, resolve };
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
    await this.writer.write(new TextEncoder().encode(line));
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
  }
  async open() {}
  async close() { this._timers.forEach(clearTimeout); this._timers = []; }
  async send(obj) {
    if (this.onSend) this.onSend(obj, '@' + JSON.stringify(obj));
    this._react(obj);
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

function later(self, ms, fn) { self._later(ms, fn); }
