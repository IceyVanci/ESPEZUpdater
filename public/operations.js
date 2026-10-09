// ============================================================================
// operations.js —— 通用动作的载荷构建（纯函数）
// ============================================================================

export function fieldInVariant(f, variantId) {
  if (!f.variants || !f.variants.length) return true;
  return f.variants.includes(variantId);
}

export function groupInVariant(g, variantId) {
  if (!g.variants || !g.variants.length) return true;
  return g.variants.includes(variantId);
}

// 依据 showWhen 计算每个字段是否可见
export function computeVisibility(profile, variantId, getValue) {
  const vis = {};
  for (const f of (profile.fields || [])) {
    if (!fieldInVariant(f, variantId)) { vis[f.key] = false; continue; }
    let visible = true;
    if (f.showWhen) {
      for (const [dep, want] of Object.entries(f.showWhen)) {
        if (getValue(dep) !== want) { visible = false; break; }
      }
    }
    vis[f.key] = visible;
  }
  return vis;
}

// 构建动作载荷；未出现的键 = 设备侧该组不动
export function buildActionPayload(action, profile, ctx) {
  const payload = {};
  if (action.command) payload.cmd = action.command;
  if (action.static) Object.assign(payload, action.static);
  for (const sw of (action.switches || [])) {
    payload[sw] = !!(ctx.switches && ctx.switches[sw]);
  }

  const fieldMap = new Map((profile.fields || []).map(f => [f.key, f]));
  const keys = action.fields || (profile.fields || []).map(f => f.key);
  for (const key of keys) {
    const f = fieldMap.get(key);
    if (!f) continue;
    if (ctx.visibility && ctx.visibility[key] === false) continue;
    const raw = ctx.getValue(key);
    if (raw === '' || raw == null) continue;
    if ((f.type || 'text') === 'number') {
      const n = parseInt(raw, 10);
      if (!isNaN(n)) payload[key] = n;
    } else {
      payload[key] = raw;
    }
  }
  return payload;
}

// 载荷中除控制键外的业务数据键
const CONTROL_KEYS = new Set(['cmd', 'write', 'update', 'override', 'groups']);
export function dataKeysOf(payload) {
  return Object.keys(payload).filter(k => !CONTROL_KEYS.has(k));
}
