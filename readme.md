![koishi-plugin-serverinfo-rest-client](https://socialify.git.ci/VincentZyuApps/koishi-plugin-serverinfo-rest-client/image?description=1&font=JetBrains+Mono&forks=1&issues=1&language=1&logo=https%3A%2F%2Fupload.wikimedia.org%2Fwikipedia%2Fcommons%2Ff%2Ff3%2FKoishi.js_Logo.png%3F_%3D20230331182243&name=1&owner=1&pulls=1&stargazers=1&theme=Auto)

# koishi-plugin-ll-serverinfo-rest-client

[![npm](https://img.shields.io/npm/v/koishi-plugin-ll-serverinfo-rest-client?style=flat-square&logo=npm)](https://www.npmjs.com/package/koishi-plugin-ll-serverinfo-rest-client)
[![npm downloads](https://img.shields.io/npm/dm/koishi-plugin-ll-serverinfo-rest-client?style=flat-square&logo=npm)](https://www.npmjs.com/package/koishi-plugin-ll-serverinfo-rest-client)

[![CI](https://github.com/VincentZyuApps/koishi-plugin-serverinfo-rest-client/actions/workflows/test.yml/badge.svg)](https://github.com/VincentZyuApps/koishi-plugin-serverinfo-rest-client/actions)

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/VincentZyuApps/koishi-plugin-serverinfo-rest-client)
[![Gitee](https://img.shields.io/badge/Gitee-C71D23?style=flat-square&logo=gitee&logoColor=white)](https://gitee.com/vincent-zyu/koishi-plugin-ll-serverinfo-rest-client)

[![Koishi Market](https://img.shields.io/badge/Koishi-Market-5546A3?style=flat-square&logo=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAABU0lEQVR42p2UQSsFYRSGnxnqLuytKWKpKFkQNsS%2FsOHPWPADLCmxU5S7UzYWNrJR7lYiRF2FeWzOMKZ7mXHqNNP5vvP2nu%2B850CY2lP4X1K31ZbaDm%2BpO%2Bpyp5wfAXVEPfRvO1JHf4AVQGbUh7j4EZ4VkrNCXPVRnf3CUBN1SH2KC28VGOV3ntRhNclZHdcAKYM11QR1oVBOXctzFlNgBTC8qmXxPQEegbVeYApIgJT6tg%2F0AdMp0B%2FBpCabK2AAmAAa%2F2GRBft1oBFPkqTAba7LCiAfQC9wClwAY1HJHepuiO29Yrsf1Dn1uiDU3RTYCtTkl1Leg8k9MB4NGgReI28rV3azgyCz0og01Xl1Uz1QX8uCTELm3UbkTF1VJ9Wr0tn3iBSGdjYG0XivE3VN3VD31PM4a3cc2tIGGI0VkTO7rLxGuiy25ejmjfqsvkSXui62TxaK03td4FXTAAAAAElFTkSuQmCC&logoColor=white)](https://koishi.chat/zh-CN/market/)

[![QQ群](https://img.shields.io/badge/QQ群-1085190201-12B7F5?style=flat-square&logo=qq&logoColor=white)](https://qm.qq.com/q/ZN7fxZ3qCq)

<h2>💬 交流反馈</h2>
<p>🐛 Bug 反馈 / 💡 建议 / 👨‍💻 插件开发交流，欢迎加群：</p>
<p><del>💬 插件使用问题 / 🐛 Bug反馈 / 👨‍💻 插件开发交流，欢迎加入QQ群：<b>259248174</b>   🎉（这个群G了）</del></p>
<p>💬 插件使用问题 / 🐛 Bug反馈 / 👨‍💻 插件开发交流，欢迎加入QQ群：<b>1085190201</b> 🎉</p>
<p>💡 在群里直接艾特我，回复的更快哦~ ✨</p>

对接 LeviLamina `serverinfo-rest` 服务端，提供服务器状态、历史玩家、玩家统计、远程命令和白名单绑定功能。

当前版本仅支持服务端 API v2，默认前缀为 `/api/v2`，不兼容 API v1。

> 配套 LeviLamina 服务端：[![LeviLamina Plugin](https://img.shields.io/badge/LeviLamina-Plugin-7FA973?style=flat-square&logo=cplusplus&logoColor=white&labelColor=2C5E3B)](https://github.com/VincentZyuApps/levilamina-plugin-serverinfo-rest) [`levilamina-plugin-serverinfo-rest`](https://github.com/VincentZyuApps/levilamina-plugin-serverinfo-rest)，负责在 Minecraft BDS 内提供本插件所需的 HTTP API。

## 指令表格

默认主指令和功能指令前缀均为 `mcinfo1`。中文名称是主指令，英文名称是等价 alias；修改 `commandPrefix` 后两种名称的前缀会一起变化。

| 权限 | 中文主指令 | 英文 alias | 默认完整指令 | 用途 |
| --- | --- | --- | --- | --- |
| 普通用户 | 主指令 | 无 | `mcinfo1` | 查看插件帮助与指令列表 |
| 普通用户（仅 QQ） | `按钮菜单` | `button-menu` | `mcinfo1.按钮菜单 [页码]` | 打开两页 QQ 按钮菜单，页码默认为 1 |
| 普通用户 | `健康检查` | `health-check` | `mcinfo1.健康检查` | 查询服务健康状态与运行时间 |
| 普通用户 | `查在线` | `server-overview` | `mcinfo1.查在线` | 查询 TPS、延迟、在线玩家与版本概览 |
| 普通用户 | `服务器状态` | `server-status` | `mcinfo1.服务器状态` | 查询简要服务器状态 |
| 普通用户 | `服务器信息` | `server-details` | `mcinfo1.服务器信息` | 查询服务器详细信息 |
| 普通用户 | `玩家列表` | `player-list` | `mcinfo1.玩家列表` | 查询在线玩家列表及基本资料 |
| 普通用户 | `玩家数量` | `player-count` | `mcinfo1.玩家数量` | 查询在线玩家数量 |
| 普通用户 | `玩家名列表` | `player-names` | `mcinfo1.玩家名列表` | 仅查询在线玩家名称 |
| 普通用户 | `玩家在线详情` | `player-details` | `mcinfo1.玩家在线详情 <玩家名>` | 查询指定在线玩家的身份、状态、环境、装备和网络质量 |
| 普通用户 | `历史记录` | `player-history` | `mcinfo1.历史记录 [页码]` | 分页查询历史玩家 |
| 普通用户 | `玩家活动` | `player-activity` | `mcinfo1.玩家活动 [yyyyMMdd]` | 查询上海时区单日在线人数折线与进入次数柱形图，日期默认今天 |
| 普通用户 | `玩家数据统计` | `player-stats` | `mcinfo1.玩家数据统计 [玩家名]` | 默认查询当前账号绑定的玩家，也可公开查询指定玩家的累计统计 |
| Koishi 权限等级 | `绑定玩家` | `bind-player` | `mcinfo1.绑定玩家 <玩家名>` | 绑定聊天账号与 Xbox 玩家；所需等级由 `whitelistBindingAuthority` 控制 |
| Koishi 权限等级 | `解绑玩家` | `unbind-player` | `mcinfo1.解绑玩家` | 解除当前聊天账号的唯一玩家绑定 |
| 白名单管理员 | `添加白名单` | `add-whitelist` | `mcinfo1.添加白名单 <玩家名> <聊天用户> [--force]` | 代用户创建绑定，并可强制替换冲突 |
| 白名单管理员 | `查询白名单绑定` | `whitelist-binding` | `mcinfo1.查询白名单绑定 <玩家名>` | 查询玩家绑定状态，用户 ID 默认脱敏 |
| 白名单管理员 | `移除白名单` | `remove-whitelist` | `mcinfo1.移除白名单 <玩家名>` | 移除指定玩家的唯一绑定 |
| 命令管理员 | `执行命令` | `execute-command` | `mcinfo1.执行命令 <命令>` | 执行受权限名单控制的 BDS 命令 |

带 `--mode` 选项的查询指令可通过 `--mode text` 或 `--mode image` 临时覆盖默认输出模式。`查在线`、`历史记录`、`玩家数据统计` 和 `玩家活动` 使用各自固定输出流程，其中 `玩家活动` 固定生成图表图片并附带文字摘要。关闭 `useCommandPrefix` 后，功能指令将去掉 `mcinfo1.` 前缀并注册为顶级指令，单独的 `mcinfo1` 主指令仍会保留。

## 配置表格

### 🏷️ 指令与标识配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `commandPrefix` | 字符串 | `mcinfo1` | 主指令名称；开启功能前缀时也用于组成 `mcinfo1.健康检查` 等指令 |
| `useCommandPrefix` | 布尔值 | `true` | 是否为功能指令添加 `commandPrefix`；关闭后功能指令注册为顶级名称 |
| `serverLabel` | 字符串 | `【神秘小服服1】` | 显示在文字、图片和 QQ Markdown 标题中的服务器名称 |

### 🔌 服务器连接配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `serverUrl` | 字符串 | `http://127.0.0.1:60202` | LeviLamina `serverinfo-rest` HTTP 服务基础地址 |
| `token` | 密钥 | 空 | 状态、玩家和历史数据等只读 API 的访问令牌 |
| `tokenSendMode` | 枚举 | `header` | 只读令牌发送方式，可选 `param`、`header` 或 `both` |
| `adminToken` | 密钥 | 空 | 命令执行、账号绑定和白名单管理 API 的管理令牌 |
| `adminTokenSendMode` | 枚举 | `header` | 管理令牌发送方式，可选 `param`、`header` 或 `both` |
| `apiPrefix` | 字符串 | `/api/v2` | API v2 路径前缀，必须与服务端一致 |
| `timeout` | 数字 | `10000` | HTTP 请求超时毫秒数，范围为 `1000` 至 `60000` |

### 🎯 指令细节设置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `hidePlayerCoordinates` | 布尔值 | `true` | 隐藏玩家在线详情中的全部精确坐标，但不隐藏维度 |
| `playerFieldFilters` | 字段表 | 内置 API v2 字段表 | 控制玩家在线详情字段，完整默认值见后文折叠说明 |
| `historyPageSize` | 数字 | `30` | 历史记录每张图片显示的玩家数量，范围为 `1` 至 `100` |
| `commandExecutionAdminList` | 权限表 | `[]` | 可执行 BDS 命令的聊天账号名单 |
| `whitelistManagementAdminList` | 权限表 | `[]` | 可代绑、查询或移除玩家绑定的管理员名单 |
| `whitelistBindingAuthority` | 数字 | `1` | 绑定玩家和解绑玩家所需的 Koishi 权限等级，范围为 `0` 至 `5` |
| `whitelistBindGroupOnly` | 布尔值 | `true` | 是否只允许在群聊中绑定玩家 |
| `whitelistUnbindGroupOnly` | 布尔值 | `false` | 是否只允许在群聊中解绑玩家；默认允许私聊解绑 |

### 📤 输出配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `enableQuote` | 布尔值 | `true` | 是否引用触发指令的消息；同时控制普通回复、等待提示和 QQ Markdown 的消息关联 |
| `enableWaitingHint` | 布尔值 | `true` | 调用服务端 API 或执行图片渲染时是否立即发送等待提示；根帮助和按钮菜单除外 |
| `defaultOutputModes` | 多选列表 | `["text"]` | 默认输出模式，可选文字和 Typst 图片，也可以同时发送 |
| `typstFallbackToText` | 布尔值 | `false` | Typst 渲染失败时是否补发完整文字结果 |

### 🧩 Typst 渲染配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `downloadFontsFromRelease` | 布尔值 | `true` | 是否从 Release 自动下载并校验 Typst 字体 |
| `typstFontPath` | 路径 | `data/fonts/LXGWWenKaiMono-Medium.ttf` | 中文字体路径，默认位于 Koishi 根目录下的字体目录 |
| `typstEmojiFontPath` | 路径 | `data/fonts/NotoColorEmoji.ttf` | Emoji 字体路径，默认位于 Koishi 根目录下的字体目录 |
| `typstFontFamily` | 字符串 | `LXGW WenKai Mono` | Typst 使用的字体族名称，必须与字体内部名称一致 |
| `typstTemplateFolderRelativePath` | 只读路径列表 | `["data", "assets", "ll-serverinfo-rest-client", "runtime", "templates"]` | 实验性只读项，仅用于查看相对于 `ctx.baseDir` 的模板路径片段 |
| `typstRenderScale` | 数字 | `2.33` | 图片渲染倍率，范围为 `1` 至 `10` |
| `typstTransparentBackground` | 布尔值 | `false` | 是否输出透明背景 PNG；关闭时使用页面背景色 |
| `typstPageBgColor` | 颜色 | `#f2f6f1` | 页面背景色 |
| `typstTextColor` | 颜色 | `#26332b` | 正文文字颜色 |
| `typstHeaderFillColor` | 颜色 | `#2c5e3b` | 标题栏填充色 |
| `typstHeaderStrokeColor` | 颜色 | `#7fa973` | 标题栏描边色 |
| `typstHeaderTextColor` | 颜色 | `#ffffff` | 标题栏文字颜色 |
| `typstPanelFillColor` | 颜色 | `#ffffff` | 内容面板填充色 |
| `typstPanelStrokeColor` | 颜色 | `#cbd9ce` | 内容面板描边色 |
| `typstSectionTitleColor` | 颜色 | `#2c5e3b` | 小节标题颜色 |
| `typstStatsTextColor` | 颜色 | `#66746b` | 统计信息文字颜色 |

### 🤖 QQ Markdown 适配配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `qqMarkdownEnabled` | 布尔值 | `true` | QQ 查询结果是否使用原生 Markdown 和公网图片；不影响按钮菜单指令 |
| `publicBaseUrl` | 字符串 | 空 | QQ Markdown 临时图片公网根地址；留空时回退 Koishi `server.selfUrl` |
| `qqImageCacheTtlMinutes` | 数字 | `15` | QQ Markdown 临时图片保留分钟数，最小值为 `1` |
| `qqImageCacheMaxFiles` | 数字 | `50` | 每个插件实例最多保留的 QQ Markdown 图片数量，最小值为 `1` |
| `qqMarkdownMaxPlayers` | 数字 | `50` | QQ Markdown 在线玩家名单最大展示人数，最小值为 `1` |
| `qqKeyboardEnabled` | 布尔值 | `true` | 是否启用“查在线”附带键盘和“按钮菜单”指令 |
| `qqMarkdownKeyboardJson` | JSON 字符串 | 内置默认键盘模板 | “查在线”键盘模板，支持 `${commandPrefix}` 和 `${serverLabel}` 变量；按钮菜单不读取此项 |

### 🛠️ 调试选项

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `verboseConsoleLog` | 布尔值 | `false` | 输出 API 摘要、Typst 诊断、QQ 图片缓存路径和完整临时公网 URL |

## 专题说明

> **🚀 快速接入与连接配置**
>
> 1. 安装并启动 BDS、LeviLamina 和配套的 `serverinfo-rest` 服务端插件，并确认健康检查接口可以访问。
> 2. 将 `serverUrl` 填为 HTTP 服务地址，例如 `http://127.0.0.1:60202`。
> 3. 保持 `apiPrefix` 与服务端一致；API v2 默认使用 `/api/v2`，本客户端不兼容 API v1。
> 4. 服务端启用只读认证时填写 `token`；使用绑定、白名单或命令管理功能时还需要填写 `adminToken`。
> 5. 按需设置 `commandPrefix`、`useCommandPrefix` 和 `serverLabel`；多个实例可以分别使用 `mcinfo1`、`mcinfo2`。
> 6. Koishi 与 BDS 不在同一台机器时，确认服务端监听地址、防火墙和网络路由允许 Koishi 访问对应端口。

> **🔐 Token、权限与白名单**
> 推荐为只读接口和管理接口使用不同的随机令牌，并优先通过 Bearer Header 发送。

<details>
<summary><strong>查看 Token、权限与白名单详细说明（点击展开）</strong></summary>

- `token` 用于服务器状态、玩家和历史数据等只读接口；`adminToken` 用于绑定玩家、解绑玩家、白名单管理和远程命令接口。
- `tokenSendMode` 和 `adminTokenSendMode` 可分别设为 `param`、`header` 或 `both`。`param` 使用 URL 参数，`header` 使用 `Authorization: Bearer ...`，`both` 同时使用两种方式。
- 客户端两种发送模式默认都是 `header`；服务端只读接收模式默认 `both`，管理接收模式默认 `header`，两端配置必须兼容。
- 使用 `param` 或 `both` 时，token 会进入 URL。客户端调试日志会遮盖 token，但反向代理和其他网络组件仍可能记录完整地址，公网环境应使用 HTTPS。
- 即使客户端填写了 `adminToken`，服务端仍可独立关闭远程命令、账号绑定或白名单管理接口。
- 权限表使用 `userId` 精确匹配；`platform`、`channelId` 和 `selfId` 留空表示不限制对应范围，`enabled` 控制该行是否生效。
- `绑定玩家` 和 `解绑玩家` 受 `whitelistBindingAuthority` 与群聊限制配置控制；管理员白名单操作与命令执行分别使用 `whitelistManagementAdminList` 和 `commandExecutionAdminList`。
- API v2 只有“已绑定”和“未绑定”两种状态。一个聊天账号只能绑定一个 Xbox 玩家，一个 Xbox 玩家也只能绑定一个聊天账号。
- 服务端启用 `syncBindingsToBdsAllowlist` 时，绑定和解绑会同步修改 BDS allowlist；关闭同步时只维护聊天账号与 Xbox 玩家的关系。
- `添加白名单 <玩家名> <聊天用户>` 支持艾特或纯 userId。绑定冲突默认返回 `409`，管理员显式使用 `--force` 时会替换双方冲突绑定。
- 关闭 BDS allowlist 同步后，不会自动清理已经存在的名单项目，避免误删管理员手工维护的记录。
- 绑定数据只保存在对应服务端插件的 `player-data.json` 中，Koishi 不建立数据库镜像。
- `玩家数据统计` 不传玩家名时使用当前聊天账号绑定的玩家；显式提供玩家名时保持公开查询，不要求绑定关系。

</details>

> **⌨️ QQ Markdown 与按钮菜单**
> `qqMarkdownEnabled` 控制查询结果，`qqKeyboardEnabled` 独立控制按钮功能，两项可以分别开关。

<details>
<summary><strong>查看 QQ Markdown 与按钮菜单详细说明（点击展开）</strong></summary>

- `按钮菜单 [页码]` 仅支持 `qq` 平台；即使关闭 `qqMarkdownEnabled`，仍可在 `qqKeyboardEnabled` 开启时主动打开菜单。
- 第 1 页使用两列四行展示八个服务器与概览入口，第 2 页使用两列四行展示七个玩家与账号入口。
- 添加白名单、查询白名单绑定、移除白名单和执行命令不会出现在普通用户菜单中。
- 两页底部固定显示上一页和下一页；边界红叉按钮仍可点击，并会提示已经位于第一页或最后一页。
- 绑定玩家、玩家在线详情和解绑玩家按钮只填入指令，不会立即发送，以便补充参数或避免误触。
- 关闭功能指令前缀后，功能按钮自动改用顶级指令，根按钮仍使用配置的 `commandPrefix`。
- QQ Markdown 查询图片先写入 `cache/ll-serverinfo-rest-client/<实例键>/`，再通过 Koishi server 暴露为临时公网 URL。
- `publicBaseUrl` 必须能够被 QQ 官方服务器直接访问；推荐使用具有有效证书的 HTTPS 域名和标准 `443` 端口。浏览器可以打开并不保证 QQ 图片代理一定允许抓取。
- 图片会按照 `qqImageCacheTtlMinutes` 和 `qqImageCacheMaxFiles` 清理，过期或被清理后的旧消息图片可能无法再次加载。

</details>

> **📈 玩家活动趋势**
> `玩家活动 [yyyyMMdd]` 使用服务端持久化数据绘制在线人数折线与进入次数柱形图，不依赖 Koishi Database 或浏览器服务。

<details>
<summary><strong>查看玩家活动采集与图表说明（点击展开）</strong></summary>

- 不传日期时查询上海时区当天 `00:00` 至当前时刻；指定日期时只接受严格的 `yyyyMMdd`，例如 `20260725`。
- 该指令不提供 `--mode` 参数，会固定生成图表图片并附带文字摘要；没有数据时仍会输出状态图片。
- 未来日期会提示“暂不支持预知未来”；有效日期没有数据时仍会生成带无数据状态的 Typst 图片。
- C++ 服务端每个自然分钟保存一次在线人数心跳，并记录每次玩家进入事件；同一玩家反复重连会重复计入进入次数。
- 玩家活动原始文件由服务端保存在 `player-activity-history/YYYYMMDD.jsonl`，Koishi 不建立第二份数据副本。
- 服务端配置 `playerActivityHistoryRetentionDays` 默认保留 `365` 天；设置为 `0` 或负数表示永久保存。
- 客户端将一分钟数据聚合为五分钟图表点，在线人数取有效心跳平均值，进入次数取区间总和。
- 心跳缺失的区间使用空值并断开折线，不会把 BDS 停机伪装成零人在线。
- 图表展示末次在线、峰值在线、平均在线、总进入次数、独立玩家数和峰值进入分钟。
- ECharts 通过 Node SVG SSR 在本地生成组合图，再由 Resvg 使用本地字体转为高分辨率透明 PNG，并通过 Typst `mapShadow()` 嵌入模板；整个过程不依赖浏览器或 CDN。
- ECharts 图表生成失败时，图片上方显示错误占位，下方统计信息仍由 Typst 正常排版。
- QQ 日期键盘提供前一天、今天或刷新、后一天；今天的后一天按钮会返回未来日期提示。

</details>

> **👤 玩家在线详情字段**
> 文字和 Typst 图片共用 API v2 字段过滤器，敏感网络标识不会进入接口响应。

<details>
<summary><strong>查看玩家字段与过滤规则（点击展开）</strong></summary>

`玩家在线详情 <玩家名>` 调用 `GET /api/v2/player?name=<玩家名>`。服务端在 BDS 主线程定期刷新玩家快照，客户端通过 `playerFieldFilters` 决定展示内容。

默认开启字段：

`name`、`xuid`、`uuid`、`permissionLevel`、`isOperator`、`isSimulated`、`locale`、`gameMode`、`health`、`maxHealth`、`speed`、`isFlying`、`isSneaking`、`isSprinting`、`isMoving`、`isSwimming`、`isInLava`、`isOnGround`、`isOnFire`、`isSleeping`、`isGliding`、`isRiding`、`isInvisible`、`canFly`、`canSleep`、`position.dimensionId`、`biome`、`standingOn`、`expNeededForNextLevel`、`network.currentPingMs`、`network.averagePingMs`、`network.currentPacketLoss`、`network.averagePacketLoss`、`snapshotAtMs`。

默认关闭字段：

`uniqueId`、`position`、`blockPosition`、`feetPosition`、`lastDeathPosition`、`respawnPosition`、`rotation`、`mainHand`、`offHand`、`armor`、`device.platform`、`device.inputMode`。

- 精确坐标同时受 `hidePlayerCoordinates` 总开关和对应字段开关控制，维度信息不受坐标隐藏影响。
- 主手、副手、盔甲、设备平台和输入方式受支持，但默认关闭显示。
- IP、客户端 ID 和服务器地址不会由 API 返回，也不能通过字段配置开启。
- API v2 使用 `isOperator`、`locale` 和 `position` 等规范键；旧 `isOP`、`langCode` 和 `pos` 等配置键不会迁移或生效。

</details>

> **🧩 输出模式、字体与 Typst 模板**
> Typst 完全在本地渲染，不依赖在线渲染服务；默认模板和主题均可配置。

<details>
<summary><strong>查看输出模式、字体与 Typst 模板详细说明（点击展开）</strong></summary>

- `defaultOutputModes` 可以选择文字、Typst 图片或同时发送两种输出；带 `--mode` 选项的查询指令可通过 `--mode text` 或 `--mode image` 临时覆盖。
- `enableQuote` 控制根帮助、按钮菜单、成功结果、错误提示和等待提示是否引用触发消息；QQ Markdown 也只在该配置开启时关联原消息。
- `enableWaitingHint` 开启时，调用服务端 API 或执行图片渲染的指令会立即发送“正在处理服务器请求”提示，并在操作结束后删除；根帮助、按钮菜单以及参数、平台或权限前置校验失败不会显示等待提示。
- 首次启动时可从 Release 自动下载并校验霞鹜文楷 Mono 与 Noto Color Emoji 字体；也可以配置已有字体路径。
- 渲染倍率、背景、正文、标题栏、内容面板、小节标题和统计文字颜色都可以在插件配置页调整。
- `typstTransparentBackground` 默认关闭，此时使用 `typstPageBgColor`；开启后 PNG 保留透明背景。
- 插件发布包中的 `templates/` 保存默认模板，启动时会复制到共享运行目录：

```text
data/assets/ll-serverinfo-rest-client/runtime/templates
```

- `mcinfo1`、`mcinfo2` 等多个插件实例共享同一个运行时模板目录。
- 插件每次出图都读取运行目录中的 `.typ` 文件，修改后下一次渲染即可生效。
- `player-activity.typ` 负责玩家活动统计卡和 ECharts 图表布局，临时图表只存在于 Typst shadow asset 中，不会写入运行目录。
- 启动同步只补充缺失文件，不覆盖用户已经修改的模板；检测到已知旧版默认模板时会先备份再修复。
- 旧版 `player-detail.typ` 会单独备份为 `player-detail.typ.backup-YYYYMMDD-HHmmss`，再替换为兼容 API v2 的模板。
- `typstTemplateFolderRelativePath` 是实验性只读项，仅用于查看相对于 `ctx.baseDir` 的路径片段。
- 插件详情页提供“恢复默认模板”按钮，操作需要 Koishi authority 4，并在执行前进行二次确认。
- 恢复前会将原目录完整备份为 `templates-backup-YYYYMMDD-HHmmss`，恢复后清理 Typst 编译缓存。
- 备份不会自动删除，可在确认新模板正常后手动整理；直接修改模板仅建议熟悉 Typst 的用户使用。

</details>

> **🐛 调试日志与公网图片安全**
>
> `verboseConsoleLog` 默认为 `false`。开启后会输出脱敏后的 API 请求地址与响应摘要、Typst 和字体诊断、QQ 图片缓存路径、图片大小、Markdown 参数以及完整临时图片 URL。URL 参数中的 token 会被遮盖，但 API 响应可能包含玩家资料，临时图片 URL 在缓存有效期内也可直接访问，因此不要将完整生产日志发送到群聊、Issue 或其他公开位置。
