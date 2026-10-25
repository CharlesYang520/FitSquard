# 设计文档：FitSquad 主链路

## 概览
- **前端**：Taro 4 + React 18 + TypeScript，编译到微信小程序；样式用 SCSS，设计 token 来自 `mockup/assets/style.css` 第 19 节（碳白竞技）。
- **后端**：微信云开发。两个云函数：`api`（所有业务接口，按 `action` 路由）和 `daily`（定时触发器，日终计算）。
- **共享逻辑**：纯 TypeScript 模块 `core/`（日期类型、清单生成、达标与排名计算），前端预览和云函数共用，用 Vitest 单测；云函数用 esbuild 打包时把 `core/` 内联进去。
- **时区**：所有“日期”都按北京时间（UTC+8）计算，统一用 `core/time.ts` 生成 `YYYY-MM-DD` 字符串，不依赖服务器时区。

## 目录结构
```
FitSquad/
├── docs/ mockup/ ops/            （已有）
└── app/                          小程序工程根目录（在微信开发者工具中打开这里）
    ├── project.config.json       miniprogramRoot=dist/，cloudfunctionRoot=cloudfunctions/
    ├── package.json              Taro、React、Vitest、esbuild
    ├── config/                   Taro 编译配置
    ├── core/                     纯逻辑（前后端共用，带单测）
    │   ├── time.ts               北京时间日期工具
    │   ├── dayType.ts            工作日 / 休息日判断（读 holidays）
    │   ├── random.ts             可复现的随机数（mulberry32）
    │   ├── planGenerator.ts      9 项清单生成 + 推荐
    │   ├── scoring.ts            当天达标、额外完成、连续达标、排名
    │   ├── types.ts              共享类型
    │   └── __tests__/
    ├── data/
    │   ├── holidays/2026.json, 2027.json
    │   ├── actions.seed.json     种子模板（≥ 60 条）
    │   └── fallbackPlans.json    每个主题的固定兜底清单
    ├── src/                      Taro 前端
    │   ├── app.tsx / app.config.ts / app.scss
    │   ├── styles/tokens.scss    设计 token
    │   ├── components/           Button, Card, Tag, Segmented, TaskRow, Slots, PickCard,
    │   │                         HoldConfirm, Avatar, TodayRow, TabBar(用原生 tabBar)
    │   ├── services/api.ts       wx.cloud.callFunction 封装 + 错误码映射
    │   ├── store/session.ts      当前用户、当前局（轻量 React context）
    │   └── pages/login, home, create, invite, checkin, team, me
    └── cloudfunctions/
        ├── api/                  src/index.ts（路由）+ handlers/*.ts，esbuild → index.js
        └── daily/                src/index.ts，esbuild → index.js，config.json 含定时触发器
```

## 数据模型（云数据库集合）
所有集合权限：**仅云函数可读写**（前端不直连数据库）。

| 集合 | 关键字段 | 说明 |
|---|---|---|
| `users` | `_id`=openid, nickname, avatar, agreed_at, streak_days, streak_best, created_at | 体重相关字段第 3 步再加 |
| `actions` | `_id`, group(`move\|food\|rest`), day_type(`workday\|holiday\|any\|festival`), recovery(bool), minutes, scene(`office\|home\|outdoor\|any`), intensity(`light\|medium`), verify(`self\|werun`), werun_steps?, window(`any\|after_lunch\|after_dinner\|after_20\|after_21\|next_morning`), text, sub, reason, themes[], status(`on\|off`), emoji | 模板库 |
| `teams` | `_id`, name, captain_id, theme, period_days, start_date, end_date, status(`active\|ended`), taunt, member_count, team_streak, team_streak_best, last_settled_date, created_at | |
| `members` | `_id`=`{teamId}_{openid}`, team_id, user_id, nickname, avatar, joined_date, left_date?, unwell_days_used, done_days, counted_items, streak_days, streak_best | 一人同时只在 1 个 active 局：由 `users.active_team_id` 保证 |
| `plans` | `_id`=teamId, version, seed, generated_by(`rules\|fallback`), days: [{ day_no, date, day_type, items: actionId[9], pick_id }] | 全周期固化 |
| `checkins` | `_id`=`{teamId}_{openid}_{date}_{actionId}`, team_id, user_id, date, day_no, action_id, mood(`normal\|busy\|unwell`), verified_by(`self\|werun`), counted(bool), extra(bool), created_at | `_id` 唯一 → 天然防同项重复 |
| `days` | `_id`=`{teamId}_{openid}_{date}`, team_id, user_id, date, mood, counted_count, qualified(bool), first_pick_at? | 每成员每天一条，白天实时更新、日终最终确认 |
| `reactions` | `_id`=`{checkinId}_{openid}_{kind}`, checkin_id, team_id, user_id, kind(`cheer\|jiuzhe\|limao`) | 存在即点过，删除即取消 |

