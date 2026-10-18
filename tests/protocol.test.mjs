// ============================================================================
// protocol.test.mjs —— 串口协议层自测（无框架）
//   运行：node tests/protocol.test.mjs
//   覆盖：大载荷分块、首次无响应→重试成功、残行清理、设备 error、失败路径
// ============================================================================
import assert from 'node:assert/strict';
import { MockTalker, sendAndConfirm, chunkLine } from '../public/protocol.js';
import { DEFAULT_PROTOCOL } from '../public/profile-model.js';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('PASS  ' + name); }
  catch (e) {
    failed++; process.exitCode = 1;
    console.log('FAIL  ' + name);
    console.log('      ' + (e && e.message ? e.message : e));
  }
}

const BIG = {
  cmd: DEFAULT_PROTOCOL.credsCmd, write: true, update: true, override: false,
  ssid: 'MyHomeWiFi-2.4G-测试网络',
  pass: 'p@ssw0rd-' + 'x'.repeat(200) + '-密码'
};
const BIG_LINE = '@' + JSON.stringify(BIG) + '\n';
const BIG_BYTES = new TextEncoder().encode(BIG_LINE).length;
const SAVED = DEFAULT_PROTOCOL.credsSavedEvt;
const ERR = DEFAULT_PROTOCOL.errorEvt;

function newMock(opts = {}) { return new MockTalker({ gapMs: [1, 2], ...opts }); }

await test('前置：载荷 ≥290B（实测 ' + BIG_BYTES + 'B）', () => {
  assert.ok(BIG_BYTES >= 290, 'payload too small: ' + BIG_BYTES);
});

await test('分块路径：片 ≤128B、≥3 片，mock 组装后确认 creds_saved', async () => {
  const tk = newMock();
  try {
    const r = await sendAndConfirm(tk, BIG, [SAVED], { attempts: 1, timeoutMs: 1000, rejectEvts: [ERR] });
    assert.equal(r.saved.evt, SAVED);
    assert.ok(tk.sentChunks.length >= 3, 'chunks=' + tk.sentChunks.length);
    assert.ok(tk.sentChunks.every(n => n <= 128), 'chunk >128B: ' + tk.sentChunks.join(','));
    assert.equal(tk.rawWrites, 0);
  } finally { await tk.close(); }
});

await test('chunkLine：UTF-8 字节重组与原文一致（含中文）', () => {
  const chunks = chunkLine(BIG_LINE, 128);
  const re = Buffer.concat(chunks.map(c => Buffer.from(c)));
  assert.deepEqual([...re], [...new TextEncoder().encode(BIG_LINE)]);
});

await test('首次无响应→重试成功（dropCreds:1）', async () => {
  const tk = newMock({ dropCreds: 1 });
  try {
    const retries = [];
    const r = await sendAndConfirm(tk, BIG, [SAVED], {
      attempts: 4, timeoutMs: 300, settleMs: 20, rejectEvts: [ERR],
      onRetry: info => retries.push(info.attempt)
    });
    assert.equal(r.attempts, 2);
    assert.equal(tk.droppedCreds, 1);
    assert.equal(tk.rawWrites, 1);
    assert.deepEqual(retries, [2]);
  } finally { await tk.close(); }
});

await test('残行清理：sendRaw(\\n) 终结并丢弃设备侧截断残行', async () => {
  const tk = newMock();
  try {
    const fails = [];
    tk.onParseFail = line => fails.push(line);
    tk.rxBuf = '@{"cmd":"creds","write":tr';
    await tk.sendRaw('\n');
    assert.deepEqual(fails, ['@{"cmd":"creds","write":tr']);
    assert.equal(tk.rxBuf, '');
    assert.equal(tk.rawWrites, 1);
  } finally { await tk.close(); }
});

await test('设备 error：等待即失败（不等超时）且重试可见', async () => {
  const tk = newMock();
  try {
    const orig = tk._react.bind(tk);
    tk._react = obj => {
      if (obj.cmd === DEFAULT_PROTOCOL.credsCmd) tk._later(10, () => tk._emit({ evt: ERR, msg: 'bad json' }));
      else orig(obj);
    };
    const retries = [];
    let err = null;
    try {
      await sendAndConfirm(tk, BIG, [SAVED], {
        attempts: 2, timeoutMs: 5000, settleMs: 10, rejectEvts: [ERR],
        onRetry: info => retries.push(info.error && info.error.msg)
      });
    } catch (e) { err = e; }
    assert.ok(err, 'should throw');
    assert.equal(err.cause && err.cause.evt, ERR);
    assert.equal(err.cause && err.cause.msg, 'bad json');
    assert.deepEqual(retries, ['bad json']);
    assert.equal(err.attempts, 2);
  } finally { await tk.close(); }
});

await test('全部无响应：抛错带 attempts/evts，重试 3 次', async () => {
  const tk = newMock({ dropCreds: 99 });
  try {
    const retries = [];
    let err = null;
    try {
      await sendAndConfirm(tk, BIG, [SAVED], {
        attempts: 4, timeoutMs: 150, settleMs: 10, rejectEvts: [ERR],
        onRetry: info => retries.push(info.attempt)
      });
    } catch (e) { err = e; }
    assert.ok(err, 'should throw');
    assert.equal(err.attempts, 4);
    assert.deepEqual(err.evts, [SAVED]);
    assert.deepEqual(retries, [2, 3, 4]);
    assert.equal(tk.droppedCreds, 4);
    assert.equal(tk.rawWrites, 3);
  } finally { await tk.close(); }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
