// ============================================================================
// firmware-source.js —— 固件来源抽象
//   StaticSource   : 内置固件（fetch /firmware/...）
//   DirectorySource: 本地导入目录 / zip（浏览器 File / 解包字节）
//   统一接口（供 app 使用）：
//     await src.load()
//     src.packages()            -> [{ id, base, manifestPath, profilePath, label, group, root }]
//     await src.manifest(pkg)   -> manifest 对象（缺失返回 null）
//     await src.profileOf(pkg)  -> 该包根 profile
//     await src.bytes(pkg,name) -> Uint8Array
//     src.rootProfile / src.displayName / src.kind
// ============================================================================

import { normalizePath, joinPath, baseFor, scanEntries, validatePackage, entriesFromFileList } from './package-scan.js';

async function fetchJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + path);
  return res.json();
}

export class StaticSource {
  constructor() {
    this.kind = 'static';
    this.displayName = 'built-in';
    this.rootProfile = null;
    this._packages = [];
    this._profiles = new Map();
  }

  async load() {
    this.rootProfile = await fetchJSON('/firmware/profile.json');
    this._profiles.set('', this.rootProfile);
    const declared = (this.rootProfile.variants && this.rootProfile.variants.length)
      ? this.rootProfile.variants
      : [{ id: '' }];
    this._packages = declared.map(v => {
      const base = '/firmware/' + (v.id ? v.id + '/' : '');
      return {
        id: v.id || '',
        base,
        manifestPath: base + 'manifest.json',
        profilePath: base + 'profile.json',
        label: (v && v.label) || this.rootProfile.product,
        group: '',
        root: ''
      };
    });
  }

  packages() { return this._packages; }

  async manifest(pkg) {
    try { return await fetchJSON(pkg.manifestPath); } catch (e) { return null; }
  }

  async profileOf() { return this.rootProfile; }

  async bytes(pkg, name) {
    const res = await fetch(pkg.base + name, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (pkg.base + name));
    return new Uint8Array(await res.arrayBuffer());
  }
}

// 条目存储：统一 file 与 bytes 两种来源
class EntryStore {
  constructor(entries) {
    this._map = new Map();
    for (const e of (entries || [])) {
      const path = normalizePath(e.path);
      if (!path || path.endsWith('/')) continue;
      this._map.set(path, e);
    }
  }
  has(path) { return this._map.has(normalizePath(path)); }
  async readBytes(path) {
    const p = normalizePath(path);
    const e = this._map.get(p);
    if (!e) throw new Error('missing file: ' + p);
    if (e.bytes) return e.bytes.slice ? e.bytes.slice() : new Uint8Array(e.bytes);
    const buf = await e.file.arrayBuffer();
    return new Uint8Array(buf);
  }
  async readJSON(path) {
    const bytes = await this.readBytes(path);
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  }
}

export class DirectorySource {
  constructor(entries, displayName) {
    this.kind = 'dir';
    this.displayName = displayName || 'imported';
    this.store = new EntryStore(entries);
    this.rootProfile = null;
    this._packages = [];
    this._profiles = new Map();
  }

  async load() {
    const entries = [...this.store._map.entries()].map(([path, e]) => ({ path, file: e.file }));
    const { roots, errors } = scanEntries(entries);
    const errList = [...errors];
    if (!roots.length && !errList.length) errList.push({ type: 'nopackage', dir: '', file: 'profile.json' });

    const multi = roots.length > 1;
    const packages = [];
    for (const r of roots) {
      let profile;
      try { profile = await this.store.readJSON(r.profilePath); }
      catch (e) { errList.push({ type: 'missingProfile', dir: r.root, file: r.profilePath }); continue; }
      this._profiles.set(r.root, profile);
      const { variants, errors: verr } = validatePackage(r.root, profile, r.manifestDirs);
      errList.push(...verr);
      const group = multi ? (r.root || this.displayName) : '';
      for (const v of variants) {
        packages.push({
          id: v.id,
          base: v.base,
          manifestPath: v.base + 'manifest.json',
          profilePath: v.base + 'profile.json',
          label: v.label,
          group,
          root: r.root
        });
      }
    }

    if (errList.length) {
      const err = new Error('firmware package validation failed');
      err.code = 'scan';
      err.errors = errList;
      throw err;
    }
    if (!packages.length) {
      const err = new Error('no firmware package found');
      err.code = 'nopackage';
      throw err;
    }

    this._packages = packages;
    this.rootProfile = this._profiles.get(packages[0].root) || null;
  }

