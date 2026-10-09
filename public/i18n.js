// ============================================================================
// i18n.js —— 中英双语字典与切换（通用工具自身文案）
//   profile 内的文本由 pickI18n() 按同规则解析，二者互不依赖。
// ============================================================================

export const DICT = {
  zh: {
    // 标题
    title: '{product} · 固件升级工具',
    subtitle: '通过 USB 数据线（Type-C）直连设备升级固件 / 配置参数',

    // 分区标题
    sectionFirmware: '固件包信息',
    sectionConfig: '配置项（选填，留空 = 不修改设备中的该项）',
    sectionOperation: '升级操作',
    sectionStatus: '设备状态',
    sectionLog: '日志',
    sectionNotice: '注意事项',
    sectionImport: '导入固件',

    // 导入
    importBtn: '选择固件目录…',
    importDrop: '或将固件目录 / .zip 拖拽到此处',
    importMsgIdle: '未导入：正在使用工具内置固件。',
    importOk: '已导入：{name}（{count} 个固件包）',
    importStrictError: '导入失败（严格模式需同时含 manifest.json 与 profile.json）：',
    importMissing: '缺少 {file}',
    importUnexpected: '存在未声明的 manifest：{file}',
    importNoPackage: '未找到固件包（需含 profile.json 与 manifest.json）',
    importZipFail: '无法解析 zip：{msg}',
    sourceBuiltin: '内置固件',
    sourceImported: '已导入：{name}',
    toolVersionLabel: '工具',

    // 固件包
    loadingFirmware: '正在读取固件包信息…',
    firmwareNotFound: '未找到固件包（{path}）。请维护者先构建固件包，或点击上方「选择固件目录…」导入。',
    missingManifestHint: '该包缺少 manifest.json，无法烧录（仅可查看配置）。',
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
    btnReconnect: '重新连接',
    actFlash: '开始升级',
    actSubmit: '写入配置',
    actClear: '清除配置',
    step1: '用 USB 数据线连接设备与电脑',
    step2: '点击「连接设备」，在弹窗中选择设备串口',
    step3: '点击「开始升级」（如已填配置会自动下发）',

    // 开关
    swWrite: '写入',
    swWriteHelp: '本次是否把上面的配置下发到设备',
    swUpdate: '更新',
    swUpdateHelp: '设备已有该项时是否替换；不勾则沿用设备中已写入的旧值',
    swOverride: '覆盖',
    swOverrideHelp: '置持久覆盖位，压过固件内置值',
    swErase: '烧录前全擦除',
    swEraseHelp: '会清空设备全部配置（含已写入的值），烧录后必须重新配置',

    // 状态
    stDisconnected: '未连接设备',
    stSelectPort: '请选择设备串口…',
    stHandshaking: '正在握手（设备会自动复位进入下载模式）…',
    stConnected: '已连接 {chip}，可以开始升级或配置',
    stVerifying: '正在校验固件完整性…',
    stReading: '读取 {name}…',
    stFlashing: '正在升级，请勿断电、勿拔线…',
    stRestart: '重启设备…',
    stProvisioning: '正在配置设备…',
    stProvisioningWait: '配置已写入，等待设备连接 WiFi…',
    stActionDoing: '正在执行「{label}」…',
    stDone: '✅ 升级完成！{tail}，可关闭窗口拔线',
    stProvisionDone: '✅ 配置完成',
    stProvisionDoneNoCreds: '已完成检查（未下发配置）',
    stProvisionWifiFail: '配置已写入，但 WiFi 未连上，请核对 WiFi 名称/密码',
    stFlashFail: '❌ 升级失败：{msg}（可重试；若变砖用 flash_cli.bat 恢复）',
    stProvisionFail: '❌ 操作失败：{msg}',
    stNoWebSerial: '当前浏览器不支持 Web Serial',
    stNoManifest: '未找到固件包（manifest.json）',
    stConnectFail: '连接失败，请重试（保持设备接好 USB）',
    stCleared: '✅ 已清除配置',
    tailProvisioned: '已配置',
    tailSkipped: '已跳过（按当前设置未下发配置）',
    tailNotProvisioned: '未配置（未勾选写入或未填写）',
    tailProvisionIncomplete: '配置未完成（可稍后重试）',

    // 浏览器告警
    browserWarn: '当前浏览器不支持 Web Serial（需 Chrome / Edge 89+）。<br>请改用命令行工具：双击目录中的 <b>flash_cli.bat</b>',

    // 状态表
    thGroup: '项',
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
    logToolVersion: '工具版本 v{version}',
    logSourceBuiltin: '固件来源：内置',
    logSourceImported: '固件来源：已导入「{name}」',
    logSwitched: '已切换到「{label}」',
    logPackageLoaded: '固件包已加载：v{version}（{mode} / {freq} / {size}）',
    logNoManifest: '该变体缺少 manifest.json，仅可查看配置，无法烧录',
    logShaOk: '{name} 校验通过 ({kb} KB)',
    logChip: '检测到芯片: {chip}',
    logFlashing: '开始烧录（{variant} 模式，{mode} / {freq} / {size}，{erase}）…',
    eraseYes: '全擦除（将清空已写入值）',
    eraseNo: '不擦除（保留设备配置）',
    logWriteDone: '写入完成，正在重启设备…',
    logResetHint: '复位提示: {msg}',
    logProvisionOpen: '正在以 {baud} 打开串口…',
    logDeviceResponded: '设备已响应：固件 v{fw}，模式 {mode}',
    logModeMismatch: '⚠ 设备当前为「{device}」模式，与所选「{selected}」不一致（字段可能不匹配）',
    logActionSkip: '未勾选「{sw}」，跳过该动作',
    logActionNoData: '未填写任何数据，跳过下发（如需保留设备中已写入的值，这是正确行为）',
    logCredsSaved: '写入结果：已写入 [{written}]',
    logCredsSavedSkip: '写入结果：已写入 [{written}]，已跳过（沿用旧值）[{skipped}]',
    logWifiConnected: 'WiFi 已连接：{ip}',
    logWifiTimeout: '⚠ WiFi 未在超时内连接',
    logWifiTimeoutStatus: '⚠ WiFi 未在超时内连接（status={status}）',
    logProvisionFailed: '操作失败: {msg}',
    logFlashFailed: '升级失败: {msg}',
    logConnectFailed: '连接失败: {msg}',
    logCleared: '配置已清除（回落到固件内置值）',
    logDevice: '[设备] {line}',
    logCredsStatusNote: 'WiFi：{wifi}{ip}',
    logDeviceMsg: '← {msg}',
    logSend: '→ {msg}',
    logParseFail: '⚠ 无法解析设备消息: {line}',
    logExportEmpty: '暂无日志可导出',
    logExported: '日志已导出：{name}',
    logSchemaTooNew: '⚠ profile.schema={got} 高于本工具支持（{supported}），已拒绝加载',

    // 错误
    errNoResponse: '设备无响应（pong 超时）。请拔插 USB 后重试',
    errProtoMismatch: '协议版本不兼容（设备 proto={proto}，工具期望 {expected}）',
    errSaveTimeout: '设备未确认保存（{evt} 超时）',
    errSha: '{name} SHA256 校验失败（包已损坏），已拒绝烧录',
    errReadFile: '读取 {name} 失败 ({status})',
    errChipNotMatch: '芯片不是 {expect}（检测到 {chip}），已取消',
    errActionTimeout: '等待 {evt} 超时',
    errDeviceError: '设备返回错误: {msg}',
    errActionNoCommand: '动作缺少 command：{id}',
    reopenHint: '设备已重新枚举，请点击「重新连接」选择串口',

    // 注意事项
    notice1: '升级过程中<b>请勿断电、请勿拔线</b>，否则可能变砖',
    notice2: '勾选「烧录前全擦除」会清空设备配置，烧录后需重新配置',
    notice3: '不勾「更新」时，设备中已写入的值会被保留并继续使用',
    notice4: '本分发包<b>不含任何真实凭据</b>，需在本页填写后经串口下发',
    notice5: '合宙 CORE ESP32-C3（原生 USB）免驱动，即插即用',
    notice6: '升级失败或变砖，可重新运行本工具重刷恢复；保留旧版升级包即可回退旧固件',

    footer: '本地服务仅监听 127.0.0.1，关闭启动窗口即退出',
    langName: '中文'
  },

  en: {
    title: '{product} · Firmware Updater',
    subtitle: 'Upgrade firmware / configure parameters over USB (Type-C)',

    sectionFirmware: 'Firmware package',
    sectionConfig: 'Configuration (optional; empty = leave device value unchanged)',
    sectionOperation: 'Upgrade',
    sectionStatus: 'Device status',
    sectionLog: 'Log',
    sectionNotice: 'Notes',
    sectionImport: 'Import firmware',

    importBtn: 'Choose firmware folder…',
    importDrop: 'or drop a firmware folder / .zip here',
    importMsgIdle: 'Not imported: using the built-in firmware.',
    importOk: 'Imported: {name} ({count} package(s))',
    importStrictError: 'Import failed (strict mode requires manifest.json + profile.json):',
    importMissing: 'missing {file}',
    importUnexpected: 'undeclared manifest: {file}',
    importNoPackage: 'No firmware package found (needs profile.json + manifest.json)',
    importZipFail: 'Cannot read zip: {msg}',
    sourceBuiltin: 'Built-in firmware',
    sourceImported: 'Imported: {name}',
    toolVersionLabel: 'Tool',

    loadingFirmware: 'Reading firmware package…',
    firmwareNotFound: 'Firmware package not found ({path}). Ask the maintainer to build one, or import a folder above.',
    missingManifestHint: 'This package has no manifest.json; flashing is unavailable (config view only).',
    badgeEmpty: 'empty credentials (safe to distribute)',
    badgeHasCreds: 'contains built-in credentials',
    warnHasCreds: '⚠ This package is marked "contains built-in credentials"; do NOT distribute it',
    thFile: 'File',
    thOffset: 'Offset',
    thSize: 'Size',
    versionPrefix: 'Version',

    btnConnect: 'Connect device',
    btnConnected: 'Connected',
    btnReconnect: 'Reconnect',
    actFlash: 'Flash firmware',
    actSubmit: 'Apply configuration',
    actClear: 'Clear configuration',
    step1: 'Connect the device to the computer with a USB cable',
    step2: 'Click "Connect device" and pick the serial port',
    step3: 'Click "Flash firmware" (configuration auto-applies afterwards)',

    swWrite: 'Write',
    swWriteHelp: 'Whether to send the configuration above to the device now',
    swUpdate: 'Update',
    swUpdateHelp: 'Replace existing values; if unchecked, keep the values already on the device',
    swOverride: 'Override',
    swOverrideHelp: 'Set the persistent override flag to beat built-in firmware values',
    swErase: 'Erase all before flashing',
    swEraseHelp: 'Clears all device config (including saved values); re-provisioning required',

    stDisconnected: 'No device connected',
    stSelectPort: 'Select the device serial port…',
    stHandshaking: 'Handshaking (device auto-resets into download mode)…',
    stConnected: 'Connected {chip}, ready to flash or configure',
    stVerifying: 'Verifying firmware integrity…',
    stReading: 'Reading {name}…',
    stFlashing: 'Flashing; do NOT unplug or power off…',
    stRestart: 'Restarting device…',
    stProvisioning: 'Configuring device…',
    stProvisioningWait: 'Configuration written; waiting for WiFi…',
    stActionDoing: 'Running "{label}"…',
    stDone: '✅ Done! {tail}. You may close and unplug',
    stProvisionDone: '✅ Configuration complete',
    stProvisionDoneNoCreds: 'Check complete (no configuration sent)',
    stProvisionWifiFail: 'Configuration written but WiFi did not connect; check SSID/password',
    stFlashFail: '❌ Flash failed: {msg} (retry; if bricked use flash_cli.bat)',
    stProvisionFail: '❌ Operation failed: {msg}',
    stNoWebSerial: 'Web Serial is not supported by this browser',
    stNoManifest: 'Firmware package (manifest.json) not found',
    stConnectFail: 'Connection failed; retry (keep the device plugged in)',
    stCleared: '✅ Configuration cleared',
    tailProvisioned: 'configured',
    tailSkipped: 'skipped (no configuration sent per current settings)',
    tailNotProvisioned: 'not configured (write unchecked or empty)',
    tailProvisionIncomplete: 'configuration incomplete (retry later)',

    browserWarn: 'Web Serial is not supported (requires Chrome / Edge 89+).<br>Use the CLI tool instead: run <b>flash_cli.bat</b>',

    thGroup: 'Item',
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
    logToolVersion: 'Tool version v{version}',
    logSourceBuiltin: 'Firmware source: built-in',
    logSourceImported: 'Firmware source: imported "{name}"',
    logSwitched: 'Switched to "{label}"',
    logPackageLoaded: 'Package loaded: v{version} ({mode} / {freq} / {size})',
    logNoManifest: 'This variant has no manifest.json; config view only, flashing unavailable',
    logShaOk: '{name} verified ({kb} KB)',
    logChip: 'Chip detected: {chip}',
    logFlashing: 'Flashing ({variant}, {mode} / {freq} / {size}, {erase})…',
    eraseYes: 'full erase (clears saved values)',
    eraseNo: 'no erase (keep device config)',
    logWriteDone: 'Write complete, restarting device…',
    logResetHint: 'Reset hint: {msg}',
    logProvisionOpen: 'Opening serial port at {baud}…',
    logDeviceResponded: 'Device responded: firmware v{fw}, mode {mode}',
    logModeMismatch: '⚠ Device is in "{device}" mode but "{selected}" is selected (fields may differ)',
    logActionSkip: '"{sw}" unchecked; action skipped',
    logActionNoData: 'No data entered; skipping send (correct if you want to keep existing values)',
    logCredsSaved: 'Result: written [{written}]',
    logCredsSavedSkip: 'Result: written [{written}], skipped (kept) [{skipped}]',
    logWifiConnected: 'WiFi connected: {ip}',
    logWifiTimeout: '⚠ WiFi did not connect within timeout',
    logWifiTimeoutStatus: '⚠ WiFi did not connect within timeout (status={status})',
    logProvisionFailed: 'Operation failed: {msg}',
    logFlashFailed: 'Flash failed: {msg}',
    logConnectFailed: 'Connection failed: {msg}',
    logCleared: 'Configuration cleared (falling back to built-in values)',
    logDevice: '[device] {line}',
    logCredsStatusNote: 'WiFi: {wifi}{ip}',
    logDeviceMsg: '← {msg}',
    logSend: '→ {msg}',
    logParseFail: '⚠ Cannot parse device message: {line}',
    logExportEmpty: 'No log to export',
    logExported: 'Log exported: {name}',
    logSchemaTooNew: '⚠ profile.schema={got} is newer than supported ({supported}); refused to load',

    errNoResponse: 'No response from device (pong timeout). Replug USB and retry',
    errProtoMismatch: 'Incompatible protocol (device proto={proto}, tool expects {expected})',
    errSaveTimeout: 'Device did not confirm save ({evt} timeout)',
    errSha: '{name} SHA256 mismatch (corrupt package); flashing refused',
    errReadFile: 'Failed to read {name} ({status})',
    errChipNotMatch: 'Chip is not {expect} (detected {chip})',
    errActionTimeout: 'Timed out waiting for {evt}',
    errDeviceError: 'Device error: {msg}',
    errActionNoCommand: 'Action has no command: {id}',
    reopenHint: 'Device re-enumerated; click "Reconnect" to pick the port',

    notice1: 'Do NOT unplug or power off during upgrade; it may brick the device',
    notice2: '"Erase all" clears device config; re-provision after flashing',
    notice3: 'With "Update" unchecked, values already on the device are kept',
    notice4: 'This package contains <b>no real credentials</b>; enter them here and send over serial',
    notice5: 'AirM2M CORE ESP32-C3 (native USB) needs no driver; plug and play',
    notice6: 'If flashing fails or bricks, rerun this tool; keep an older package to roll back',

    footer: 'Local server binds 127.0.0.1 only; close the launch window to exit',
    langName: 'English'
  }
};

let currentLocale = 'en';
let defaultLocale = null;
const listeners = [];

function detectLocale() {
  try {
    const saved = localStorage.getItem('locale');
    if (saved === 'zh' || saved === 'en') return saved;
  } catch (e) { /* ignore */ }
  if (defaultLocale === 'zh' || defaultLocale === 'en') return defaultLocale;
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function setDefaultLocale(loc) {
  if (loc !== 'zh' && loc !== 'en') return;
  defaultLocale = loc;
  let saved = null;
  try { saved = localStorage.getItem('locale'); } catch (e) { /* ignore */ }
  if (!saved) currentLocale = loc;
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
