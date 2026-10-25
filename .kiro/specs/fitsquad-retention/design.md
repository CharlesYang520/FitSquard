# 设计文档：FitSquad 留存闭环（第 3 步）

沿用主链路的架构：业务逻辑在云函数 `api` / `daily`，纯计算放 `core/`，前端只调接口。新增代码同样可在“本地演示模式”下运行（通知改为打印日志 + 返回降级结果）。

## 数据变更
| 集合 | 新增字段 / 新集合 | 说明 |
|---|---|---|
| `users` | `sub_quota: { morning, nudge, team }`、`last_morning_date`、`height_cm`、`health_consent_at`、`deleted_at` | 额度只增减不回传前端具体数值 |
| `days` | `qualified_at` | 当天第一次达标的时间，用于“早鸟 / 压哨王” |
| `teams` | `offline_note`、`prev_team_id`、`next_team_id`、`all_done_dates[]`、`report_ready` | `all_done_dates` 记录已发过“全员到齐”的日期（同时就是全员到齐的天数来源之一） |
| `nudges`（新） | `_id`、`team_id`、`from`、`to`、`date`、`via(notify|share)`、`created_at` | 限次与统计 |
| `reports`（新） | `_id = teamId`、`member_ids[]`、`team{...}`、`members[{user_id, done_days, expected_days, rate, best_streak, rank, title}]`、`created_at` | 一局一份；历史战报按 `member_ids` 查 |
| `weights`（新） | `_id = {openid}_{date}`、`user_id`、`date`、`weight_kg` | 只本人可读写 |

## 通知（`cloudfunctions/api/src/notify.ts`）
- 模板配置来自云函数环境变量：`TPL_MORNING`、`TPL_NUDGE`、`TPL_TEAM`（模板 ID）。未配置 = 该能力降级。字段映射集中写在 `TEMPLATE_FIELDS`，拿到模板后按实际字段名（`thing1` / `time2` …）调整一处即可。
- `Notifier` 接口：`send(openid, kind, data, page) → 'sent' | 'no_quota' | 'disabled' | 'failed'`。云端实现调用 `cloud.openapi.subscribeMessage.send`（`config.json` 声明 `openapi` 权限）；测试与本地演示用内存实现记录发送。
- 额度：`sub.grant { accepted: kind[] }` → 对应 `sub_quota.kind += 1`（每次最多 +1，上限 50 防刷）；发送前检查，成功 -1，失败（43101 用户拒收等）清零。
- `user.login` 返回 `templates: { morning?: id, nudge?: id, team?: id }`，前端据此请求授权。

## 接口新增（`api`）
| action | 作用 |
|---|---|
| `sub.grant` | 授权结果上报，加额度 |
| `team.nudgeInfo` | 战况卡数据 + 被催人是否可直接通知 + 我今天还剩几次 |
| `team.nudge` | 催一下：可通知则发通知（via=notify），否则记录 via=share 并返回分享文案 |
| `team.setNote` | 发起人设置线下约定 |
| `team.leave` | 退出进行中的局 |
| `team.rematch` | 再来一局（已存在 `next_team_id` 时直接返回新局） |
| `report.get` | 某局战报（成员可读） |
| `report.list` | 我的历史战报 |
| `weight.consent` | 同意（带身高）/ 撤回（删除全部） |
| `weight.add` | 记一条（当天覆盖） |
| `weight.list` | 最近 30 条 + 身高 |
| `user.delete` | 注销 |

`checkin.submit` / `checkin.werun`：达标时写 `days.qualified_at`；`is_last` 且全队 ≥ 2 人且当天未通知过 → 给其他成员发 `team` 通知并把日期写入 `all_done_dates`。

## 战报与称号（`core/report.ts`，纯函数）
输入：成员（joined_date、left_date）、每人每天的 `days`（qualified、qualified_at）、局起止日期、结算后的 `streak_best`。
- `expected_days` = 加入日到最后一天（退出者到退出前一天）。
- `best_streak` = 在应达标日序列上重新计算的最长连续达标（不依赖存量字段，保证可复算）。
- 每天“第一个达标”= `qualified_at` 最小者；“压哨”= 当天全员达标时 `qualified_at` 最大者。
- 名次：按完成率 ↓、最长连续 ↓、加入日期 ↑。
- 称号按需求 5.2 顺序分配。
- 全队：完成率 = Σdone / Σexpected；全员到齐天数 = 每天应达标成员全部达标的天数；全队最长连续达标 = 全员到齐天数序列的最长连续段。

## 定时任务（`daily`）
- 触发器 `settle`：12:05 结算昨天（已有）；结算到最后一天并置为 ended 后调用 `buildReport` 写 `reports`，设置 `teams.report_ready`，并给成员发 `team` 通知。
- 触发器 `morning`：08:30 发明早提醒；用 `users.last_morning_date` 幂等。
- 入口按 `event.TriggerName` 分发。

## 前端
- `services/subscribe.ts`：`askSubscribe()` 在用户点击回调里同步调用 `wx.requestSubscribeMessage`，再上报 `sub.grant`。
- 战队页：今日卡片加“催 XX”（取第一个未达标的人，可切换）→ 战况卡弹层（`Nudge` 组件）；发起人可编辑线下约定；右上“···”菜单：退出这局。
- 新页面：`pages/report`（战报）、`pages/poster`（Canvas 2D 海报，`type=invite|report`）、`pages/weight`（私密体重：同意 / 记录 / 折线）。
- 我的页：私密体重、历史战报（真实数据）、注销入口。
- 局结束后首页显示“这局打完了，看战报 / 再来一局”。

## 安全
- 体重接口只按 `ctx.openid` 读写自己的文档；`team.*`、`report.*` 永不读取 `weights` 或 `height_cm`。
- 注销后 `users` 保留空壳（`deleted_at`），防止历史数据关联错乱；再次登录视为新用户需重新同意。