  packages() { return this._packages; }

  async manifest(pkg) {
    if (!this.store.has(pkg.manifestPath)) return null;
    try { return await this.store.readJSON(pkg.manifestPath); }
    catch (e) { return null; }
  }

  async profileOf(pkg) {
    if (pkg && this._profiles.has(pkg.root)) return this._profiles.get(pkg.root);
    return this.rootProfile;
  }

  async bytes(pkg, name) {
    return this.store.readBytes(pkg.base + name);
  }
}

// 演示来源：?mock=1 且无内置固件时使用（自包含 UI 回归）
export class DemoSource {
  constructor() {
    this.kind = 'demo';
    this.displayName = 'demo';
    this.rootProfile = {
      schema: 2, proto: 1,
      product: { zh: '演示固件', en: 'Demo firmware' },
      defaultLocale: 'zh',
      variants: [{ id: 'default', label: { zh: '标准固件', en: 'Standard' } }],
      switches: {
        write: { default: true, visible: true }, update: { default: true, visible: true },
        override: { default: false, visible: true }, erase: { default: true, visible: true }
      },
      groups: [{ id: 'network', label: { zh: '网络', en: 'Network' } }],
      fields: [
        { key: 'ssid', group: 'network', label: { zh: 'WiFi 名称 (SSID)', en: 'WiFi SSID' }, type: 'text', maxlength: 32, placeholder: { zh: '填 fail 模拟失败', en: 'type fail to simulate failure' } },
        { key: 'pass', group: 'network', label: { zh: 'WiFi 密码', en: 'WiFi password' }, type: 'password', sensitive: true, maxlength: 63 }
      ],
      statusView: { mode: 'auto' }
    };
    const size = 4096;
    this.manifestObj = {
      version: '20261009', chip: 'esp32c3', credentials: 'empty',
      flash: { mode: 'dio', freq: '80m', size: '4MB' },
      files: [
        { name: 'bootloader.bin', offset: 0, size, sha256: '' },
        { name: 'partitions.bin', offset: 0x8000, size, sha256: '' },
        { name: 'boot_app0.bin', offset: 0xE000, size, sha256: '' },
        { name: 'app.bin', offset: 0x10000, size, sha256: '' }
      ]
    };
    this._packages = [];
  }
  async load() {
    this._packages = [{
      id: 'default', base: 'demo/', manifestPath: 'demo/manifest.json', profilePath: 'demo/profile.json',
      label: { zh: '标准固件', en: 'Standard' }, group: '', root: ''
    }];
  }
  packages() { return this._packages; }
  async manifest() { return this.manifestObj; }
  async profileOf() { return this.rootProfile; }
  async bytes(pkg, name) {
    const f = this.manifestObj.files.find(x => x.name === name);
    return new Uint8Array(f ? f.size : 16);
  }
}

// 构造 DirectorySource 的辅助：来自 <input webkitdirectory>
export function sourceFromFileList(fileList) {
  const { entries, displayName } = entriesFromFileList(fileList);
  return new DirectorySource(entries, displayName);
}

// 拖拽目录：遍历 DataTransferItem，返回 entries
export async function entriesFromDataTransfer(items) {
  const out = [];
  const roots = [];

  async function walk(entry, prefix) {
    if (!entry) return;
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ path: joinPath(prefix, entry.name), file });
      return;
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const child of batch) await walk(child, joinPath(prefix, entry.name));
      } while (batch.length);
    }
  }

  const all = [];
  for (const it of items) {
    const entry = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
    if (entry) all.push(entry);
  }
  // 顶层目录作为根（displayName），其内容相对根
  for (const entry of all) {
    if (entry.isDirectory) {
      roots.push(entry.name);
      await walk(entry, '');
    } else if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ path: file.name, file });
    }
  }
  return { entries: out, displayName: roots.length === 1 ? roots[0] : 'dropped' };
}
