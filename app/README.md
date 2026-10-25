# 瘦身战队 · 小程序工程

Taro 4 + React + TypeScript，后端微信云开发（云函数 `api` / `daily`）。

## 常用命令
| 命令 | 作用 |
|---|---|
| `npm install` | 安装依赖（已配国内镜像，见 `.npmrc`） |
| `npm run dev:weapp` | 监听编译到 `dist/`（开发时开着） |
| `npm run build:weapp` | 生产编译 |
| `npm run build:cloud` | 打包两个云函数到 `cloudfunctions/*/index.js` |
| `npm test` | 单元测试 + 云函数集成测试（内存假库） |
| `npm run build:h5` | 编译浏览器版到 `dist-h5/`（只用于快速看页面，本地演示模式） |

## 在微信开发者工具里看
1. `npm run build:weapp`
2. 开发者工具 → 导入项目 → 目录选本文件夹 `app/`，AppID 先用测试号。
3. `src/config.ts` 里 `CLOUD_ENV` 为空时是**本地演示模式**：云函数代码直接跑在小程序里，数据存在本机缓存，开局后会自动拉 2 个机器人队友。“我的 → 清空本地演示数据”可重来。

## 接入云开发（拿到 AppID 和环境 ID 后）
1. `project.config.json` 的 `appid` 改成正式 AppID；`src/config.ts` 的 `CLOUD_ENV` 填环境 ID，重新 `npm run build:weapp`。
2. `npm run build:cloud`。
3. 开发者工具左侧 `cloudfunctions/api`、`cloudfunctions/daily` 右键 → **上传并部署：云端安装依赖**。
4. `daily` 右键 → **上传触发器**（`config.json`：每天 12:05 北京时间结算昨天）。
5. 云开发控制台 → 数据库，新建集合：`users` `actions` `teams` `members` `plans` `checkins` `days` `reactions`，权限都选 **“所有用户不可读写（仅云函数）”**。
6. 建索引（数据库 → 集合 → 索引管理）：
   - `members`: `team_id`
   - `checkins`: `team_id + created_at(降序)`、`team_id + user_id + date`
   - `days`: `team_id + date`、`team_id + user_id`
   - `reactions`: `team_id + checkin_id`
   - `teams`: `status`
7. （可选）把 `data/actions.seed.json` 导入 `actions` 集合；不导入时云函数直接用内置种子。

## 目录
- `core/` 前后端共用纯逻辑：日期 / 工作日判断、清单生成、达标与排名（有单测）
- `data/` 节假日、行动模板种子、兜底清单
- `src/` 页面与组件
- `cloudfunctions/api` 业务接口（按 action 路由）；`cloudfunctions/daily` 日终结算
