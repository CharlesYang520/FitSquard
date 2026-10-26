# 实施任务：FitSquad 运营后台、指标与提审（第 4 步）

- [x] 1. `core/metrics.ts` + 测试（北极星、漏斗各段） _需求 2_
- [x] 2. 云函数
  - [x] 2.1 管理员身份、封禁拦截、`invite_open` 事件 _需求 1、2.3、3.2_
  - [x] 2.2 `admin.overview` / `admin.users` / `admin.ban` / `admin.teams` / `admin.team` / `admin.replan` _需求 2–4_
  - [x] 2.3 `admin.actions` / `admin.saveAction`（校验 + 敏感词）/ `admin.importSeed` _需求 5_
  - [x] 2.4 集成测试：非管理员拒绝、封禁生效、回退只改明天起、模板校验与生效
- [x] 3. 前端
  - [x] 3.1 分包 `admin/`：概览、用户、战队（含抽检回退）、模板库与编辑 _需求 2–5_
  - [x] 3.2 我的页：管理员入口、复制用户 ID _需求 1.2–1.3_
  - [x] 3.3 协议页面 + 登录页链接 _需求 6.1–6.2_
- [x] 4. `docs/05-提审材料.md` _需求 6.3_
- [ ] 5. 联调（依赖外部环境）：配置 `ADMIN_OPENIDS`，真机走一遍后台
