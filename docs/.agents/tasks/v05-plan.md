# FitSquad v0.5「精简：只留差异化」实施计划

仓库根：`/Users/cn-charlesyang/AI Native/02 life/FitSquad`（路径含空格，命令里一律加引号）。
**不是 git 仓库**（`git status` → `fatal: not a git repository`）：归档用 `mv`，不 commit。diff 基线 = 快照 `/Users/cn-charlesyang/AI Native/02 life/FitSquad/.backup/v0.4-2026-10-19/`（docs/ + mockup/ 全量，已核对一致）。
没有构建 / 测试工具链（纯 Markdown + 静态 HTML）。每步的"验证" = 第 2 节校验脚本 `v05_check.py` + 用 headless Chrome 截图后目测（见 2.2）。

判断标准（用户已确认）：页面或规则要么让熟人之间较劲，要么帮忙拉新人，否则砍掉或合并。A–G 决策已全部确认，本计划只负责落地和全局一致，不改方案。

---

## 0. 绝对不许改的数字 / 口径

只能删掉含这些数字的整块内容（比如 10 页战队榜），不能改数值本身：

- 结算：全员达成 **500**（200 + 200 + 100）/ 部分达成者 **400**（200 + 100 + 100）/ 坚持奖 **60**；奖池 **340**、系统回收 **40**、340 ÷ 3 = 113 封顶 100。
- 结算后：小王 **1,858**、Lily **1,096**、大刘 **850**。
- 小王进行中：总 **1,658** / 可用 **1,458** / 冻结 **200** / 累计获得 **1,658**（G 只补文字说明，不改数字）。
- 好友榜：阿杰 2,480 / Mia 1,920 / 小王 1,658 / Lily 1,236 / 大刘 1,050 / 老陈 980 / 芳芳 860；距第 2 名差 262。
- 押注 0 / 100 / 200 / 500 / 1000；周期 14 / 21 / 30 / 60；人数 3–10；目标下限 0.5 / 0.75 / 1.1 / 2.1；上限示例 4.3（-6.0%）、1.1（-1.5%）；R = 100 / 150 / 200 / 400；新人 1000；12 个月有效；打卡积分 称重 +5、步数 +5、连续 7 天 +30、邀请 +200（每月 10 人）。
- 原第 3 步的演示数据搬进 06 时原样照搬：当前 **1,000**、发起后冻结 **200**、满员押注总额 **1000**、每人押注 200。
- 历史：各文件「版本记录」里 v0.1–v0.4 的行，以及 PRD「v0.2 / v0.3 / v0.4 变更明细」（含「已定口径（v0.2 补充）」第 1 条重叠战队说明）**一字不改**。
- **唯一允许改的派生数字**：02 第 7 节过程积分，「称重 150 + 步数 150 + 阅读 30 + 连续 7 天 ≈ 120 / 每月约 450 / ≈ 4.5 元」改为「称重 150 + 步数 150 + 连续 7 天 ≈ 120 / 每月约 **420** / ≈ **4.2** 元」。算式：5×30 + 5×30 + 30×4 = 420。

## 1. 规划阶段已拍板的决策（实施时不要再改）

1. **06 页不显示步骤条。** 创建战队对外只说「2 步」（PRD、03 提示词、04 步骤条都是 ① 基本信息 ② 规则契约）。06 是被邀请人和队长共用的目标页，再挂一个 ③ 就又变回 3 步，口径会打架。队长发起状态改成在页顶放一张「最后一步：定好你自己的目标，就能发起契约」的战队条，进度感由它承担。
2. **10 页去掉「本周 / 本月 / 总榜」时间筛选。** 好友榜显示的是活力值余额（2,480 / 1,920 / 1,658… 就是各人的账户总额），按时间切换没有意义，只会多出 3 套数字要维护。只留一行提示「好友榜 · 按活力值排名」。
3. **P-07 保留 ID，改成一句干净的话**：「打卡类积分（称重、步数、连续 7 天）按人计，每人每天只算一次；每人同时只能参加 1 支战队（T-14），不存在跨战队重复计分」。P-07 被 T-14、风控等口径引用过，删掉会出现编号空洞。v0.4 处理 P-06 也是这么做的。
4. **R-02 / R-03 两行整行删除，ID 不复用、不重编号**；页面清单第 12 项、PRD 4.10 也一样，整节或整行删除、留空号。这样保住全站「PRD 4.13」「R-06」「R-07」「T-16」等交叉引用。原因写进 v0.5 变更明细。
5. **02b 演示「+1000 到账」用 data-set-state 小弹层，不用 data-toast。** `mock.js` 的 data-toast 会 `preventDefault()`，挂在跳转按钮上就跳不走了。所以：主按钮「完成，领 1000 活力值」是普通链接 → `03-home.html`（保证流程连通）；手机框外的切换器加两个状态「提交成功」(`done`) 和「提交成功·邀请进来」(`invite`)，用已有的 `.mask` + `.dialog` 类显示「🎉 +1000 活力值到账」小弹层，`done` 时按钮 → 03，`invite` 时按钮 → 05。这正好是需求里「toast / 小弹层」的弹层，只用到 mock.js 已有的 `data-set-state` / `data-when`，**mock.js 不改**。
6. **04 第 2 步 → `06-set-goal.html#captain`。** 06 默认状态仍是「被邀请人加入」（保持不变）；06 页私有 `<script>`（已有滑杆脚本）里加几行：`DOMContentLoaded` 时如果 `location.hash === '#captain'`，就点一下切换器里的「队长发起」按钮。这样从 04 进来直接落到队长状态，mock.js 不改。断链脚本会把 `#captain` 去掉再检查文件，不影响。
7. **06 队长发起状态沿用原第 3 步的演示内容**（小王 72.0 kg、当前 1,000、冻结 200、"队长视角"）。原第 3 步 v0.4 就是这么演示的，并且评审通过了；不为「队长其实是阿杰」去改数据，避免牵动其他页面。
8. **「已在一支战队里」的统一文案**（按 PRD 4.13，只调侃行为）：
   - 提示 / toast：「你已经在一支战队里了，这期结束再来 😎」
   - 05 置灰按钮：「已在一支战队里，这期结束再来」
9. **SHARED-SPEC 第 6 节战队榜那行改成「示例战队」**，只保留仍被页面使用的两支队：周末不吃火锅联盟（小王上一期，5 人 30 天全员达成、平均 -4.4%，用于 03 状态 B 示例卡、09-settle-success、11 流水），陈家四口减脂局（老陈带队的家庭队，30 天平均 -4.1%，用于 03 状态 B 示例卡）。干饭人减脂营、老妈的广场舞战队、产品部不加班队、闺蜜奶茶戒断群四支队删掉，现在只有 10 页在用它们，10 页的战队榜也会一起删掉。
10. **免责页面清单两处统一成同一份**（SHARED-SPEC 第 5 节、03 第 5 节）：登录页、身体档案、契约落地页、设定目标页（含队长发起状态）、打卡页、我的页。删掉「创建战队第 3 步」（已并入 06 队长发起状态）和「健康知识详情」。现在 SHARED-SPEC 缺身体档案、03 缺打卡页，一起补齐。这些页面本来就有免责，`grep -l '不提供医疗建议\|健康免责声明' pages/*.html` 已核实。
11. **「v0.2 补充」的重叠战队说明不动。** 它在 PRD 第 11 节「v0.2 变更明细」下面，属于历史区。需求的意思是只删正文，保留历史原文。PRD 正文里涉及重叠战队的只有 P-07、T-14、4.5 不变式、第 5 节风控「重复计分」这 4 处。
12. **02 第 6 节活动官的输出「加码任务」改为「节点挑战」**。中期加码已经删了，这里不改就和正文自相矛盾；活动官本身是增长期才启用，职责不受影响。
13. **02 云函数列表里的 `content` 保留**：它负责图文内容安全（C-09），和健康知识无关。
14. **截图不重新生成**，和 v0.4 一致（v0.4 改了 03 / 11 / 13，截图仍是 10-18 的）。只把 5 张归档页的截图挪走；在交付说明里写明「留下的截图是 v0.4 之前的画面，验收以 HTML 为准」。
15. **3.10 提示词顺手对齐 SHARED-SPEC**：原来写的「6 Tony 980」改成「6 老陈 980、7 芳芳 860」。数字不变，只是把人名改对。
16. **文案库（03 第 6.2 节）没有只和健康知识相关的条目**（逐条核对过），所以条数还是 37，不改。

---

## 2. 校验脚本（各步共用）

### 2.1 第 1 步先创建 `docs/.agents/tasks/v05_check.py`（内容如下，原样写入）

