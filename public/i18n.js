// ============================================================================
// i18n.js —— 中英双语字典与切换（通用工具自身文案）
//   profile 内的文本由 pickI18n() 按同规则解析，二者互不依赖。
// ============================================================================

export const DICT = {
  zh: {
    // 标题
    title: '{product} · 固件升级工具',
    subtitle: '通过 USB 数据线（Type-C）直连设备升级固件 / 配置凭据',

    // 分区标题
    sectionFirmware: '固件包信息',
    sectionProvision: '配网设置（选填，留空 = 不修改设备中的该项）',
    sectionOperation: '升级操作',
    sectionStatus: '设备凭据状态（内置 / NVS / 覆盖位 / 当前值）',
    sectionLog: '日志',
    sectionNotice: '注意事项',

    // 固件包
    loadingFirmware: '正在读取固件包信息…',
    firmwareNotFound: '未找到固件包（{path}）。请维护者先运行 build_common.ps1 生成固件包后，再重新打开本工具。',
    badgeEmpty: '空凭据（可安全分发）',
    badgeHasCreds: '含内置凭据',
    warnHasCreds: '⚠ 该固件包标记为「含内置凭据」，请勿公开分发',
    thFile: '文件',
    thOffset: '偏移',
    thSize: '大小',
    versionPrefix: '版本',

    // 操作
    btnConnect: '连接设备',
    btnConnected: '已连接',
    btnReconnect: '重新连接并配网',
    btnFlash: '开始升级',
    btnProvision: '仅配网',
    btnClear: '清除配网信息',
    step1: '用 USB 数据线连接设备与电脑',
    step2: '点击「连接设备」，在弹窗中选择设备串口',
    step3: '点击「开始升级」（刷完会自动配网）',

    // 开关
    swWrite: '写入',
    swWriteHelp: '本次是否把上面的凭据下发到设备',
    swUpdate: '更新',
    swUpdateHelp: '设备已有该项时是否替换；不勾则沿用设备中已写入的旧凭据',
    swOverride: '覆盖',
    swOverrideHelp: '置持久覆盖位，压过固件内置值',
    swErase: '烧录前全擦除',
    swEraseHelp: '会清空设备全部配置（含已写入的凭据），烧录后必须重新配网',

    // 状态
    stDisconnected: '未连接设备',
    stSelectPort: '请选择设备串口…',
    stHandshaking: '正在握手（设备会自动复位进入下载模式）…',
    stConnected: '已连接 {chip}，可以开始升级或配网',
    stVerifying: '正在校验固件完整性…',
    stReading: '读取 {name}…',
    stFlashing: '正在升级，请勿断电、勿拔线…',
    stRestart: '重启设备…',
    stProvisioning: '正在配置凭据…',
    stProvisioningWait: '凭据已写入，等待设备连接 WiFi…',
    stDone: '✅ 升级完成！{tail}，可关闭窗口拔线',
    stProvisionDone: '✅ 配网完成',
    stProvisionDoneNoCreds: '已完成配网检查（未下发凭据）',
    stProvisionWifiFail: '凭据已写入，但 WiFi 未连上，请核对 WiFi 名称/密码',
    stFlashFail: '❌ 升级失败：{msg}（可重试；若变砖用 flash_cli.bat 恢复）',
    stProvisionFail: '❌ 配网失败：{msg}',
    stNoWebSerial: '当前浏览器不支持 Web Serial',
    stNoManifest: '未找到固件包（manifest.json），请先运行 build_common.ps1',
    stConnectFail: '连接失败，请重试（保持设备接好 USB）',
    stCleared: '✅ 已清除配网信息',
    tailProvisioned: '已配网',
    tailSkipped: '已跳过（按当前设置未下发凭据）',
    tailNotProvisioned: '未配网（未勾选写入或未填写）',
    tailProvisionIncomplete: '配网未完成（可稍后点「仅配网」重试）',
    tailNotProvisionedShort: '未填写 WiFi，可用「仅配网」配置',

    // 浏览器告警
    browserWarn: '当前浏览器不支持 Web Serial（需 Chrome / Edge 89+）。<br>请改用命令行工具：双击目录中的 <b>flash_cli.bat</b>',

    // 凭据状态表
    thGroup: '组',
    thCompile: '内置',
    thNvs: 'NVS',
    thOverride: '覆盖',
    thValue: '当前值',
    yes: '有',
    no: '无',
    on: '开',
    off: '关',
    wifiLabel: 'WiFi',
    stateProvision: '配网等待',
    stateConnecting: '连接中',
    stateConnected: '已连接',
    stateFailed: '失败',
    stateDisconnected: '未连接',

    // 日志
    logReady: '升级工具已就绪。',
    logSwitched: '已切换到「{label}」',
    logPackageLoaded: '固件包已加载：v{version}（{mode} / {freq} / {size}）',
    logShaOk: '{name} 校验通过 ({kb} KB)',
    logChip: '检测到芯片: {chip}',
    logFlashing: '开始烧录（{variant} 模式，{mode} / {freq} / {size}，{erase}）…',
    eraseYes: '全擦除（将清空已写入凭据）',
    eraseNo: '不擦除（保留设备配置）',
    logWriteDone: '写入完成，正在重启设备…',
    logResetHint: '复位提示: {msg}',
    logProvisionOpen: '正在以 {baud} 打开串口进行配网…',
    logDeviceResponded: '设备已响应：固件 v{fw}，模式 {mode}',
    logModeMismatch: '⚠ 设备当前为「{device}」模式，与所选「{selected}」不一致（凭据字段可能不匹配）',
    logCredsSaved: '凭据写入结果：已写入 [{written}]',
    logCredsSavedSkip: '凭据写入结果：已写入 [{written}]，已跳过（沿用旧值）[{skipped}]',
    logSkipNoCreds: '未填写任何凭据，跳过下发（如需保留设备中已写入的凭据，这是正确行为）',
    logSkipWrite: '未勾选「写入」，仅完成连接与状态检查',
    logWifiConnected: 'WiFi 已连接：{ip}',
    logWifiTimeout: '⚠ WiFi 未在超时内连接',
    logWifiTimeoutStatus: '⚠ WiFi 未在超时内连接（status={status}）',
    logProvisionFailed: '配网失败: {msg}',
    logFlashFailed: '升级失败: {msg}',
    logConnectFailed: '连接失败: {msg}',
    logClearDone: '配网信息已清除',
    logCleared: '配网信息已清除（回落到固件内置凭据）',
    logDevice: '[设备] {line}',
    logSwitchHint: '提示：固件包实际为「{mode}」模式，与当前选择不一致',
    logCredsStatusNote: 'WiFi：{wifi}{ip}',
    logNvsHint: '提示：未勾选擦除且 NVS 已有凭据，可跳过配网',
    logOverrideHint: '提示：固件含内置凭据且未勾选「覆盖」，本次配网仅临时生效，重启回内置',
    logDeviceMsg: '← {msg}',
    logSend: '→ {msg}',
    logParseFail: '⚠ 无法解析设备消息: {line}',

    // 错误
    errNoResponse: '设备无响应（pong 超时）。请拔插 USB 后重试',
    errProtoMismatch: '协议版本不兼容（设备 proto={proto}，工具期望 {expected}）',
    errVariantMismatch: '所选变体与固件不符',
    errSaveTimeout: '设备未确认保存凭据（{evt} 超时）',
    errSha: '{name} SHA256 校验失败（包已损坏），已拒绝烧录',
    errReadFile: '读取 {name} 失败 (HTTP {status})',
    errChipNotMatch: '芯片不是 {expect}（检测到 {chip}），已取消',
    errClearTimeout: '设备未确认清除（{evt} 超时）',
    errDeviceError: '设备返回错误: {msg}',
    errReopenPort: '未找到设备串口，请点击「重新连接并配网」',
    reopenHint: '设备已重新枚举，请点击「重新连接并配网」选择串口',

    // 注意事项
    notice1: '升级过程中<b>请勿断电、请勿拔线</b>，否则可能变砖',
    notice2: '勾选「烧录前全擦除」会清空设备配置，烧录后需重新配网',
    notice3: '不勾「更新」时，设备中已写入的凭据会被保留并继续使用',
    notice4: '本分发包<b>不含任何真实凭据</b>，需在本页填写后经串口配网',
    notice5: '合宙 CORE ESP32-C3（原生 USB）免驱动，即插即用',
    notice6: '升级失败或变砖，可重新运行本工具重刷恢复；保留旧版升级包即可回退旧固件',

    footer: '本地服务仅监听 127.0.0.1，关闭启动窗口即退出',
    langName: '中文'
  },

  en: {
    title: '{product} · Firmware Updater',
    subtitle: 'Upgrade firmware / configure credentials over USB (Type-C)',

    sectionFirmware: 'Firmware package',
    sectionProvision: 'Provisioning (optional; empty = leave device value unchanged)',
    sectionOperation: 'Upgrade',
    sectionStatus: 'Device credential status (built-in / NVS / override / value)',
    sectionLog: 'Log',
    sectionNotice: 'Notes',

    loadingFirmware: 'Reading firmware package…',
    firmwareNotFound: 'Firmware package not found ({path}). Ask the maintainer to run build_common.ps1 first, then reopen this tool.',
    badgeEmpty: 'empty credentials (safe to distribute)',
    badgeHasCreds: 'contains built-in credentials',
    warnHasCreds: '⚠ This package is marked "contains built-in credentials"; do NOT distribute it',
    thFile: 'File',
    thOffset: 'Offset',
    thSize: 'Size',
    versionPrefix: 'Version',

    btnConnect: 'Connect device',
    btnConnected: 'Connected',
    btnReconnect: 'Reconnect & provision',
    btnFlash: 'Flash firmware',
    btnProvision: 'Provision only',
    btnClear: 'Clear provisioning',
    step1: 'Connect the device to the computer with a USB cable',
    step2: 'Click "Connect device" and pick the serial port',
    step3: 'Click "Flash firmware" (provisioning auto-runs afterwards)',

    swWrite: 'Write',
    swWriteHelp: 'Whether to send the credentials above to the device now',
    swUpdate: 'Update',
    swUpdateHelp: 'Replace existing values; if unchecked, keep the values already on the device',
    swOverride: 'Override',
    swOverrideHelp: 'Set the persistent override flag to beat built-in firmware values',
    swErase: 'Erase all before flashing',
    swEraseHelp: 'Clears all device config (including saved credentials); re-provisioning required',

    stDisconnected: 'No device connected',
    stSelectPort: 'Select the device serial port…',
    stHandshaking: 'Handshaking (device auto-resets into download mode)…',
    stConnected: 'Connected {chip}, ready to flash or provision',
    stVerifying: 'Verifying firmware integrity…',
    stReading: 'Reading {name}…',
    stFlashing: 'Flashing; do NOT unplug or power off…',
    stRestart: 'Restarting device…',
    stProvisioning: 'Configuring credentials…',
    stProvisioningWait: 'Credentials written; waiting for WiFi…',
    stDone: '✅ Done! {tail}. You may close and unplug',
    stProvisionDone: '✅ Provisioning complete',
    stProvisionDoneNoCreds: 'Provisioning check complete (no credentials sent)',
    stProvisionWifiFail: 'Credentials written but WiFi did not connect; check SSID/password',
    stFlashFail: '❌ Flash failed: {msg} (retry; if bricked use flash_cli.bat)',
    stProvisionFail: '❌ Provisioning failed: {msg}',
    stNoWebSerial: 'Web Serial is not supported by this browser',
    stNoManifest: 'Firmware package (manifest.json) not found; run build_common.ps1 first',
    stConnectFail: 'Connection failed; retry (keep the device plugged in)',
    stCleared: '✅ Provisioning cleared',
    tailProvisioned: 'provisioned',
    tailSkipped: 'skipped (no credentials sent per current settings)',
    tailNotProvisioned: 'not provisioned (write unchecked or empty)',
    tailProvisionIncomplete: 'provisioning incomplete (retry with "Provision only")',
    tailNotProvisionedShort: 'WiFi not set; use "Provision only" later',

    browserWarn: 'Web Serial is not supported (requires Chrome / Edge 89+).<br>Use the CLI tool instead: run <b>flash_cli.bat</b>',

    thGroup: 'Group',
    thCompile: 'Built-in',
    thNvs: 'NVS',
    thOverride: 'Override',
    thValue: 'Value',
    yes: 'Yes',
    no: 'No',
    on: 'On',
    off: 'Off',
    wifiLabel: 'WiFi',
    stateProvision: 'waiting',
    stateConnecting: 'connecting',
    stateConnected: 'connected',
    stateFailed: 'failed',
    stateDisconnected: 'disconnected',

    logReady: 'Updater ready.',
    logSwitched: 'Switched to "{label}"',
    logPackageLoaded: 'Package loaded: v{version} ({mode} / {freq} / {size})',
    logShaOk: '{name} verified ({kb} KB)',
    logChip: 'Chip detected: {chip}',
    logFlashing: 'Flashing ({variant}, {mode} / {freq} / {size}, {erase})…',
    eraseYes: 'full erase (clears saved credentials)',
    eraseNo: 'no erase (keep device config)',
    logWriteDone: 'Write complete, restarting device…',
    logResetHint: 'Reset hint: {msg}',
    logProvisionOpen: 'Opening serial port at {baud} for provisioning…',
    logDeviceResponded: 'Device responded: firmware v{fw}, mode {mode}',
    logModeMismatch: '⚠ Device is in "{device}" mode but "{selected}" is selected (fields may differ)',
    logCredsSaved: 'Credentials result: written [{written}]',
    logCredsSavedSkip: 'Credentials result: written [{written}], skipped (kept) [{skipped}]',
    logSkipNoCreds: 'No credentials entered; skipping send (this is correct if you want to keep existing ones)',
    logSkipWrite: '"Write" unchecked; connection & status check only',
    logWifiConnected: 'WiFi connected: {ip}',
    logWifiTimeout: '⚠ WiFi did not connect within timeout',
    logWifiTimeoutStatus: '⚠ WiFi did not connect within timeout (status={status})',
    logProvisionFailed: 'Provisioning failed: {msg}',
    logFlashFailed: 'Flash failed: {msg}',
    logConnectFailed: 'Connection failed: {msg}',
    logClearDone: 'Provisioning cleared',
    logCleared: 'Provisioning cleared (falling back to built-in credentials)',
    logDevice: '[device] {line}',
    logSwitchHint: 'Note: package is actually "{mode}" mode, different from the current selection',
    logCredsStatusNote: 'WiFi: {wifi}{ip}',
    logNvsHint: 'Note: not erasing and NVS already has credentials; you may skip provisioning',
    logOverrideHint: 'Note: firmware has built-in credentials and "Override" is unchecked; this provisioning is temporary only',
    logDeviceMsg: '← {msg}',
    logSend: '→ {msg}',
    logParseFail: '⚠ Cannot parse device message: {line}',

    errNoResponse: 'No response from device (pong timeout). Replug USB and retry',
    errProtoMismatch: 'Incompatible protocol (device proto={proto}, tool expects {expected})',
    errVariantMismatch: 'Selected variant does not match firmware',
    errSaveTimeout: 'Device did not confirm credential save ({evt} timeout)',
    errSha: '{name} SHA256 mismatch (corrupt package); flashing refused',
    errReadFile: 'Failed to read {name} (HTTP {status})',
    errChipNotMatch: 'Chip is not {expect} (detected {chip})',
    errClearTimeout: 'Device did not confirm clear ({evt} timeout)',
    errDeviceError: 'Device error: {msg}',
    errReopenPort: 'Device serial port not found; click "Reconnect & provision"',
    reopenHint: 'Device re-enumerated; click "Reconnect & provision" to pick the port',

    notice1: 'Do NOT unplug or power off during upgrade; it may brick the device',
    notice2: '"Erase all" clears device config; re-provision after flashing',
    notice3: 'With "Update" unchecked, credentials already on the device are kept',
    notice4: 'This package contains <b>no real credentials</b>; enter them here and provision over serial',
    notice5: 'AirM2M CORE ESP32-C3 (native USB) needs no driver; plug and play',
    notice6: 'If flashing fails or bricks, rerun this tool; keep an older package to roll back',

    footer: 'Local server binds 127.0.0.1 only; close the launch window to exit',
    langName: 'English'
  }
};

