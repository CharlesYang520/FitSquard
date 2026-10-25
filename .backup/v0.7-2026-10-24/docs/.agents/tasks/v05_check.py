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
