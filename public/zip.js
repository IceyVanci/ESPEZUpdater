// ============================================================================
// zip.js —— 最小 ZIP 读取器
//   仅支持 stored(0) 与 deflate(8)；用于“拖入 .zip 固件包”时在浏览器内解包。
//   依赖浏览器原生 DecompressionStream('deflate-raw')，不引入任何第三方库。
// ============================================================================

function normalizeZipName(name) {
  return String(name).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function findEOCD(view) {
  for (let i = view.byteLength - 22; i >= 0 && i >= view.byteLength - 22 - 65536; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream unavailable in this browser');
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

// 返回 Map<path, Uint8Array>（path 已归一化为正斜杠、无前导 ./）
export async function readZip(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const eocd = findEOCD(view);
  if (eocd < 0) throw new Error('not a zip file (EOCD not found)');
  if (view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) {
    throw new Error('multi-disk zip is not supported');
  }
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const out = new Map();
  const decoder = new TextDecoder('utf-8');

  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const flags = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));

    const lhNameLen = view.getUint16(localOffset + 26, true);
    const lhExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
    const compData = bytes.subarray(dataStart, dataStart + compSize);

    let data;
    if (method === 0) data = compData.slice();
    else if (method === 8) data = await inflateRaw(compData);
    else throw new Error('unsupported zip compression method ' + method);

    const path = normalizeZipName(name);
    if (path && !path.endsWith('/')) out.set(path, data);

    offset += 46 + nameLen + extraLen + commentLen;
  }
  if (out.size === 0) throw new Error('zip contains no files');
  return out;
}

export function zipToEntries(filesMap, displayName) {
  const entries = [];
  for (const [path, bytes] of filesMap) entries.push({ path, bytes });
  return { entries, displayName };
}
