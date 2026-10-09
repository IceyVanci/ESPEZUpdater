// ============================================================================
// package-scan.js —— 目录扫描与严格校验
//   输入：归一化后的条目数组 [{ path, file }]（file 为浏览器的 File 对象）
//   输出：候选“固件包根”列表；严格模式：manifest 所在目录必须有 profile 祖先。
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

// 扫描条目，返回 { roots, errors }
//   roots: [{ root, profilePath, manifestDirs: [dir,...] }]
//   errors: [{ type:'missingProfile', dir, file }]
export function scanEntries(entries) {
  const paths = new Set(entries.map(e => normalizePath(e.path)));
  const profileDirs = new Set();
  const manifestDirs = new Set();
  for (const p of paths) {
    if (p === 'profile.json' || p.endsWith('/profile.json')) profileDirs.add(dirName(p));
    if (p === 'manifest.json' || p.endsWith('/manifest.json')) manifestDirs.add(dirName(p));
  }

  const errors = [];
  const rootMap = new Map();
  for (const md of manifestDirs) {
    const root = nearestIn(profileDirs, md);
    if (root === null) {
      errors.push({ type: 'missingProfile', dir: md, file: joinPath(md, 'profile.json') });
      continue;
    }
    if (!rootMap.has(root)) rootMap.set(root, new Set());
    rootMap.get(root).add(md);
  }

  const roots = [];
  for (const [root, mds] of rootMap) {
    roots.push({ root, profilePath: joinPath(root, 'profile.json'), manifestDirs: [...mds] });
  }
  return { roots, errors };
}

function nearestIn(dirSet, start) {
  let d = start;
  for (;;) {
    if (dirSet.has(d)) return d;
    if (d === '') return null;
    d = dirName(d);
  }
}

// 校验一个包根：profile.variants 与 manifest 目录必须严格对应
//   profile 内容已知时调用，返回 { variants:[{id,base}], errors:[msg] }
export function validatePackage(root, profile, manifestDirs) {
  const dirSet = new Set(manifestDirs);
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
    if (!dirSet.has(baseDir)) {
      errors.push({
        type: 'missingManifest',
        dir: baseDir,
        file: joinPath(baseDir, 'manifest.json')
      });
    }
    variants.push({ id: v.id || '', base, label: (v && v.label) || (profile && profile.product) });
  }
  for (const md of manifestDirs) {
    if (!expected.has(md)) {
      errors.push({ type: 'unexpectedManifest', dir: md, file: joinPath(md, 'manifest.json') });
    }
  }
  return { variants, errors };
}

export function baseFor(root, vid) {
  let base = joinPath(root, vid || '');
  if (base) base += '/';
  return base;
}
