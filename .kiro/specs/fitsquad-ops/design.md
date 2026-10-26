# 设计文档：FitSquad 运营后台、指标与提审（第 4 步）

## 方案
- 后台做成小程序分包 `admin/`（不占主包体积），页面：概览、用户、战队（含计划抽检）、模板库、模板编辑。
- 接口仍走云函数 `api`，新增 `admin.*` 路由；`Ctx.adminIds` 来自环境变量 `ADMIN_OPENIDS`。本地演示模式下本机用户默认是管理员。
- 封禁：`users.banned_at`；`dispatch` 在调用 handler 前检查（`user.login`、`team.publicInfo` 除外），返回 `BANNED`。

## 数据
| 集合 | 变更 |
|---|---|
| `users` | `banned_at` |
| `events`（新） | `_id = invite_open_{teamId}_{openid}_{date}`、`name`、`user_id`、`team_id`、`date`、`ts`；目前只有 `invite_open` |

其余指标直接从 `users` / `members` / `days` / `checkins` / `reports` 算，不重复埋点。

## 指标计算（`core/metrics.ts`，纯函数）
- `northStar(days, today)`：近 7 天（含今天）每队每人达标天数 ≥ 5 的人数 ≥ 2 → 计 1 队。
- `funnel(input, today)`：窗口 30 天。
  - 新登录：`users.created_at` 在窗口内。
  - 加入 / 开局：窗口内新用户中，有任意 `members` 记录的。
  - 首次达标：其中有任意 `days.qualified`。
  - D3 / D7：首次加入日之后第 3 / 7 天（含）当天或之后仍有打卡记录（`days.counted_count > 0`），且距首次加入已满 3 / 7 天才进入分母。
  - 一局完成：参加过已结束局、且在该局完成率 ≥ 60%。
  - 再来一局：一局结束后 7 天内又加入 / 开了下一局。
- 后台接口一次性读取（种子期数据量小，单集合上限 1000 条，超出时提示“数据量已超出后台统计范围，请导出分析”）。

## 接口（`admin.*`）
| action | 作用 |
|---|---|
| `admin.overview` | 概览 + 北极星 + 漏斗 |
| `admin.users` | 搜索用户（`q` 匹配昵称包含或 ID 前缀） |
| `admin.ban` | `{ user_id, banned }` |
| `admin.teams` | `{ status }` 列表 |
| `admin.team` | 战队详情 + 今天 / 明天清单 |
| `admin.replan` | `{ team_id, mode: 'reroll' | 'fallback' }`：明天起替换 |
| `admin.actions` | 模板列表（含下线） |
| `admin.saveAction` | 新增 / 编辑（校验见需求 5.2） |
| `admin.importSeed` | 云库为空时导入种子 |

模板库修改后调用 `resetActionCache()`，同一实例 60 秒缓存外的实例最迟 60 秒生效。

## 协议页面
- `pages/legal/index?doc=terms|privacy|health`，正文放在 `src/legal.ts`（纯文本分段），登录页链接跳转。
- 提审材料：`docs/05-提审材料.md`。
