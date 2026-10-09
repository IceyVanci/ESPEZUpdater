// ============================================================================
// package-scan.js —— 目录扫描与严格校验
//   输入：归一化后的条目数组 [{ path, file }]（file 为浏览器的 File 对象）
//   scanEntries() 返回候选 { profileDirs(浅→深), manifestDirs, errors }；
//   validatePackage(root, profile, manifestDirs) 按“该根之下的 manifest”与
//   profile.variants 精确比对，选出真正自洽的包根（容错变体目录内的 profile 副本）。
// ============================================================================

export function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

export function dirName(path) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function joinPath(dir, name) {
  if (!dir) return name;
  return dir.replace(/\/+$/, '') + '/' + name;
}

// 由 <input webkitdirectory> 的 FileList 生成条目；若所有路径共享同一顶层目录，则剥离之。
export function entriesFromFileList(fileList, displayName) {
  let entries = [...fileList].map(f => ({
    path: normalizePath(f.webkitRelativePath || f.name),
    file: f
  }));
  const tops = new Set(entries.map(e => e.path.split('/')[0]));
  if (entries.length && entries.every(e => e.path.includes('/')) && tops.size === 1) {
    const top = [...tops][0] + '/';
    entries = entries.map(e => ({ path: e.path.slice(top.length), file: e.file }));
    if (!displayName) displayName = [...tops][0];
  }
  return { entries, displayName: displayName || 'firmware' };
}

// 扫描条目，返回候选集合 { profileDirs, manifestDirs, errors }
//   profileDirs : 含 profile.json 的目录（按深度由浅到深排序）
//   manifestDirs: 含 manifest.json 的目录
//   errors      : manifest 找不到 profile 祖先的项
export function scanEntries(entries) {
  const paths = new Set(entries.map(e => normalizePath(e.path)));
  const profileDirs = new Set();
  const manifestDirs = new Set();
  for (const p of paths) {
    if (p === 'profile.json' || p.endsWith('/profile.json')) profileDirs.add(dirName(p));
    if (p === 'manifest.json' || p.endsWith('/manifest.json')) manifestDirs.add(dirName(p));
  }

  const errors = [];
  for (const md of manifestDirs) {
    let d = md;
    let found = false;
    for (;;) {
      if (profileDirs.has(d)) { found = true; break; }
      if (d === '') break;
      d = dirName(d);
    }
    if (!found) errors.push({ type: 'missingProfile', dir: md, file: joinPath(md, 'profile.json') });
  }

  const profiles = [...profileDirs].sort((a, b) => depth(a) - depth(b));
  return { profileDirs: profiles, manifestDirs: [...manifestDirs], errors };
}

export function depth(dir) {
  return dir ? dir.split('/').length : 0;
}

// root 是否包含 dir（root==='' 视为包含全部）
export function isUnder(dir, root) {
  if (root === '') return true;
  return dir === root || dir.startsWith(root + '/');
}

// 校验一个包根：profile.variants 与“该根之下”的 manifest 目录必须严格对应
//   profile 内容已知时调用，返回 { variants:[{id,base,label}], errors:[...] }
export function validatePackage(root, profile, manifestDirs) {
  const errors = [];
  const variants = [];
  const declared = (profile && profile.variants && profile.variants.length)
    ? profile.variants
    : [{ id: '' }];

  const expected = new Set();
  for (const v of declared) {
    const base = baseFor(root, v.id);
    const baseDir = base.replace(/\/$/, '');
    expected.add(baseDir);
    if (!manifestDirs.includes(baseDir)) {
      errors.push({
        type: 'missingManifest',
        dir: baseDir,
        file: joinPath(baseDir, 'manifest.json')
      });
    }
    variants.push({ id: v.id || '', base, label: (v && v.label) || (profile && profile.product) });
  }
  for (const md of manifestDirs) {
    if (!isUnder(md, root)) continue;
    if (!expected.has(md)) {
      errors.push({ type: 'unexpectedManifest', dir: md, file: joinPath(md, 'manifest.json') });
    }
  }
  return { variants, errors };
}

export function baseFor(root, vid) {
  if (!vid) return root ? root.replace(/\/+$/, '') + '/' : '';
  return joinPath(root, vid) + '/';
}
