# ESPEZUpdater

通用 ESP32 固件升级工具（工具版本见 `version.json` / `VERSION`）。分为两层：

- **运行时工具**：本地网页 GUI + Web Serial 烧录 + 串口配置（`server.ps1` / `public\` / `esptool.exe` / `flash_cli.bat`）；
- **构建套件**：`build-kit\`，独立于运行时，由使用本工具的项目内置后**在项目侧**构建固件包。

通过 JSON 配置档（`profile.json` / `build.json`）适配任意 ESP32 项目；**项目方不改工具代码**，
只产出「空凭据固件包 + profile」。构建产物落在**项目目录**，工具仓保持干净。

## 文档

- 设计方案：`docs\01_设计方案_通用固件升级工具.md`
- 接入与使用说明：`接入与使用说明.md`（根目录）
- 固件协议契约：`docs\02_固件协议契约.md`
- 构建套件与项目集成机制：`docs\03_构建套件与项目集成机制.md`
- 套件用法速查：`build-kit\README.md`

## 目录结构

```
ESPEZUpdater\
├─ server.ps1            本地静态服务（127.0.0.1，端口冲突自动顺延；服务 public\ 与 firmware\）
├─ 一键升级.bat          启动服务并打开浏览器
├─ upgrade.bat           英文同义启动器
├─ flash_cli.bat         命令行兜底（读 manifest.json；支持 --variant / --dir / --no-erase）
├─ esptool.exe           命令行烧录工具
├─ pack.ps1              打包发布（运行时 zip / 构建套件 zip / 可选单文件 EXE）
├─ version.json / VERSION 工具版本（日期格式 YYYYMMDD）
├─ public\               通用网页外壳
│  ├─ index.html / style.css
│  ├─ app.js             编排层（来源 → profile → 渲染 → 动作）
│  ├─ firmware-source.js 来源抽象（内置静态 / 本地目录）
│  ├─ package-scan.js    目录扫描与严格校验
│  ├─ profile-model.js   profile 归一化与 schema 门禁（schema 1 / 2）
│  ├─ protocol.js        串口会话（SerialTalker）与模拟（MockTalker）
│  ├─ operations.js      通用动作载荷构建
│  ├─ ui.js              通用渲染
│  ├─ zip.js             最小 ZIP 读取（拖入 .zip 用）
│  ├─ i18n.js            中英双语字典
│  └─ esptool-js\bundle.js
├─ build-kit\            ★ 独立构建套件（供项目内置取用）
│  ├─ build_common.ps1 / empty_creds.ps1
│  ├─ templates\{build,profile}.example.json
│  └─ README.md
└─ docs\                 设计与接入文档（01–04）
```

## 使用

### 运行时工具（刷机 / 配置）

双击 `一键升级.bat`（或 `upgrade.bat`），浏览器打开本地服务地址（默认 <http://127.0.0.1:8123>），
用 Chrome / Edge 连接设备后点击「开始升级」；也可用 `flash_cli.bat` 仅烧录。

**导入固件（通用框架）**：打开页面后可点击「选择固件目录…」或直接拖入固件目录 / `.zip`。
**严格模式**要求每个固件包目录同时包含 `manifest.json` 与 `profile.json`，否则拒绝导入。
导入后 UI、字段、动作完全由该固件的 `profile.json` 决定；未导入时使用工具内置 `firmware\`。

无硬件自测：在地址后加 `?mock=1`（例 `http://127.0.0.1:8123/?mock=1`）可回放设备事件。

### 构建套件（项目侧出包）

将 `build-kit\`（以及 `-Bundle` 所需的运行时 `runtime\`）内置到项目，在项目内运行：

```powershell
# 仅固件产物 → 项目 dist\firmware\... + dist\固件包_v<版本>.zip
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-kit\build_common.ps1 -Build .\build.json

# 自包含分发 → 项目 dist\ 含运行时工具 + dist\固件升级工具_v<版本>.zip
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-kit\build_common.ps1 -Build .\build.json -Bundle
```

产物全部写入项目侧（缺省 `dist\`），**不写入本工具仓**。完整机制见
`docs\03_构建套件与项目集成机制.md`。

### 打包发布工具

```powershell
# 运行时 zip + 构建套件 zip
powershell -NoProfile -ExecutionPolicy Bypass -File .\pack.ps1

# 追加单文件 EXE（IExpress 自解压，未签名）
powershell -NoProfile -ExecutionPolicy Bypass -File .\pack.ps1 -Exe

# 瘦身运行时 zip（不含 esptool.exe；Web Serial 烧录仍可用）
powershell -NoProfile -ExecutionPolicy Bypass -File .\pack.ps1 -Slim
```

产物：`dist\ESPEZUpdater_v<版本>.zip`、`dist\ESPEZUpdater-buildkit_v<版本>.zip`、（可选）`dist\ESPEZUpdater_v<版本>.exe`。
运行时 zip 也可作为项目 `build.json` 的 `runtimeToolDir` 来源。

## 依赖与组件

| 组件 | 版本 | 许可证 | 用途 |
|---|---|---|---|
| PowerShell | 5.1+（Windows 组件） | 系统组件 | 本地服务、构建、打包 |
| Chrome / Edge | 89+ | — | Web Serial 烧录、目录导入 |
| esptool-js | 0.6.1（内嵌 `public\esptool-js\bundle.js`） | Apache-2.0 | 浏览器端烧录 |
| pako（随 bundle 内嵌） | 2.1.0 | MIT AND Zlib | esptool-js 压缩依赖 |
| esptool | 5.3.1（`esptool.exe`） | GPL-2.0 | 命令行兜底烧录 |
| arduino-cli | 1.5.1 | GPL-2.0 | 构建固件（套件侧） |
| esp32 core | 3.3.11 | 见上游 | 编译目标的板级支持 |

说明：运行时无需 Node.js 或外网；本地服务仅监听 `127.0.0.1`。分发/再分发请遵守上表各组件许可证。
`esptool.exe` 约 14MB，仅为命令行兜底；Web Serial 烧录不依赖它（可 `-Slim` 剥离）。

## 约定

- 构建只写 `-OutDir\build_tmp\` 副本，**绝不修改项目源码**（尤其 `config.h`）；
- 分发包强制空凭据，真实凭据由使用者在页面填写并经串口写入设备 NVS；
- `profile.fields[].key` 必须与固件协议键一致；`proto` 不匹配即拒绝；
- `profile.schema` 高于工具支持时拒绝加载（避免新版 profile 被旧工具误用）。