```python
#!/usr/bin/env python3
"""FitSquad v0.5 校验。用法：python3 v05_check.py [links|residue|flow|frozen|newnums|all]
退出码 0 = 通过；1 = 有硬失败（断链 / 残留 / 流程缺边 / 冻结数字缺失 / 不该动的文件被改）。newnums 只报告不判失败。"""
import re, os, sys, glob, collections

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
MK = os.path.join(ROOT, 'mockup')
BK = os.path.join(ROOT, '.backup', 'v0.4-2026-10-19')
ARCHIVED = ['02a-onboarding-intro', '02c-onboarding-points', '04-create-team-step3',
            '12-knowledge-list', '12-knowledge-detail', '15a-', '15b-', '15c-']
DOCS = ['docs/01-PRD-MVP.md', 'docs/02-整体解决方案.md', 'docs/03-Mockup提示词.md', 'mockup/SHARED-SPEC.md']

def rd(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()

def page_rels():
    return sorted(os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(MK, 'pages', '*.html')))

def live(text):
    """文档只查正文：截掉版本记录区（PRD 从 '## 11. 版本记录' 起，其余从 '## 版本记录' 起）。"""
    for mark in ('\n## 11. 版本记录', '\n## 版本记录'):
        i = text.find(mark)
        if i != -1:
            return text[:i]
    return text

def links():
    bad = []
    for rel in page_rels() + ['mockup/index.html']:
        f = os.path.join(ROOT, rel)
        for m in re.finditer(r'(?:href|src)="([^"#:]+)(?:#[^"]*)?"', rd(rel)):
            url = m.group(1)
            p = os.path.normpath(os.path.join(os.path.dirname(f), url))
            if not os.path.exists(p) or any(a in url for a in ARCHIVED):
                bad.append((rel, url))
    print('[links] BROKEN/ARCHIVED LINKS:', bad or 'none')
    return not bad

RESIDUE = [r'健康知识', r'健康小知识', r'每日知识', r'知识库', r'知识卡', r'kn-card', r'articles', r'文章管理', r'站内文章',
           r'阅读每日', r'阅读健康', r'阅读 \+1', r'阅读 30', r'去阅读', r'阅读积分',
           r'新手引导', r'玩法介绍', r'3 屏', r'02a-onboarding', r'02c-onboarding', r'step3', r'第 3 步',
           r'创建战队（3 步）', r'创建战队 3 步', r'③ 我的目标',
           r'战队榜', r'个人榜', r'个人总榜', r'全站战队', r'全站排行', r'全站榜', r'全站第', r'R-02', r'R-03',
           r'中期加码', r'加码任务', r'1 万步',
           r'2 支战队', r'两支战队', r'同时最多参加 2', r'最多同时 2', r'重叠', r'五折', r'0\.25×R']
ALLOW = {  # 正文里刻意保留的说明行：行内含下列任一子串即视为允许
    'docs/01-PRD-MVP.md': ['健康知识（站内文章', '全站或公司战队榜等企业版再做', '公司榜 / 全站战队榜留到企业版', '不做新手引导页'],
    'docs/02-整体解决方案.md': ['不再产出站内文章', 'v0.5 起站内不做健康知识'],
    'docs/03-Mockup提示词.md': ['v0.5 精简', '不做新手引导页'],
    'mockup/SHARED-SPEC.md': ['v0.5：', 'v0.5 起：'],
    'mockup/index.html': ['v0.5「精简」'],
}

def residue():
    pat = re.compile('|'.join(RESIDUE))
    bad, allowed = [], []
    targets = [(r, True) for r in DOCS] + [(r, False) for r in page_rels() + ['mockup/index.html', 'mockup/assets/mock.js']]
    for rel, is_doc in targets:
        text = live(rd(rel)) if is_doc else rd(rel)
        for n, line in enumerate(text.split('\n'), 1):
            if pat.search(line):
                hit = (rel, n, pat.search(line).group(0), line.strip()[:120])
                (allowed if any(a in line for a in ALLOW.get(rel, [])) else bad).append(hit)
    for h in allowed:
        print('[residue] allowed  ', h[0], 'L%d' % h[1], h[2])
    for h in bad:
        print('[residue] UNEXPECTED', h[0], 'L%d' % h[1], h[2], '|', h[3])
    print('[residue] unexpected hits:', len(bad))
    return not bad

MUST_EDGES = [('01-login.html', '02b-onboarding-profile.html'), ('01-login.html', '03-home.html'),
              ('02b-onboarding-profile.html', '01-login.html'), ('02b-onboarding-profile.html', '03-home.html'),
              ('02b-onboarding-profile.html', '05-contract.html'),
              ('03-home.html', '04-create-team-step1.html'), ('03-home.html', '05-contract.html'),
              ('04-create-team-step1.html', '04-create-team-step2.html'), ('04-create-team-step2.html', '06-set-goal.html'),
              ('06-set-goal.html', '04-create-team-step2.html'), ('06-set-goal.html', '05-contract.html'),
              ('06-set-goal.html', '07-team-home.html'), ('05-contract.html', '06-set-goal.html'),
              ('07-team-home.html', '10-leaderboard.html'), ('09-settle-fail.html', '04-create-team-step1.html')]
EXPECT_UNREACHABLE = {'09-settle-success.html'}  # v0.4 起就没有页面链到它（只从总览进入），不在本次范围

def flow():
    names = [os.path.basename(r) for r in page_rels()]
    E = {n: set(m.group(1) for m in re.finditer(r'href="([0-9][^"#:/]*\.html)(?:#[^"]*)?"', rd('mockup/pages/' + n)))
         for n in names}
    ok = True
    for a, b in MUST_EDGES:
        if b not in E.get(a, ()):
            print('[flow] MISSING EDGE', a, '->', b); ok = False
    s2 = rd('mockup/pages/04-create-team-step2.html')
    if 'href="06-set-goal.html#captain"' not in s2:
        print('[flow] 04-step2 主按钮应指向 06-set-goal.html#captain'); ok = False
    seen, q = {'01-login.html'}, collections.deque(['01-login.html'])
    while q:
        for b in E.get(q.popleft(), ()):
            if b in E and b not in seen:
                seen.add(b); q.append(b)
    unreached = set(names) - seen
    print('[flow] unreachable from 01:', sorted(unreached) or 'none')
    if unreached != EXPECT_UNREACHABLE:
        print('[flow] expected unreachable only', sorted(EXPECT_UNREACHABLE)); ok = False
    idx = rd('mockup/index.html')
    cards = re.findall(r'class="g-card"[^>]*href="pages/([^"]+)"', idx)
    missing = [n for n in names if n not in cards]
    extra = [c for c in cards if c not in names]
    dup = sorted(set(c for c in cards if cards.count(c) > 1))
    print('[flow] pages=%d index cards=%d missing=%s extra=%s dup=%s' % (len(names), len(cards), missing or 'none', extra or 'none', dup or 'none'))
    if len(names) != 21 or missing or extra or dup:
        ok = False
    if '#m12' in idx or 'id="m12"' in idx:
        print('[flow] index.html 仍有第 12 组'); ok = False
    return ok

FROZEN = {
    'docs/01-PRD-MVP.md': ['| **400** |', '**500** + 铁血战队徽章', '0.3 × 200 = 60', '140 + 200 = 340', '每人分 100，系统回收 40',
                           '14 天 100 ｜ 21 天 150 ｜ 30 天 200 ｜ 60 天 400', '0.5 / 0.75 / 1.1 / 2.1', '+1000 活力值',
                           '每人 100 / 200 / 500 / 1000 活力值', '| T-05 | 人数 | 3–10 人 |', '差额 ≥ 0.5×R'],
    'mockup/SHARED-SPEC.md': ['奖池 **340**', '= **400**', '**1,858**', '返还 **60**', '**1,096**', '**850**', '= **500**',
                              '总 1,658 / 可用 1,458 / 冻结 200 / 累计获得 1,658',
                              '阿杰 2,480 / Mia 1,920 / 小王 1,658 / Lily 1,236 / 大刘 1,050 / 老陈 980 / 芳芳 860',
                              '14 天 100 · 21 天 150 · 30 天 200 · 60 天 400', '0.5 / 0.75 / 1.1 / 2.1 kg',
                              '下限 1.1kg（-1.5%）/ 上限 4.3kg（-6.0%）', '新人积分 **1000**'],
    'docs/03-Mockup提示词.md': ['可用 1,458 / 冻结中 200 / 累计获得 1,658', '退回 200 + 系统奖励 200 + 全员加成 100 = 500',
                                '+400', '1,858', '1,096', '当前 1,000，发起后冻结 200', '满员押注总额 1000'],
    'docs/02-整体解决方案.md': ['1000（一次性）', '每期 0–300（S = 200 时）', '+200 / 有效邀请', '每月约 420', '≈ 4.2 元'],
    'mockup/pages/11-points.html': ['<div class="num">1,458</div>', '<div class="num">200</div>', '<div class="num">1,658</div>', '>1,658</div>'],
    'mockup/pages/10-leaderboard.html': ['2,480', '1,920', '1,658', '1,236', '1,050', '980', '860', '262'],
    'mockup/pages/06-set-goal.html': ['1,000', '冻结 <b class="num c-brand">200</b>', '1000 积分', '200 积分'],
}
UNCHANGED = ['mockup/assets/style.css', 'mockup/assets/mock.js', 'mockup/pages/08-checkin-daily.html',
             'mockup/pages/08-checkin-end.html', 'mockup/pages/08-checkin-start.html', 'mockup/pages/09-settle-fail.html',
             'mockup/pages/09-settle-partial.html', 'mockup/pages/09-settle-success.html', 'mockup/pages/13-me.html',
             'mockup/pages/14a-poster-weekly.html', 'mockup/pages/14b-poster-success.html',
             'mockup/pages/14c-poster-fail.html', 'mockup/pages/14d-poster-invite.html']
HISTORY = {  # 历史版本记录行必须原样还在（v0.1–v0.4）
    'docs/01-PRD-MVP.md': ['### v0.2 变更明细', '### v0.3 变更明细', '### v0.4 变更明细', '**已定口径（v0.2 补充）**'],
}

def frozen():
    ok = True
    for rel, keys in FROZEN.items():
        t = rd(rel)
        for k in keys:
            if k not in t:
                print('[frozen] MISSING', rel, '→', k); ok = False
    for rel in UNCHANGED:
        if rd(rel) != open(os.path.join(BK, rel), encoding='utf-8').read():
            print('[frozen] CHANGED (should be untouched):', rel); ok = False
    for rel in DOCS:  # v0.1–v0.4 版本记录行逐行保留
        old = open(os.path.join(BK, rel), encoding='utf-8').read()
        cur = rd(rel)
        for line in old.split('\n'):
            if re.match(r'\| v0\.[1-4] \|', line) and line not in cur:
                print('[frozen] HISTORY ROW CHANGED', rel, line[:60]); ok = False
        i = old.find('\n### v0.2 变更明细')
        if i != -1 and old[i:] not in cur:
            print('[frozen] PRD v0.2–v0.4 变更明细被改动'); ok = False
    print('[frozen] ok' if ok else '[frozen] FAILED')
    return ok

def newnums():
    num = re.compile(r'\d[\d,]*(?:\.\d+)?')
    for rel in DOCS + page_rels() + ['mockup/index.html']:
        b = os.path.join(BK, rel)
        if not os.path.exists(b):
            continue
        new = sorted(set(num.findall(rd(rel))) - set(num.findall(open(b, encoding='utf-8').read())))
        if new:
            print('[newnums]', rel, new)
    print('[newnums] 预期只出现：420、4.2、21（文件数）、06 页的 1,000 / 1000 等从原第 3 步搬来的数；其他新数字要逐个解释')
    return True

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    fns = {'links': links, 'residue': residue, 'flow': flow, 'frozen': frozen, 'newnums': newnums}
    run = list(fns) if cmd == 'all' else [cmd]
    results = [fns[c]() for c in run]
    sys.exit(0 if all(results) else 1)
```

