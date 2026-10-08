# ESPEZUpdater

通用 ESP32 固件升级工具。分为两层：

- **运行时工具**：本地网页 GUI + Web Serial 烧录 + 串口配网（`server.ps1` / `public\` / `esptool.exe` / `flash_cli.bat`）；
- **构建套件**：`build-kit\`，独立于运行时，由使用本工具的项目内置后**在项目侧**构建固件包。

通过 JSON 配置档（`profile.json` / `build.json`）适配任意 ESP32 项目；**项目方不改工具代码**，
只产出「空凭据固件包 + profile」。构建产物落在**项目目录**，工具仓保持干净。

## 文档

- 设计方案：`docs\01_设计方案_通用固件升级工具.md`
- 接入与出包指南：`docs\02_面向AI的接入与出包指南.md`
- 固件协议契约：`docs\03_固件协议契约.md`
- **构建套件与项目集成机制**：`docs\04_构建套件与项目集成机制.md`
- 套件用法速查：`build-kit\README.md`

## 目录结构

```
ESPEZUpdater\
├─ server.ps1            本地静态服务（127.0.0.1:8123，服务 public\ 与 firmware\）
├─ 一键升级.bat          启动服务并打开浏览器
├─ upgrade.bat           英文同义启动器
├─ flash_cli.bat         命令行兜底（读 manifest.json；自动探测变体与 COM 口）
├─ esptool.exe           命令行烧录工具
├─ public\               通用网页外壳（index.html / app.js / i18n.js / style.css）
│  └─ esptool-js\bundle.js
├─ build-kit\            ★ 独立构建套件（供项目内置取用）
│  ├─ build_common.ps1
│  ├─ empty_creds.ps1
│  ├─ templates\{build,profile}.example.json
│  └─ README.md
└─ docs\                 设计与接入文档（01–04）
```

## 使用

### 运行时工具（刷机 / 配网）

双击 `一键升级.bat`（或 `upgrade.bat`），浏览器打开 <http://127.0.0.1:8123>，
用 Chrome / Edge 连接设备后点击「开始升级」；也可用 `flash_cli.bat` 仅烧录。

> 运行时工具从自身同级的 `public\` 与 `firmware\` 提供服务；自包含分发产物（见下）中已包含这两者。

### 构建套件（项目侧出包）

将 `build-kit\`（以及 `-Bundle` 所需的运行时 `runtime\`）内置到项目，在项目内运行：

```powershell
# 仅固件产物 → 项目 dist\firmware\... + dist\固件包_v<版本>.zip
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-kit\build_common.ps1 -Build .\build.json

# 自包含分发 → 项目 dist\ 含运行时工具 + dist\固件升级工具_v<版本>.zip
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-kit\build_common.ps1 -Build .\build.json -Bundle
```

产物全部写入项目侧（缺省 `dist\`），**不写入本工具仓**。完整机制见
`docs\04_构建套件与项目集成机制.md`。

## 约定

- 构建只写 `-OutDir\build_tmp\` 副本，**绝不修改项目源码**（尤其 `config.h`）；
- 分发包强制空凭据，真实凭据由使用者在页面填写并经串口写入设备 NVS；
- `profile.fields[].key` 必须与固件协议键一致；`proto` 不匹配即拒绝配网。