let currentLocale = 'en';
const listeners = [];

function detectLocale() {
  try {
    const saved = localStorage.getItem('locale');
    if (saved === 'zh' || saved === 'en') return saved;
  } catch (e) { /* ignore */ }
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function initLocale() {
  currentLocale = detectLocale();
  return currentLocale;
}

export function getLocale() { return currentLocale; }

export function setLocale(loc) {
  if (loc !== 'zh' && loc !== 'en') return;
  currentLocale = loc;
  try { localStorage.setItem('locale', loc); } catch (e) { /* ignore */ }
  listeners.forEach(cb => { try { cb(loc); } catch (e) { /* ignore */ } });
}

export function onLocaleChange(cb) { listeners.push(cb); }

// t('key', { var: value }) —— 缺失时回退到 key 本身
export function t(key, vars) {
  const table = DICT[currentLocale] || DICT.en;
  let s = (table[key] !== undefined) ? table[key] : (DICT.en[key] !== undefined ? DICT.en[key] : key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split('{' + k + '}').join(v == null ? '' : String(v));
    }
  }
  return s;
}

// 解析 profile 的 i18n 值：字符串 或 {zh,en}
export function pickI18n(value, loc) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  const l = loc || currentLocale;
  if (value[l] !== undefined) return value[l];
  if (value.zh !== undefined) return value.zh;
  if (value.en !== undefined) return value.en;
  return '';
}