运行：`cd "/Users/cn-charlesyang/AI Native/02 life/FitSquad" && python3 docs/.agents/tasks/v05_check.py all`。
全部做完后的期望：`links` 输出 none，`residue` 输出 unexpected hits: 0，`flow` 显示 pages=21 / index cards=21、unreachable 只有 09-settle-success，`frozen` 输出 ok，`newnums` 只出现预期内的数字，退出码 0。
中间步骤只跑跟本步相关的子命令（每步写明）。还没改到的文件引起的失败，属于预期。

### 2.2 目测（headless Chrome 截图 → 用读图工具查看）

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE="file:///Users/cn-charlesyang/AI%20Native/02%20life/FitSquad/mockup"
"$CH" --headless=new --disable-gpu --hide-scrollbars --window-size=1300,1100 --screenshot=/tmp/fs-06.png "$BASE/pages/06-set-goal.html#captain"
```
看完把 `/tmp/fs-*.png` 删掉。

---

# Implementation Plan

- [ ] 1. **创建校验脚本并跑一次基线。**
      按 2.1 原样写入 `docs/.agents/tasks/v05_check.py`。
      Files: docs/.agents/tasks/v05_check.py
      Verify: `python3 docs/.agents/tasks/v05_check.py frozen` 的基线输出（规划阶段已实测）只有 5 条 MISSING：02 的「每月约 420」「≈ 4.2 元」，以及 06 页的「1,000」「冻结 <b class="num c-brand">200</b>」「1000 积分」，这些都是后面步骤才加的内容。不能出现 CHANGED 或 HISTORY 报错。`links` 会列出 01 / 02b / 03 / 04-step2 / 11 / 12 / index 指向归档页的链接，`flow` 显示 pages=26，`residue` 有 135 条 UNEXPECTED，说明脚本能跑。

- [ ] 2. **归档 5 个页面 + 5 张截图，更新 `_archived/README.md`。**
      `mv` 这 5 个页面到 `mockup/_archived/`：
      - `mockup/pages/12-knowledge-list.html`
      - `12-knowledge-detail.html`
      - `02a-onboarding-intro.html`
      - `02c-onboarding-points.html`
      - `04-create-team-step3.html`

      对应的 5 张 png 从 `mockup/screenshots/` `mv` 到 `mockup/_archived/screenshots/`。两个目录都已存在，先 `ls` 确认一下。文件本身不改。

      README 改法：
      - 标题不变。
      - 现有内容整体放到 `## v0.4 归档（积分商城）` 小标题下，原文不动。
      - 在它上面新增 `## v0.5 归档（精简：只留差异化）`，表格 5 行，写清文件、原页面、归档原因：
        - 12-knowledge-list / 12-knowledge-detail：健康知识在 Keep、薄荷、小红书上又多又好，做了也不差异化；还要内容官每天产出 + 人工审核，成本高。
        - 02a-onboarding-intro：新手引导 3 屏不让人较劲，也不拉新，玩法交给契约页 05 讲。
        - 02c-onboarding-points：领 1000 积分并进身体档案 02b，改成提交后弹层提示。
        - 04-create-team-step3：创建战队从 3 步压成 2 步，原第 3 步并进 06 的「队长发起」状态。
      - 再写一行截图说明：`screenshots/` 下这 5 张是上面 5 页的截图。
      - **恢复方法**：
        - 把 html 挪回 `mockup/pages/`、png 挪回 `mockup/screenshots/`；
        - 恢复入口：01 登录 → 02a、02b 返回 → 02a、02b 完成 → 02c、04-step2 → step3（步骤条恢复 3 步）、03 首页健康小知识卡片（状态 A / B）、11 积分中心「阅读健康知识」任务、index.html 第 2 / 4 / 12 组卡片；
        - 对应的文档原文看 v0.4 快照 `.backup/v0.4-2026-10-19/`（PRD 4.10、03 文档 3.2 / 3.4 / 3.12、SHARED-SPEC 第 7 节），或各文档的 v0.4 版本。
      - 注明「页面内链接按原 `pages/` 目录写，放在这里打开会断样式和跳转」。

      Files: mockup/_archived/*.html（新增 5 个）, mockup/_archived/screenshots/*.png（新增 5 张）, mockup/_archived/README.md
      Verify:
      - `ls "/Users/cn-charlesyang/AI Native/02 life/FitSquad/mockup/pages" | wc -l` = 21；
      - `ls ".../mockup/_archived"` 有 8 个 html + README；
      - `ls ".../mockup/_archived/screenshots"` 有 8 张 png；
      - `python3 docs/.agents/tasks/v05_check.py links` 现在会报 01 / 02b / 03 / 04-step2 / 11 / index 的断链（后面几步修）。

- [ ] 3. **入口流程：01-login、02b-onboarding-profile（B）。** 依赖第 2 步。
      **`mockup/pages/01-login.html`**
      - 第 109 行登录按钮 `href="02a-onboarding-intro.html"` 改为 `href="02b-onboarding-profile.html"`。
      - device-note 改成「首次授权成功进入身体档案（02b），老用户直接进首页；从邀请链接来的新用户填完档案回到契约页（05）；未勾选协议时点登录，勾选框抖动并提示“先勾协议，再上秤”。」

      **`mockup/pages/02b-onboarding-profile.html`**
      - `<title>` → `02b 身体档案（新人） · FitSquad 瘦身战队 Mockup`；h1 → `02b · 身体档案（新人）`。
      - header `<p>` → 「身高 / 体重 / 性别 / 出生年份，自动算 BMI；单独勾选同意处理健康数据 + 不适宜人群自查；提交即到账 1000 活力值，回首页（邀请进来的回契约页）」。
      - `nav-back` 的 `href="02a-onboarding-intro.html"` 改为 `href="01-login.html"`。
      - `.mk-switch` 末尾追加两个按钮：
        - `<button data-set-state="done" data-target="#profile">提交成功</button>`
        - `<button data-set-state="invite" data-target="#profile">提交成功·邀请进来</button>`
      - 正常状态下应该显示的 `data-when` 都追加 ` done invite`，否则提交态下表单会消失：
        - 体重 72.0 输入框（`ok minor unfit`）
        - 出生年份 1993（`ok low unfit`）
        - BMI「正常」tag、23.5 数字、bmi-pin（三处都是 `ok minor unfit`）
        - 「孕期」未勾选行、「以上都没有」已勾选行（都是 `ok low minor`）

        只在 low / minor / unfit 下显示的元素不动。
      - 两条 notice 去掉健康知识：
        - minor → 「未满 18 岁不能参加押注挑战，可以先参加 0 押注友谊赛和日常打卡」；
        - unfit → 「你勾选了不适宜情况：可以参加打卡，但不能押注、不能设减重目标，建议先咨询医生」。
      - 底部按钮改为 `<a class="btn btn-primary btn-block" href="03-home.html">完成，领 1000 活力值</a>`。**不要加 data-toast**（决策 5）。
      - 在 `.bottom-bar` 后面、`</div>`（.phone 结束）前插入小弹层：

        ```html
        <div class="mask is-hidden" data-when="done invite"></div>
        <div class="dialog is-hidden" data-when="done invite">
          <div style="font-size:44px;line-height:1">🎉</div>
          <div class="t-num c-brand mt-8">+1000</div>
          <div class="t-h3 bold c-title mt-4">活力值到账，别让它闲着</div>
          <p class="t-caption c-muted mt-8">押注组队，全员达成拿最多 · 积分仅限平台内使用，不可兑现、不可转让</p>
          <a class="btn btn-primary btn-block mt-16" href="03-home.html" data-when="done">去首页组队</a>
          <a class="btn btn-primary btn-block mt-16 is-hidden" href="05-contract.html" data-when="invite">回到契约，继续上车</a>
        </div>
        ```
      - device-note 改为：「健康数据同意为单独勾选、不能默认勾选（演示为用户已勾），未勾选无法完成；不适宜人群必须勾一项（含“以上都没有”）。提交后弹出“+1000 活力值到账”小弹层，再进首页（03）；从邀请链接进来的用户回到契约页（05）。不做玩法引导页，玩法由契约页讲清。BMI &lt; 18.5、未满 18 岁、不适宜人群、两种提交成功态见切换器。」

      Files: mockup/pages/01-login.html, mockup/pages/02b-onboarding-profile.html
      Verify:
      - `python3 docs/.agents/tasks/v05_check.py links`：01 / 02b 不再出现在断链列表里。
      - 截图 02b（`--window-size=600,1100`）：默认态表单完整。
      - 临时把 `data-state="ok"` 改成 `done` 截一张，确认弹层居中、表单在遮罩下仍然完整。截完把 `data-state` 改回 `ok`。

- [ ] 4. **首页 03-home（A + D）。** 依赖第 2 步。
      - 删除私有样式 `.kn-card`、`.kn-cover`、`.kn-cover--green`、`.kn-cover--warn`、`.kn-body`、`.kn-body .t-h3` 这几条（第 18–22 行）。
      - 状态 A：删除 `<!-- 5. 健康小知识 -->` 注释 + `.section-head` + `.hscroll` 整块（第 169–188 行）。删完后 `.page` 的最后一个元素就是 `.stack`，里面最后是「排行榜 / 积分中心」两张 quick 卡。不要留空 div。
      - 状态 B：
        - 删除第二个 `<!-- 5. 健康小知识 -->` 整块（第 310–330 行）；
        - 「看看别人怎么玩」的 `.section-head` 删掉 `<a class="more" href="10-leaderboard.html">战队榜 ›</a>`，只留 `<h3>`。两张示例卡（陈家四口 -4.1%、周末不吃火锅联盟 +500）原样保留，它们是营销示例，不是排行榜。
      - device-note 不用改（里面没有知识相关文字）。

      Files: mockup/pages/03-home.html
      Verify:
      - `python3 docs/.agents/tasks/v05_check.py links`：03 不再断链；
      - `python3 docs/.agents/tasks/v05_check.py residue` 对 03-home 0 命中；
      - 截图 `--window-size=1000,1100`：A、B 两个手机框底部自然收口，tab 栏上方没有空白卡片或孤立标题。

- [ ] 5. **创建战队 2 步 + 06 队长发起状态（C、F）。** 依赖第 2 步。
      **`mockup/pages/04-create-team-step1.html`**
      - header `<p>` → 「队名、类型（公司 / 家庭 / 好友）；选公司可填公司名；队徽有默认值可改，口号选填（折叠）」。
      - 步骤条改两步：`<span class="step is-active"><b>1</b>基本信息</span><span class="step-line"></span><span class="step"><b>2</b>规则契约</span>`（删掉最后的 step-line 和第 3 步）。
      - 第一张卡（队名 / 类型 / 公司名）保留原样。在它的公司名提示 `<p>` 后面追加：

        ```html
        <div class="divider"></div>
        <div class="row-between">
          <div class="row gap-8"><span class="emoji-tile" style="width:36px;height:36px;font-size:20px;border-radius:10px">🔥</span><span class="t-body c-title">队徽</span></div>
          <a class="link t-caption" href="#" data-toast="6 个预设队徽任选：🔥 💪 🏃 🥗 ⚡ 🏆，不选就用 🔥">换一个 ›</a>
        </div>
        <div class="divider"></div>
        <div class="row-between">
          <span class="t-body c-title">战队口号（选填）</span>
          <a class="link t-caption" href="#" data-toast="口号喊得越响，掉队时越尴尬，慎重 😏">少吃一口，多赢一份 ›</a>
        </div>
        ```
      - 删除第二张卡（6 宫格队徽 + 口号输入框）。
      - 删除私有样式里的 `.badge-grid`、`.badge-grid .emoji-tile`、`.badge-grid .emoji-tile.is-selected`。
      - device-note 末尾追加「队徽默认 🔥，点“换一个”从 6 个预设里挑；口号收起成一行，选填。」
      - 底部按钮不变（→ 04-step2）。

      **`mockup/pages/04-create-team-step2.html`**
      - 步骤条改两步：`<span class="step is-done"><b>✓</b>基本信息</span><span class="step-line"></span><span class="step is-active"><b>2</b>规则契约</span>`。
      - 底部按钮改为 `href="06-set-goal.html#captain"`，文案保持「下一步：立个小目标」。
      - device-note 里「已在 2 支战队中时提示“同时最多参加 2 支战队，别把自己卷坏了”」改为「已在一支进行中或待开赛的战队里时提示“你已经在一支战队里了，这期结束再来 😎”」。末尾追加「下一步进入设定目标页（06）的“队长发起”状态，预览契约后发起」。
      - 其余内容（周期、押注、人数、开赛说明、结算规则、线下趣味惩罚）不动。

      **`mockup/pages/06-set-goal.html`**（单个手机框，多状态）
      - header `<p>` → 「两种进入方式：被邀请人从契约页（05）加入；队长从创建战队第 2 步进入“队长发起”状态，预览契约并发起 · 下限 1.1kg / 健康上限 4.3kg 系统强制 · 拖动滑杆可试试超限回弹」。
      - device-label 改成「设定目标 <span class="tag tag--brand">小王 · 30 天 · 72.0 kg</span>」。
      - 在 device-label 后加切换器：

        ```html
        <div class="mk-switch">
          <button class="is-active" data-set-state="join" data-target="#goalPhone">被邀请人加入</button>
          <button data-set-state="captain" data-target="#goalPhone">队长发起</button>
        </div>
        ```
      - `<div class="phone" id="goalPhone">` 加 `data-state="join"`。
      - `nav-back` 拆成两个：
        - `<a class="nav-back" href="05-contract.html" data-when="join"></a>`
        - `<a class="nav-back is-hidden" href="04-create-team-step2.html" data-when="captain"></a>`
      - 现有「加入的战队」`card card--soft join-bar`（第 5 位）加 `data-when="join"`。紧接着加队长版：

        ```html
        <div class="card card--soft join-bar is-hidden" data-when="captain">
          <span class="emoji-tile">🔥</span>
          <div class="flex-1"><div class="t-body bold c-title">鹅厂 3 楼减脂突击队</div><div class="t-label c-muted">最后一步：定好你自己的目标，就能发起契约</div></div>
          <span class="tag tag--brand">队长</span>
        </div>
        ```
        **不加步骤条**（决策 1）。
      - 在「5. 目标预览」卡之后、「6. 免责勾选」之前插入两块，都带 `class="… is-hidden" data-when="captain"`。内容从已归档的 `mockup/_archived/04-create-team-step3.html` 原样照搬：
        - 契约预览卡（`card card--outline-brand`）：🔥 鹅厂 3 楼减脂突击队 + 「契约预览」tag；preview-row 依次为 类型 公司 / 周期 30 天 / 每人押注 200 积分 / 满员押注总额（5 人）1000 积分 / 我的目标 -3.0 kg（对外显示 -4.2%）/ 线下惩罚（选填）🍵 请全队喝无糖茶。
        - 「我的积分」行：`当前 <b class="num c-title">1,000</b>，发起后冻结 <b class="num c-brand">200</b>`。
      - 同时把原第 3 步的私有样式 `.preview-row`、`.preview-row + .preview-row`、`.preview-row span:first-child`、`.preview-row span:last-child` 四条复制进 06 的 `<style>`。
      - 「6. 免责勾选」卡：
        - 现有卡加 `data-when="join"`；
        - 新增一张 `class="card is-hidden" data-when="captain"`：check-row 文案「我已阅读结算规则与<a class="link" href="#" data-toast="《健康免责声明》示意">《健康免责声明》</a>」，下面 `t-label c-muted`：「孕期 / 哺乳期、有进食障碍史、有基础疾病者不建议参加押注挑战」。
      - bottom-bar：
        - 现有按钮（→ 07「就这么定了，冻结 200 积分」）加 `data-when="join"`；
        - 新增 `<a class="btn btn-primary btn-block is-hidden" href="05-contract.html" data-when="captain">确认契约并邀请队友</a>`；
        - disclaimer 两态共用，不加 data-when。
      - 页私有 `<script>` 的 IIFE 后追加：

        ```js
        document.addEventListener('DOMContentLoaded', function () {
          if (location.hash === '#captain') {
            var b = document.querySelector('.mk-switch [data-set-state="captain"]');
            if (b) b.click();
          }
        });
        ```
        这段写在 mock.js 之后注册，执行顺序也在它之后。
      - device-note 改为：「两种状态共用同一个目标滑杆：被邀请人加入（从 05 来）确定后冻结押注并进入战队主页（07）；队长发起（从创建战队第 2 步来，地址带 #captain 时直接显示）多一张契约预览和押注免责勾选，“确认契约并邀请队友”后跳契约页（05）并弹出分享面板。创建战队只有 2 步，这里不显示步骤条。滑杆斜纹区为超出健康上限，拖过上限会回弹并提示。」

      Files: mockup/pages/04-create-team-step1.html, mockup/pages/04-create-team-step2.html, mockup/pages/06-set-goal.html
      Verify:
      - `python3 docs/.agents/tasks/v05_check.py links` 中 04 / 06 无断链；
      - `python3 docs/.agents/tasks/v05_check.py flow` 中 04-step2 → 06#captain、06 → 05 / 07 / 04-step2 都存在（其他缺边等后续步骤）；
      - 截图 `06-set-goal.html`（join）和 `06-set-goal.html#captain`：join 态与改前一致；captain 态顶部是队长战队条、没有步骤条，有契约预览、「当前 1,000，发起后冻结 200」、押注免责、「确认契约并邀请队友」；
      - 截图 04-step1：只剩一张卡，步骤条两步。

- [ ] 6. **05 / 07 / 10 / 11 页面清理（D、E、F、A）。** 依赖第 2 步。
      **`mockup/pages/05-contract.html`**：device-note 里「未满 18 岁 / 信用分 &lt; 60 / 已在 2 支战队中时按钮置灰」改为「未满 18 岁 / 信用分 &lt; 60 时按钮置灰“暂时不能参加押注挑战”；已在一支战队里时按钮置灰“已在一支战队里，这期结束再来”」。其他不动。

      **`mockup/pages/07-team-home.html`**
      - 第 110 行 `<a class="more" href="10-leaderboard.html">全站排行 ›</a>` 改为 `好友榜 ›`。
      - 删除战队动态里第一张 `card card--tint feed-item`「⚡ 中期加码任务 · 限今天 · 全队今天都满 1 万步…」整张卡（第 180–183 行）。动态流从阿杰那条开始。

      **`mockup/pages/10-leaderboard.html`**（只留好友榜）
      - header `<p>` → 「一级页 · 只有好友榜：你邀请的人、邀请你的人、曾同队的人，按活力值排名 · 只显示积分与百分比，不显示公斤」。
      - `<div class="phone" id="lb" data-state="friend">` 改为 `<div class="phone">`。
      - 删除 `.segmented segmented--on-brand` 整块（3 个 seg）。
      - 删除 `data-when="team"` 的 `lb-filter`。`data-when="person friend"` 的 `lb-filter` 改为只含 `<span class="lb-hint">好友榜 · 按活力值排名</span>`，去掉 3 个时间 chip 和 data-when（决策 2）。
      - 删除 `data-when="team"`、`data-when="person"` 两个 podium。好友榜 podium 去掉 `data-when="friend"`，内容不动。
      - 删除 `.page` 里 `data-when="team"`（含「我的战队 · 进行中」置顶行 + 4/5/6 名 + 说明）和 `data-when="person"` 两个 div。好友榜 div 去掉 `data-when`，内容（称号 notice、4–7 名、邀请卡、disclaimer）不动。
      - 吸底：删除 `data-when="team"`、`data-when="person"` 两个 `.my-rank`。好友的 `.my-rank` 去掉 data-when（第 3 名 · 1,658 · 差 262 · 去追她）。
      - 私有样式删除不再使用的规则：
        - `.lb-filter .chip`、`.lb-filter .chip.is-selected`
        - `.pd .name.is-2line`
        - `.pd .emoji-tile`、`.pd--1 .emoji-tile`
        - `.lb-list .emoji-tile`
        - `.my-rank .emoji-tile`

        `.lb-filter .lb-hint` 的 `margin-left: auto` 改成 `margin-left: 0`。
      - device-note 改为：「排行页只有好友榜（你邀请的人、邀请你的人、曾同队的人），按活力值排名；队内排行在战队主页（07）。种子期只有 3–5 支队，不做跨队的大榜，公司榜等企业版。点头像只看对方公开主页（积分、徽章、百分比）。周称号每周一按打卡、步数、互动自动颁发，与战队主页一致；这里只显示 4 个正向称号（卷王 / 打卡钉子户 / 步数刺客 / 气氛组组长），嘴硬王者、摸鱼选手只在战队主页队内可见。」（这段文字已避开残留关键词，照抄即可。）
      - tabbar 不动。

      **`mockup/pages/11-points.html`**
      - 删除「赚活力值任务」列表里的「📖 阅读健康知识 · +1 · 去阅读」整个 `list-item`（第 99–104 行）。
      - device-note「任务按钮跳转打卡、健康知识、邀请海报。」改为「任务按钮跳转打卡、邀请海报。」
      - 积分卡数字不动。

      Files: mockup/pages/05-contract.html, mockup/pages/07-team-home.html, mockup/pages/10-leaderboard.html, mockup/pages/11-points.html
      Verify:
      - `python3 docs/.agents/tasks/v05_check.py links` 中这 4 页无断链；
      - `python3 docs/.agents/tasks/v05_check.py residue` 对 `pages/*.html` 0 命中；
      - `python3 docs/.agents/tasks/v05_check.py frozen` 中 10 / 11 的数字都在；
      - 截图 10：渐变头部是提示 + 领奖台（阿杰 / Mia / 小王），列表 4–7 名，吸底「第 3 名 · 1,658」，没有分段控件；
      - 截图 07：动态流第一条是阿杰。

- [ ] 7. **更新 `mockup/index.html`。** 依赖第 2–6 步。
      - `<title>` 和 h1 的 `v0.4` → `v0.5`。
      - hero `<p>` 开头改为：「按用户流程排列的全部页面，共 21 个文件。v0.5「精简」：只留让熟人较劲、帮忙拉新人的东西，健康知识（12 列表 / 详情）、新手引导 3 屏（02a）、领 1000 积分页（02c，合并进身体档案）、创建战队第 3 步（04-step3，并入设定目标页的“队长发起”状态）5 页归档到 <code>_archived/</code>；排行只留好友榜；删中期加码；每人同时只能参加 1 支战队。」后面接原有的 v0.4 / v0.3 / v0.2 几句，原样保留，「缩略图为实时渲染…」也保留。
      - legend：删除 `<a class="tag" href="#m12">12 健康知识</a>`；`2 新手引导` 改为 `2 身体档案`。
      - 第 2 组：
        - h2 文字 `新手引导` → `身体档案`；
        - 删除 02a、02c 两张卡；
        - 02b 卡的 iframe title 改为「身体档案」，g-name 改为「身体档案 · 提交即到账 1000 活力值」。
      - 第 4 组：
        - 删除 step3 卡；
        - step1 g-name →「创建战队 · 第 1 步 基本信息（队名 / 类型）」；
        - step2 g-name →「创建战队 · 第 2 步 规则契约 → 设定目标」。
      - 第 6 组 g-name →「设定个人目标 · 被邀请人加入 / 队长发起」。
      - 第 10 组 g-name →「排行榜 · 好友榜」。
      - 删除整个 `<section class="g-section" id="m12">…</section>`。
      - 其他分组、样式、页脚原样不动。

      Files: mockup/index.html
      Verify: `python3 docs/.agents/tasks/v05_check.py links` → none；`python3 docs/.agents/tasks/v05_check.py flow` → pages=21 / index cards=21、missing / extra / dup 全是 none、unreachable 只有 09-settle-success、无缺边；截图 `index.html`（`--window-size=1440,2200`）：legend 没有 12，第 2 组只有 1 张卡。

- [ ] 8. **更新 `mockup/SHARED-SPEC.md` 到 v0.5。** 依赖第 2–7 步（文件清单要和实际文件一致）。
      - 标题 `· v0.4` → `· v0.5`。
      - **第 5 节**
        - 押注那行：「每人最多同时 2 支战队」改为「每人同时只能参加 1 支进行中或待开赛的战队（已在队里时提示“你已经在一支战队里了，这期结束再来 😎”）」。
        - 打卡积分那行删掉「阅读 +1、」，变为「称重 +5、步数 ≥ 8000 +5、连续 7 天 +30、邀请新人并完成首期 +200（每月最多 10 人）」。
        - 排行那行改为「排行：排行页（10）只有好友榜，按活力值排名（好友 = 你邀请的人、邀请你的人、曾同队的人）；队内排行在战队主页（07）按减重百分比。公司榜等企业版（PRD R-05）。」
        - 免责那行改为「免责：登录页、身体档案、契约落地页、设定目标页（含队长发起状态）、打卡页、我的页必须有《健康免责声明》或 “本产品不提供医疗建议，有基础疾病请先咨询医生”。」（决策 10）
        - 新人积分那行后补一句「身体档案提交后弹层提示“+1000 活力值到账”」。
      - **第 6 节**
        - 本周称号行：「排行榜只显示前 4 个正向称号」→「好友榜只显示前 4 个正向称号」。
        - 战队榜那行整行替换为「示例战队（营销示例 / 历史战队，不参与任何排名）：周末不吃火锅联盟（小王上一期的好友队，5 人 30 天全员达成、平均 -4.4%，用于 03 状态 B 示例卡、09-settle-success、11 流水）；陈家四口减脂局（老陈带队的家庭队，30 天平均 -4.1%，用于 03 状态 B 示例卡）。」（决策 9）
        - 时间线规则：进行中那条 `10（好友榜 / 个人榜 / 战队榜置顶行）` → `10（好友榜）`；删除「战队榜只收已结算战队；进行中的战队只能以…」整条。
        - 积分中心行末括号改为「（MVP 无兑换出口；累计获得不含押注退回，押注冻结 / 退回只是流转，小王也没输过押注，所以累计获得 = 总额 1,658）」（G，和 PRD P-01 一致）。数字不动。
      - **第 7 节表格**
        - 01 行：「登录 → 02a」→「登录 → 02b」。
        - 删除 02a、02c 两行。
        - 02b 行：页面「身体档案（新人）」，主要跳转「完成 → 03（弹层“+1000 活力值到账”；从邀请链接进来 → 05）」。
        - 04-step2 行：主要跳转「→ 06（队长发起）」。
        - 删除 04-step3 行。
        - 06 行：页面「设定个人目标（被邀请人加入 / 队长发起）」，主要跳转「加入：确定 → 07；队长发起：确认 → 05」。
        - 10 行：页面「排行榜 · 好友榜」。
        - 11 行：主要跳转「任务 → 08 / 14d」。
        - 删除两行 12。
        - 表下 v0.4 说明后加一句：「v0.5：原 02a / 02c / 04-create-team-step3 / 12-knowledge-list / 12-knowledge-detail 五页已归档到 `mockup/_archived/`，`pages/` 现有 21 个文件；创建战队只有 2 步，06 用 `data-state` 切换“被邀请人加入 / 队长发起”（地址带 `#captain` 直接进队长态，不显示步骤条）。」
      - **第 8 节自检**加一条：「v0.5 起：`pages/*.html` 不能有指向 02a- / 02c- / 04-create-team-step3 / 12-knowledge- 的链接，也不能出现健康知识、新手引导、战队榜 / 个人榜、中期加码、“2 支战队”。」这一行用「v0.5 起：」开头，残留扫描会放行。
      - **版本记录**加：`| v0.5 | 2026-10-19 | 精简，只留差异化：删健康知识（第 5 节阅读 +1、免责清单去掉知识详情；第 7 节删 12 两页）；删新手引导并把领 1000 积分合并进身体档案（删 02a / 02c）；创建战队 2 步（删 04-step3，06 新增队长发起状态）；排行只留好友榜（删战队榜假数据与时间线里的榜单规则，第 6 节改为示例战队）；删中期加码；每人同时只能参加 1 支战队；累计获得补“不含押注退回”说明；五页归档至 _archived/，结算 500 / 400 / 60 与小王 1,658 / 1,458 / 200 不变 |`。

      Files: mockup/SHARED-SPEC.md
      Verify: `python3 docs/.agents/tasks/v05_check.py residue` 对 SHARED-SPEC 的 UNEXPECTED = 0，只放行「v0.5：」「v0.5 起：」两行；`python3 docs/.agents/tasks/v05_check.py frozen` 里 SHARED-SPEC 的冻结数字和 v0.1–v0.4 历史行都在。

- [ ] 9. **更新 `docs/01-PRD-MVP.md` 到 v0.5。** 02 / 03 都以它为准，先改它。
      - 标题 `（PRD v0.4）` → `（PRD v0.5）`；版本行 `v0.4` → `v0.5`，日期仍是 2026-10-19。

      **第 2 节**
      - V1.0 包含：「…自动结算；队内排行、全站战队榜、周称号、超越提醒；分享海报；健康小知识；简易后台。」改为「…自动结算；队内排行、好友榜、周称号、超越提醒；分享海报；简易后台。」
      - 暂不包含表：在充值积分行后新增一行 `| 健康知识（站内文章 / 首页每日一条） | 不做（v0.5 删除） | Keep、薄荷、小红书上的健康内容又多又好，做了也不构成差异化；还要内容官每天产出 + 人工审核，成本高。内容官改为只做站外增长内容 |`。
      - 2.1「MVP 已埋的桥梁」：「战队类型"公司"+ 公司名（T-13）、同事组队场景、战队榜。」改为「战队类型"公司"+ 公司名（T-13）、同事组队场景；公司榜 / 全站战队榜留到企业版（R-05）。」

      **第 3 节流程图**
      - `D[获得新人 1000 活力值]` → `D[提交即到账 1000 活力值 弹层提示]`；
      - `H[创建战队: 类型/周期/押注或友谊赛]` → `H[创建战队 2 步: 基本信息 / 规则契约]`；
      - `J[设定自己的目标]` → `J[设定自己的目标 确认发起 冻结押注]`；
      - 其余节点、连线不动。
      - 代码块后加一行：「不做新手引导页：玩法由契约页（页面 5）讲清；从邀请链接进来的新用户，提交身体档案后直接回到契约页。」（含「不做新手引导页」，残留扫描放行。）

      **第 4.2 节**
      - 类型表来源「新人 1000、打卡、步数、阅读、邀请、结算所得」→ 删去「阅读、」。
      - P-01 →「活力值：可用、冻结（押注中）、累计获得（历史获得总和，不含押注退回；押注冻结 / 退回只是流转）」（G）。
      - P-07 整行换成 `| P-07 | 不重复计 | 打卡类积分（称重、步数、连续 7 天）按人计，每人每天只算一次；每人同时只能参加 1 支战队（T-14），不存在跨战队重复计分 |`（决策 3）。
      - 获取途径表删除「阅读每日健康知识 | +1 | 每天 1 次」行。

      **第 4.3 节**
      - T-01 →「2 步：① 基本信息——队名、类型（公司 / 家庭 / 好友）必填，类型为公司时公司名选填（T-13），队徽给默认值（预设可改），口号选填；② 规则契约（T-02 / T-03 / T-05 / T-16）；之后进入设定个人目标（页面 6 的队长发起状态）确认发起」。
      - T-14 →「每人同时只能参加 1 支进行中或待开赛的战队；当前战队结算或解散后才能加入 / 创建下一支」。

      **第 4.5 节**
      - 不变式三行替换为：

        ```
        **不变式**：任何情况下，达成者在全员达成时拿到的积分都严格多于部分达成时，差额 ≥ 0.5×R（每人同时只能参加 1 支战队，见 T-14，系统奖励不打折）。
        友谊赛（0 押注）没有积分结算，不适用该不变式。
        推导：① − ② = (R + 0.5×S) − (min(奖池 ÷ 达成人数, 0.5×S) + 0.5×R) ≥ 0.5×R > 0。达成者不会因队友失败而多拿。
        ```
        删除「推导（重叠战队五折）」那一行。结算表、例子、时间线不动。

      **第 4.7 节**：删除「- 中期加码：过半时推队内小任务…」整条。

      **第 4.8 节**
      - 删除 R-02、R-03 两行（决策 4）。
      - R-04 →「排行页唯一内容：邀请关系 + 曾同队的人，按活力值排名」。
      - R-05 →「第二阶段（企业版，见 2.1）。全站或公司战队榜等企业版再做：种子期只有 3–5 支队，全站榜没有意义，和陌生人比也没有压力」。
      - R-06 里「排行榜（好友榜 / 个人榜）对非队友只显示 4 个正向称号」→「好友榜对非队友只显示 4 个正向称号」。
      - R-01、R-07 不动。

      **第 4.10 节**：整节删除，包括标题和段落；**4.11 / 4.13 不重编号**。

      **第 4.11 节**：删「文章管理；」。

      **第 5 节**：删「重复计分」行。

      **第 6 节页面清单**（不重编号）
      - 第 2 行 →「| 2 | 身体档案（新人） | 身体档案（健康数据单独同意、免责勾选）→ 提交即弹“+1000 活力值到账”→ 首页（邀请进来的回契约页）；不做玩法引导页，玩法由契约页讲清 |」
      - 第 3 行 →「超越提醒横幅、进行中战队、今日打卡、好友榜 / 积分入口、创建战队」
      - 第 4 行 →「| 4 | 创建战队（2 步） | 基本信息（队名、类型；公司名选填；队徽默认可改；口号选填折叠）→ 规则（周期、押注 / 友谊赛、人数、线下趣味惩罚选填）→ 进入设定个人目标（6，队长发起） |」
      - 第 5 行末尾加「；玩法说明由这里承担」
      - 第 6 行 →「两种状态：被邀请人加入 / 队长发起（契约预览、发起后冻结押注、押注免责勾选）；体重、目标滑块、健康上下限、预计每周减重」
      - 第 10 行 →「好友榜（领奖台 + 列表 + 我的名次），周称号标签（非队友只显示 4 个正向称号）」
      - 删除第 12 行。

      **第 7 节**：删除 `articles` 那一行。

      **第 10 节**：W5「结算、排行（含周称号、超越提醒）、海报、知识、后台」→ 删「知识、」。

      **第 11 节**
      - 版本记录加 `| v0.5 | 2026-10-19 | 精简，只留差异化（让熟人较劲 / 帮忙拉新人）：删健康知识；删新手引导并把领 1000 活力值合并进身体档案；创建战队 2 步；排行只留好友榜；删中期加码；每人同时只能参加 1 支战队（明细见文末） |`。
      - 文末（v0.4 明细之后）新增「### v0.5 变更明细」，逐条写：
        - 判断标准；
        - A 健康知识：删 4.10、后台文章管理、articles 表、阅读 +1、页面 12、首页每日知识；理由；暂不包含表新增一行；
        - B 新手引导：删 3 屏，领积分并入身体档案；流程图 D 节点；页面 2；
        - C 创建战队 2 步：T-01、页面 4 / 6；
        - D 排行：删 R-02 / R-03、改 R-04 / R-05 / R-06；V1.0 包含、2.1 桥梁；
        - E 中期加码：删 4.7 一条；理由：需要运营配置，种子期没人管；
        - F 1 支战队：T-14、P-07 改写，4.5 不变式只留单队，删第 5 节重复计分；
        - G P-01 补「累计获得不含押注退回」；
        - 编号：4.10、R-02 / R-03、页面 12 留空号，不重编号，以保住 4.13 / R-06 / R-07 等引用；v0.2 补充里的重叠战队原文属于历史，不改；
        - 不变：结算 500 / 400 / 60、奖池 340 / 回收 40、1,858 / 1,096 / 850、小王 1,658 / 1,458 / 200、押注档位、周期、人数、上下限、R、新人 1000。
      - v0.1–v0.4 行和明细一字不改。

      Files: docs/01-PRD-MVP.md
      Verify: `python3 docs/.agents/tasks/v05_check.py residue` 对 PRD 的 UNEXPECTED = 0，放行的只有暂不包含表的健康知识行、2.1 桥梁、R-05、流程图下的说明行；`python3 docs/.agents/tasks/v05_check.py frozen` 中 PRD 冻结数字、历史行、v0.2–v0.4 明细都在；`grep -n '^### 4\.' docs/01-PRD-MVP.md` 列出 4.1–4.9、4.11、4.13。

- [ ] 10. **更新 `docs/02-整体解决方案.md` 到 v0.5。** 依赖第 9 步。
      - 标题 `v0.4` → `v0.5`；配套行 `PRD v0.4` → `PRD v0.5`。
      - 第 1 节「结算」行：「（单队差额 ≥ 0.5×R；重叠战队五折时差额 ≥ 0.25×R）」→「（差额 ≥ 0.5×R）」。
      - 第 4 节「内容渠道」行末加「（都是站外内容，用来拉新）」。
      - 第 6 节 Agent 表：
        - 内容官 →「| 内容官 | 热点、画像、战报素材（脱敏） | 站外增长内容：小红书 / 抖音 / 视频号文案、海报文案（不再产出站内文章） | 每日 | 发布前审核 |」；
        - 活动官输出「活动方案、加码任务、积分建议」→「活动方案、节点挑战、积分建议」（决策 12）。
        - 表后「提示词文件已放在…」那句之后加一句：「v0.5 起站内不做健康知识（Keep / 薄荷 / 小红书上又多又好，不构成差异化，每天产出 + 审核成本也高），内容官只服务站外拉新；`ops/agents/content.md` 仍是旧口径，待同步。」
      - 第 7 节过程积分行 →「| 过程积分（称重 150 + 步数 150 + 连续 7 天 ≈ 120） | 每月约 420 | ≈ 4.2 元 / 人 / 月 |」（第 0 节唯一允许改的派生数字）。
      - 第 8 节：
        - 「达成者盼队友失败」→「奖池分成封顶 0.5×S，全员达成另加 0.5×S，全员达成永远严格多拿（差额 ≥ 0.5×R）」；
        - 「刷目标 / 小号送分」删去末尾「；重叠战队中 R 较低那支的系统奖励部分按 50% 发放」，句尾补「；每人同时只能参加 1 支战队」；
        - 「第 2–3 周流失」删「中期加码、」。
      - 版本记录加 `| v0.5 | 2026-10-19 | 精简，只留差异化：删健康知识（内容官只做站外增长内容；过程积分去掉阅读，每月约 450 → 420）；删新手引导并合并领积分、创建战队 2 步、排行只留好友榜（对齐 PRD v0.5）；删中期加码（风险表、活动官输出）；每人同时只能参加 1 支战队，结算与风险表删重叠战队五折 |`。

      Files: docs/02-整体解决方案.md
      Verify: `python3 docs/.agents/tasks/v05_check.py residue` 对 02 的 UNEXPECTED = 0；`python3 docs/.agents/tasks/v05_check.py frozen` 中 02 的「每月约 420」「≈ 4.2 元」等都在；`grep -n '4\.13' docs/02-整体解决方案.md` 仍有第 1 / 4 / 8 节三处引用。

- [ ] 11. **更新 `docs/03-Mockup提示词.md` 到 v0.5。** 依赖第 9 步。
      - 顶部版本行 → 「版本 v0.5 ｜ 本文数值与规则已与 `01-PRD-MVP.md`（PRD v0.5）对齐。文案语气与红线见第 6 节。」
      - 第 2 节：「好胜心玩法：…」那句末尾加「；排行页只有好友榜」。
      - 3.1 交互：「授权成功 → 首次进入新手引导，老用户直接进首页」→「授权成功 → 首次进入身体档案（3.2），老用户直接进首页；从邀请链接来的新用户填完档案回到契约页（3.5）」。
      - **3.2 整节重写**：标题「### 3.2 身体档案（新人）」，代码块标题「【FitSquad 瘦身战队 · 身体档案（新人）】」，风格行沿用原文。
        - 页面目标：「30 秒填完身体档案，提交即到账 1000 活力值；不做新手引导页（玩法由契约页 3.5 讲清）」。
        - 布局：沿用原「身体档案」段（身高、体重、性别、出生年份、自动 BMI，两个独立勾选框文字原样）。
        - 提交后：页面中央弹出小弹层「🎉 +1000 活力值到账」+ 副文「押注组队，全员达成拿最多 · 积分仅限平台内使用」+ 按钮「去首页组队」；从邀请链接进来时按钮为「回到契约，继续上车」→ 契约页。
        - 交互：未勾选健康数据同意时「完成」置灰。
        - 边缘态：BMI / 未满 18 岁两条原样保留。
        - 删除 3 屏引导全部内容。
      - **3.3**
        - 状态 A 删第 5 项「健康小知识横滑卡片 2 张…」；
        - 状态 B 删第 5 项「健康小知识横滑卡片」；
        - 状态 B 第 4 项末尾加「（营销示例卡，不是排行榜，不放榜单入口）」。
      - **3.4 重写**
        - 标题「### 3.4 创建战队（2 步）」，代码块标题「【FitSquad 瘦身战队 · 创建战队 2 步】」，「请输出 2 张画板」；步骤条「① 基本信息 ② 规则契约」。
        - 第 1 步：战队名称（原文）、类型三选一（原文，含公司名选填）、队徽一行「默认 🔥，右侧“换一个 ›”点开 6 个预设」、口号一行「战队口号（选填）」收起，右侧显示「少吃一口，多赢一份 ›」。
        - 第 2 步：原文不动，最后按钮「下一步：立个小目标」→ 进入 3.6 的「队长发起」状态。
        - 删除「第 3 步 · 我的目标」整块。
        - 交互：「第 2 步完成进入设定个人目标（3.6 B 队长发起）；在那里确认后跳契约详情页并弹出分享面板（微信好友 / 生成邀请海报）」。
        - 边缘态：「已在 2 支战队中 → 提示“同时最多参加 2 支战队”」→「已在一支进行中或待开赛的战队里 → 提示“你已经在一支战队里了，这期结束再来 😎”」。
      - **3.5** 边缘态「已在 2 支战队中：按钮置灰“同时最多参加 2 支战队”」→「已在一支战队里：按钮置灰“已在一支战队里，这期结束再来”」。
      - **3.6**
        - 开头说明后加「请输出 A 被邀请人加入、B 队长发起两张画板（同一组件，不显示步骤条）」。
        - 原布局作为 A，原文不动。
        - 新增「—— B 队长发起（从 3.4 第 2 步进入） ——」：
          - 顶部战队条「鹅厂 3 楼减脂突击队 · 最后一步：定好你自己的目标，就能发起契约」+「队长」标签；
          - 中间同 A（体重、滑杆、上下限卡、目标预览）；
          - 契约预览卡片（品牌渐变边框）：战队名、类型、30 天、每人押注 200、满员押注总额 1000；
          - 我的活力值「当前 1,000，发起后冻结 200」；
          - 勾选「我已阅读结算规则与《健康免责声明》；孕期/哺乳期、有进食障碍史、有基础疾病者不建议参加押注挑战」；
          - 主按钮「确认契约并邀请队友」→ 契约详情页 + 分享面板。
      - **3.7** 删「中期加码卡（过半时出现）：…」那一行。
      - **3.10 重写**
        - 页面目标「在好友圈内比拼，刺激好胜心；排行页只有好友榜一个榜单（队内排行在 3.7 战队主页）」。
        - 布局：
          1. 渐变头部一行提示「好友榜 · 按活力值排名」（不做分段控件和时间筛选）；
          2. 领奖台（原文：阿杰 2,480 / Mia 1,920 / 小王 1,658，称号标签原文）；
          3. 列表第 4 名起：4 Lily 1,236（🎉 气氛组组长）、5 大刘 1,050、6 老陈 980、7 芳芳 860（决策 15）；只对非队友显示正向称号那句保留；
          4. 邀请卡「拉更多好友上榜，一起卷 · 邀请新人并完成首期 +200 积分」；
          5. 吸底「第 3 名 · 1,658 · 距第 2 名还差 262」。
        - 删除原第 4 项（战队示例）。
        - 交互和边缘态保留原文（好友少于 3 人、还没有好友）。
      - **3.11** 第 4 项「（每天只算一次，参加 2 支战队也不重复）」→「（每天只算一次）」，删「“阅读健康知识 +1”」。
      - **3.12 整节删除**，包括标题和代码块；3.13 / 3.14 不重编号。
      - **第 5 节检查清单**
        - 免责项 →「登录页协议、身体档案、契约落地页、设定目标页（含队长发起状态）、打卡页、我的页均有…」（决策 10）。
        - 新人积分项「引导、首页、契约页、我的、邀请海报统一为 1000 积分」→「身体档案到账弹层、首页、契约页、我的、邀请海报统一为 1000 积分」。
        - 排行项 →「排行：排行页只有好友榜（按活力值），周称号对非队友只显示 4 个正向称号；队内排行按减重百分比。」
        - 打卡积分项删「阅读 +1、」。
        - 新增一项「[ ] v0.5 精简：没有健康知识页 / 卡片、没有新手引导页、创建战队只有 2 步（06 队长发起收尾）、没有中期加码、每人同时只能参加 1 支战队。」
      - 第 6 节文案库不改（决策 16）。
      - 版本记录加 `| v0.5 | 2026-10-19 | 对齐 PRD v0.5 精简：删 3.12 健康知识与 3.3 首页知识卡片；3.2 改为身体档案（新人）+ 提交即到账弹层，删 3 屏引导；3.4 创建战队 2 步，原第 3 步并入 3.6 B 队长发起；3.10 排行只留好友榜（删战队榜 / 个人榜与时间筛选）；3.7 删中期加码；3.4 / 3.5 改为每人同时只能参加 1 支战队；3.11 删阅读任务；检查清单同步（免责清单、排行、精简项） |`。

      Files: docs/03-Mockup提示词.md
      Verify: `python3 docs/.agents/tasks/v05_check.py residue` 对 03 的 UNEXPECTED = 0，只放行「v0.5 精简」「不做新手引导页」；`grep -n '^### 3\.' docs/03-Mockup提示词.md` 列出 3.1–3.11、3.13、3.14；`python3 docs/.agents/tasks/v05_check.py frozen` 中 03 的数字都在。

- [ ] 12. **全局交叉校验与收尾。** 依赖 1–11。
      - 跑 `python3 docs/.agents/tasks/v05_check.py all`，退出码 0；`newnums` 只出现预期内的数字。
      - 人工核对交叉引用（逐条打勾）：
        1. 页面清单四方一致：PRD 第 6 节（1–11、13、14）↔ SHARED-SPEC 第 7 节 ↔ index.html 分组 ↔ `ls mockup/pages`（21 个）。
        2. 创建战队「2 步」在 PRD T-01 / 第 6 节、03 文档 3.4、04-step1 / step2 步骤条里一致；06 不显示步骤条。
        3. 「1 支战队」在 PRD T-14 / P-07、SHARED-SPEC 第 5 节、03 文档 3.4 / 3.5、04-step2 / 05 device-note 里一致，文案统一用决策 8。
        4. 不变式只剩「差额 ≥ 0.5×R」：PRD 4.5、02 第 1 / 8 节。
        5. 免责清单：SHARED-SPEC 第 5 节和 03 第 5 节完全相同。
        6. 累计获得口径：PRD P-01 和 SHARED-SPEC 第 6 节都写「不含押注退回」，数字 1,658 不变。
        7. 好友榜数字：10 页 ↔ SHARED-SPEC 第 6 节 ↔ 03 文档 3.10。
        8. 「PRD 4.13」仍被 02 第 1 / 4 / 8 节、03 第 6 节引用，4.13 标题还在。
      - 截图检查 01、02b、03、04-step1、04-step2、06（两态）、07、10、11、index，确认布局完整，然后删除 `/tmp/fs-*.png`。
      - `docs/.agents/tasks/v05_check.py` 留着当可复用工件，不删；除此之外不留其他临时文件。
      - 交付说明（写进 finalize 的总结）：
        - 用 A–G 概述这次改了什么；
        - 列出决策 1–16 的取舍；
        - 归档 5 页和恢复方法；
        - 截图未重新生成；
        - ops 新增冲突见第 3 节。

      Files: （只读校验；发现遗漏就回到对应文件修）
      Verify: `python3 docs/.agents/tasks/v05_check.py all` 退出码 0。

---

## 3. 范围外遗留：ops/ 这次新增的冲突（不改，交付时列给用户）

v0.4 已知的商城 / 充值冲突仍在（见 v04-plan 第 9 节）。v0.5 又新增以下冲突（`grep -rnE '知识|文章|战队榜|2 支|重叠|五折|加码|新手引导|阅读' ops` 核实过）：

| 文件 | 位置 | 冲突内容 |
|---|---|---|
| `ops/README.md` | L18 | 「每人最多同时参加 2 支战队」→ 应为 1 支 |
| `ops/README.md` | L24 | 「阅读健康知识 +1」「不按战队重复；重叠战队中 R 较低那支…50%」→ 阅读已删，重叠规则已删 |
| `ops/README.md` | L91 | 内容官职责含「健康小知识」→ 应只做站外增长内容 |
| `ops/README.md` | L94 | 活动官「中期加码」→ 已删 |
| `ops/README.md` | L95 | 用户运营官「新手引导」（指运营动作，不是页面；建议改成「新人激活」，避免和已删除的引导页混淆） |
| `ops/agents/content.md` | L5、L9、L13、L41、L51、L83、L111 | 「健康小知识」全套产出要求，L13 还引用了已删除的「PRD 4.10」 |
| `ops/agents/event.md` | L9、L105、L114 | 「加码任务」「中期加码 每人 +20」示例活动和预算 |
| `ops/agents/risk.md` | L35 | R9 规则含「同一天打卡积分按战队重复发放；重叠战队…50%」 |

`ops/` 里没有「全站战队榜 / 个人总榜」的引用，这一项没有新增冲突。
