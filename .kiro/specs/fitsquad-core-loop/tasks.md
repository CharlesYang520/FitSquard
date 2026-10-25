# 实施任务：FitSquad 主链路

> 需求见 `requirements.md`，设计见 `design.md`。每个任务完成后运行 `npm test` 和 `npm run build:weapp` 保证通过。

- [x] 1. 工程骨架
  - [x] 1.1 在 `app/` 初始化 Taro 4 + React + TypeScript 工程（微信小程序），配置 `project.config.json`（miniprogramRoot=dist/，cloudfunctionRoot=cloudfunctions/）、`src/config.ts`（云环境 ID 占位）、原生 tabBar 三项（今日 / 战队 / 我的）与 7 个页面的空壳 _需求 1.1、1.2_
  - [x] 1.2 配置 Vitest（只跑 `core/`），配置 esbuild 打包两个云函数（`npm run build:cloud`），确认 `npm test`、`npm run build:weapp`、`npm run build:cloud` 都能跑通 _需求 1.2、1.5_
  - [x] 1.3 建 `src/styles/tokens.scss`（碳白竞技 token）和基础组件：Button、Card、Tag、Segmented、Avatar、TodayRow _需求 1.3_
  - [x] 1.4 实现打卡相关组件：TaskRow（打勾 / 锁定 / 步数圆环）、Slots（3 槽 / 1 槽）、PickCard（推荐卡）、HoldConfirm（按住 1 秒） _需求 1.3、6.5_
  - [x] 1.5 字体加载（思源宋体子集，失败回退） _需求 1.4_

- [x] 2. 共享逻辑 `core/`（先写测试）
  - [x] 2.1 `time.ts` + `dayType.ts` + `data/holidays/2026.json、2027.json`，测试含调休上班日、法定假日、周末 _需求 3.4、3.5_
  - [x] 2.2 `data/actions.seed.json`（≥ 60 条，覆盖三组 × 工作日 / 休息日 / 通用，含恢复类、微信运动类、各时间窗）+ `data/fallbackPlans.json` _需求 3.1–3.3_
  - [x] 2.3 `random.ts` + `planGenerator.ts`：9 项硬约束、恢复日、同模板次数与相邻天去重、放宽重试、兜底、推荐项；测试 200 个随机 seed 全部满足约束、同 seed 结果一致 _需求 4.4–4.6_
  - [x] 2.4 `scoring.ts`：当天达标门槛、5 分钟规则、额外完成、达标率（含迟到成员）、排名、全队达标；测试覆盖所有分支 _需求 6.7–6.9、7.2–7.3、8.4_

- [x] 3. 云函数 `api`
  - [x] 3.1 路由、统一出参、错误码、数据库访问层（可注入内存假库用于测试） _需求 10.1–10.3_
  - [x] 3.2 `user.login` _需求 2.1–2.5_
  - [x] 3.3 `plan.preview`、`team.create`（事务：建局、加成员、固化清单、写 active_team_id） _需求 4.1–4.7_
  - [x] 3.4 `team.publicInfo`、`team.join` _需求 5.2–5.7、10.4_
  - [x] 3.5 `checkin.today`、`checkin.setMood`、`checkin.submit`（全部校验 + 事务写入） _需求 6.1–6.9、6.11_
  - [x] 3.6 `checkin.werun`（CloudID 解密、阈值自动打卡） _需求 6.10_
  - [x] 3.7 `team.home`（今日头像排、实时排名、动态、钩子）、`feed.react` _需求 8.1–8.6_
  - [x] 3.8 集成测试：内存假库跑通 开局 → 2 人加入（1 人迟到）→ 打卡（含 5 分钟、额外完成、不太舒服）→ 排名

- [x] 4. 云函数 `daily`
  - [x] 4.1 日终结算（个人 / 全队连续达标、done_days、幂等、局结束置状态并清 active_team_id）+ 定时触发器配置 _需求 7.1–7.6_
  - [x] 4.2 测试：重复执行幂等、迟到成员只从加入日起算、全队连续达标断开与延续

- [x] 5. 前端页面（按 Mockup 还原）
  - [x] 5.1 `services/api.ts`（错误码中文映射）+ `store/session.ts` + 启动逻辑（云初始化、登录态判断、战书路径跳转） _需求 2.3、2.4_
  - [x] 5.2 登录页（01） _需求 2.1、2.2_
  - [x] 5.3 开一局页（04）：周期 / 主题 / 队名、前 3 天预览、换一套、开局后发战书面板（狠话 3 选 1、分享） _需求 4.1–4.3、5.1_
  - [x] 5.4 战书落地页（05）：公开信息、加入、已满 / 已在别的局 / 已结束三种态 _需求 5.2–5.6_
  - [x] 5.5 打卡页（08）：日期标签、今天状态、槽、推荐卡、分组清单、锁定、按住 1 秒确认、达标反馈、微信运动授权与上报 _需求 6.1–6.10_
  - [x] 5.6 首页（03）有局 / 无局 _需求 8.1、8.2_
  - [x] 5.7 战队页（07）：连续达标、今日 N/M、实时排名、动态与表情 _需求 8.3–8.6_
  - [x] 5.8 我的页（13）基础版：连续达标、格子图、占位入口 _需求 9.1、9.2_

- [ ] 6. 联调与验收
  - [ ] 6.1 在微信开发者工具中用两个账号（或模拟多 openid）走通：登录 → 开局 → 分享 → 加入 → 打卡 → 次日 → 连续达标
  - [ ] 6.2 按 Mockup 逐页核对视觉（浏览器版已核对，待真机复核）
  - [x] 6.3 整理第 3 步（催一下、通知、战报、再来一局、私密体重、海报）的 Spec：见 `.kiro/specs/fitsquad-retention/`