`users` 另有 `active_team_id`，开局 / 加入时写入，局结束时清空。

## 核心逻辑（`core/`）

### 日期与日期类型
- `todayCN(now: Date): string`：`new Date(now.getTime() + 8h)` 取 UTC 年月日。
- `dayType(date, holidays)`：调休上班日 → workday；法定假日 → holiday；周六日 → holiday；否则 workday。
- `holidays/YYYY.json` 结构：`{ "holidays": ["2026-10-01", ...], "workdays": ["2026-10-10", ...] }`。

### 清单生成 `generatePlan({ theme, periodDays, startDate, holidays, actions, seed })`
逐天生成：
1. 计算当天 day_type；候选 = 上线模板中 `day_type ∈ {当天类型, any}` 且主题匹配（`themes` 含该主题或为空）。
2. 第 7、14、21 天为恢复日：先从恢复类挑 4 项。
3. 依次满足硬约束：三组各 ≥ 1；时长 ≤ 5 的 ≥ 4；`window = any` 的 ≥ 2；当天类型模板优先（加权随机，权重：当天类型 3、any 1；主题匹配再 ×2）。
4. 局内同一模板 ≤ 2 次，且不与前一天重复；不满足则放宽次数限制重试一次；仍失败用 `fallbackPlans[theme]` 中该日序的清单并标记 `generated_by = fallback`。
5. 推荐项：当天 `group = move`、时长 5–30 的项中，按“当天类型侧重”权重选 1 个；无则选第 1 项。

> **实现调整（2026-10-24）**
> - 60 条种子 × 每条最多 2 次 = 120 个位，小于 14 天 × 9 = 126，所以“同一模板次数”按 2 → 3 → 不限 逐级放宽（每级随机重试 6 次），始终不与前一天重复；运营补到 ~150 条后基本停在 2 次档。
> - 主题只作为权重（匹配 ×2），不作为过滤，避免某组候选太少。
> - 新增硬约束：每天恢复类 ≥ 2（保证“不太舒服”时有得选）、步数项 ≤ 1、至少 1 项可推荐的动一动项。
> - 兜底清单按 主题 × {工作日, 休息日, 恢复日} 各一份 9 项，恢复日只用通用模板。
6. 用 `seed` 驱动 `mulberry32`，相同输入输出完全一致（可追溯、可测试）；“换一套”= 换 seed。

### 达标与排名 `scoring.ts`
- `dayQualified(countedCount, mood)`：mood=unwell 时 ≥ 1，否则 ≥ 3。
- `countable(existingCheckins, now)`：当天已计入数达到门槛 → `extra = true, counted = false`；距上一次计入 < 5 分钟 → `counted = false`（可 5 分钟后再交同一项重新计入：先删除未计入记录再写入）。
- `memberRate(doneDays, passedDays)`：passedDays = 加入日到昨天的天数 + (今天已达标 ? 1 : 0)；为 0 时视为 0。
- `rank(members)`：按 rate 降序 → 当前连续达标降序 → counted_items 降序 → 加入日期升序。
- `teamQualified(memberDays, expectedMembers)`：应达标成员全部 qualified。

## 云函数 `api` 接口
统一入参 `{ action, payload }`，统一出参 `{ ok: true, data } | { ok: false, code, message }`。

| action | 作用 | 关键校验 |
|---|---|---|
| `user.login` | 建档 / 读取用户，返回 user + 当前局摘要 | 必须带 `agreed: true` |
| `plan.preview` | 返回前 3 天清单（不落库） | 只在服务端算，前端不带模板库 |
| `team.create` | 开局 + 生成并固化清单 | 用户无 active 局；period ∈ {14,21}；theme 合法 |
| `team.publicInfo` | 战书落地页数据 | 只返回公开字段 |
| `team.join` | 加入 | 局 active；人数 < 10；用户无 active 局 |
| `team.home` | 首页 / 战队页数据：局信息、今日头像排、实时排名、动态（最近 30 条）、今日清单与我的打卡、钩子 | 成员身份 |
| `checkin.today` | 打卡页数据：当天清单 + 模板详情 + 我的状态 + 锁定信息 | 成员身份 |
| `checkin.setMood` | 设置今天状态 | unwell 每局 ≤ 2 天；当天已有计入打卡时不可从 unwell 切回（避免门槛来回切换） |
| `checkin.submit` | 自报打卡 | 见需求 6.6–6.9；用事务写 `checkins` + `days` + `members` |
| `checkin.werun` | 上传微信运动 CloudID，解密取今日步数，达到阈值时自动写入 | 只处理 `verify = werun` 的项 |
| `feed.react` | 表情点 / 取消 | 成员身份；kind 合法 |

