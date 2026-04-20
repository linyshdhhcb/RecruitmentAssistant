# Recruitment Assistant

一个基于 `Electron + React + SQLite` 的桌面端招聘网站聚合工具，帮助求职者在一个应用内集中管理和访问多个企业招聘官网。

## 功能特性

- 官网浏览页
  - 左侧站点导航（可展开/收起）
  - 关键字搜索
  - 单列 / 双列展示模式切换
  - 按 `category` 分类分组展示
  - 站点登录状态持久化（`webview partition`）
- 网站管理页
  - 新增 / 编辑 / 删除网站
  - 启用 / 停用控制
  - 按名称、URL、备注查询
  - 拖拽排序（自动持久化）
- 配置备份恢复
  - 导出 JSON
  - 导入 JSON（覆盖恢复）

## 技术栈

- Electron（当前固定为 `28.3.3`，确保 `better-sqlite3` 免本地编译）
- React
- Vite
- SQLite (`better-sqlite3@9.6.0`)

## 快速开始

## 环境要求

- Node.js 20.x（推荐 `20.18.1`）
- npm 10+
- Windows PowerShell（用于一键修复脚本）

## 安装依赖

```bash
npm install
```

## 开发运行

```bash
npm run dev
```

## 一键修复（推荐）

当你遇到 `npm install` 卡住、`Electron failed to install correctly`、`better-sqlite3 NODE_MODULE_VERSION` 不匹配、`5173` 端口占用时，优先执行：

```bash
npm run fix:dev-env
```

修复后再启动：

```bash
npm run dev
```

如果希望修复后自动启动开发环境：

```bash
npm run fix:dev-env:run
```

## 构建前端资源

```bash
npm run build:renderer
```

## 生产模式启动（需先构建）

```bash
npm run start
```

## 项目结构

```text
RecruitmentAssistant/
├─ electron/
│  ├─ main.js        # Electron 主进程 + IPC
│  ├─ preload.js     # 安全桥接 API
│  └─ db.js          # SQLite 数据访问层
├─ src/
│  ├─ App.jsx        # 主界面（浏览页 + 管理页）
│  ├─ main.jsx       # React 入口
│  └─ styles.css     # 样式
├─ 企业招聘官网.json   # 初始化站点数据
├─ data.sqlite       # 本地数据库（运行后生成）
└─ package.json
```

## 数据说明

`website` 表核心字段：

- `id`：主键
- `name`：网站名称
- `url`：网站地址
- `category`：分类
- `notes`：备注
- `sort_index`：排序值
- `is_enabled`：启用状态
- `created_at` / `updated_at` / `last_visited_at`：时间字段

## 常见问题排查

### 1) `npm install` 一直卡住

- 不要在 Electron 下载阶段频繁 `Ctrl + C`。
- 先执行 `npm run fix:dev-env`，脚本会自动重建依赖并修复常见锁问题。

### 2) `Electron failed to install correctly`

- 说明 `node_modules/electron` 不完整或损坏。
- 执行 `npm run fix:dev-env` 可自动 `npm rebuild electron`。

### 3) `better-sqlite3 ... NODE_MODULE_VERSION ...`

- 说明原生模块 ABI 与 Electron 版本不一致。
- 脚本会固定 Electron 到兼容版本并重建 `better-sqlite3`。

### 4) `Port 5173 is already in use`

- 脚本会自动释放占用 `5173` 的进程。
- 也可以手动执行：

```bash
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

## 作者信息

- 作者：linyi
- 邮箱：jingshuihuayue@qq.com
- GitHub：[linyshdhhcb/recruitment-assistant](https://github.com/linyshdhhcb/recruitment-assistant.git)

## License

MIT
