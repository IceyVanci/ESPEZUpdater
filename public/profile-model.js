// ============================================================================
// profile-model.js —— profile 归一化与版本门禁
//   支持 schema 1 与 schema 2：
//     - schema 1：自动合成默认“烧录 / 写入配置 / 清除”动作与 auto 状态视图；
//     - schema 2：可使用 actions[] 与 statusView 完全自定义。
//   工具支持上限取自 version.json 的 profileSchema。
// ============================================================================

export const DEFAULT_PROTOCOL = {
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

export function defaultActions(protocol) {
  return [
    {
      id: 'flash', type: 'flash', i18nKey: 'actFlash',
      label: { zh: '开始升级', en: 'Flash firmware' }
    },
    {
      id: 'submit', type: 'submit', i18nKey: 'actSubmit', gate: 'write',
      label: { zh: '写入配置', en: 'Apply configuration' },
      command: protocol.credsCmd,
      static: { write: true },
      switches: ['update', 'override'],
      waitFor: [protocol.credsSavedEvt],
      followUp: {
        waitFor: [protocol.wifiConnectedEvt, protocol.wifiFailedEvt, protocol.errorEvt],
        timeoutMs: 45000, ifField: 'ssid'
      }
    },
    {
      id: 'clear', type: 'custom', i18nKey: 'actClear',
      label: { zh: '清除配置', en: 'Clear configuration' },
      command: protocol.clearCmd,
      static: { groups: ['all'] },
      waitFor: [protocol.clearAckEvt]
    }
  ];
}

export function normalizeProfile(raw, toolInfo) {
  raw = raw || {};
  const schema = raw.schema == null ? 1 : Number(raw.schema);
  const max = (toolInfo && Number(toolInfo.profileSchema)) || 2;
  if (schema > max) {
    const e = new Error('profile schema too new');
    e.code = 'schemaTooNew';
    e.got = schema;
    e.supported = max;
    throw e;
  }
  const protocol = Object.assign({}, DEFAULT_PROTOCOL, raw.protocol || {});
  const actions = (raw.actions && raw.actions.length) ? raw.actions : defaultActions(protocol);
  const statusView = raw.statusView || { mode: 'auto' };
  return {
    schema,
    proto: raw.proto,
    product: raw.product,
    defaultLocale: raw.defaultLocale,
    variants: raw.variants || [],
    switches: raw.switches || {},
    groups: raw.groups || [],
    fields: raw.fields || [],
    protocol,
    actions,
    statusView,
    raw
  };
}

export function actionLabel(action, t, pickI18n) {
  if (action.label) return pickI18n(action.label) || action.id;
  if (action.i18nKey) return t(action.i18nKey);
  return action.id;
}