错误码：`NOT_MEMBER`、`ALREADY_IN_TEAM`、`TEAM_FULL`、`TEAM_ENDED`、`NOT_IN_PLAN`、`LOCKED`、`DUPLICATE`、`MOOD_LIMIT`、`BAD_INPUT`。

## 云函数 `daily`（定时触发器，每天 12:05 北京时间）
> **实现调整**：原定 00:05。“明早确认”类项允许次日 05:00–12:00 记入前一天，00:05 结算会漏掉这些确认，所以改为 12:05 结算昨天（漏跑会自动补结算之前所有未结算日）。结算前，首页 / 排名对“昨天”按“待定”处理：已达标即计入，未达标不扣、不断连续。

对每个 active 局，结算“昨天”：
1. 读取应达标成员（joined_date ≤ 昨天 且 未退出）和昨天的 `days`。
2. 每个成员：qualified 则 streak+1、done_days+1，否则 streak=0；更新 streak_best；同步 `users.streak_*`。
3. 全队全员 qualified → team_streak+1，否则清零；更新 best。
4. 写 `teams.last_settled_date = 昨天`，若已等于昨天则跳过（幂等）。
5. 昨天 = end_date → status=ended，清空成员的 `users.active_team_id`。

白天的“实时”：`checkin.submit` 同步更新当天 `days.qualified` 和 `members.counted_items`；首页显示的“今天达标后计入”的排名由 `team.home` 在读时用 `days` 合成，不提前改 streak。

## 前端页面
| 页面 | 路径 | 主要接口 |
|---|---|---|
| 登录 | `pages/login` | `user.login` |
| 今日（tab） | `pages/home` | `team.home` |
| 开一局 | `pages/create` | `plan.preview`、`team.create`、`onShareAppMessage` |
| 战书落地页 | `pages/invite?team=` | `team.publicInfo`、`team.join` |
| 打卡 | `pages/checkin` | `checkin.today`、`checkin.setMood`、`checkin.submit`、`checkin.werun` |
| 战队（tab） | `pages/team` | `team.home`、`feed.react` |
| 我的（tab） | `pages/me` | `team.home`（我的部分） |

- 启动：`app.tsx` 中 `wx.cloud.init({ env })`；`env` 从 `src/config.ts` 读，开发者在本地填入云环境 ID。
- 登录态：首次 `user.login` 成功后本地缓存 `agreed`；之后打开直接调 `user.login` 拿状态，无局进首页无局态。
- 分享：开一局和战队页的 `onShareAppMessage` 返回 `{ title: '{发起人}向你下了战书：{狠话}', path: '/pages/invite/index?team={id}' }`。
- 按住 1 秒：`HoldConfirm` 组件用 `onTouchStart` 启动 1000ms 计时并驱动填充动画，`onTouchEnd / onTouchCancel` 未满 1 秒则取消；满 1 秒触发 `onConfirm` 并 `wx.vibrateShort`。
- 字体：`app.tsx` 中 `wx.loadFontFace({ family: 'FSSerif', source: 'url(云存储临时链接)' , global: true })`，失败静默。

## 错误处理
- 前端统一在 `services/api.ts` 把错误码映射为中文提示（toast），网络失败提示“网络比你还会摸鱼，再试一次”。
- 云函数所有写操作用事务；任何异常返回 `ok:false` 并记录日志，不抛出未处理异常。

## 测试策略
- `core/` 全部纯函数用 Vitest 覆盖：日期类型（含调休）、清单约束（随机 200 个 seed 全部满足硬约束）、可复现性、兜底路径、达标门槛、5 分钟规则、额外完成、排名排序、迟到成员达标率、全队连续达标。
- 云函数 handler 依赖注入数据库接口，用内存假库做集成测试：开局 → 加入 → 打卡 → 日终 → 连续达标。
- 前端：在微信开发者工具中按 Mockup 逐页人工核对；关键交互（按住 1 秒、锁定项、9 选 3 门槛）列入验收清单。

## 需要用户提供（不阻塞编码）
- 小程序 AppID（暂用测试号 / `touristappid` 编译），云开发环境 ID（填入 `src/config.ts` 和 `project.config.json`）。
- 正式行动模板约 150 条（种子 60 条先由开发写入，运营审核替换）。
