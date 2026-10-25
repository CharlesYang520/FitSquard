# 生成三套主题的打卡页预览（独立文件，不依赖 ../assets/style.css）
THEMES = {
    "forest": dict(
        title="① 森林 · 墨绿 + 象牙 + 黄铜",
        desk="#E4E0D7", bg="#F3EFE7", card="#FFFFFF", card2="#F7F4EE", line="#ECE6DA",
        ink="#1C2A23", sub="#7C7465", faint="#B3AB9C",
        primary="#1E3B30", on_primary="#F3EFE7", accent="#C9A96E", accent_ink="#1E3B30", accent_text="#9C7A42",
        hero_bg="#1E3B30", hero_ink="#F3EFE7", hero_sub="rgba(243,239,231,.62)",
        chip_bg="#1E3B30", chip_ink="#E9DFC9",
        shadow="0 10px 28px rgba(30,59,48,.10)", slot_full="#1E3B30", slot_full_ink="#E9DFC9",
        page_grad="none", glass="none", status="#1C2A23", hold_fill="rgba(201,169,110,.45)",
    ),
    "midnight": dict(
        title="② 静夜 · 深夜蓝 + 香槟金",
        desk="#0A0D15", bg="#0E1320", card="rgba(255,255,255,.055)", card2="rgba(255,255,255,.035)", line="rgba(255,255,255,.07)",
        ink="#ECE9E2", sub="rgba(236,233,226,.55)", faint="rgba(236,233,226,.28)",
        primary="#D9C29A", on_primary="#0E1320", accent="#D9C29A", accent_ink="#0E1320", accent_text="#D9C29A",
        hero_bg="linear-gradient(140deg,rgba(217,194,154,.22),rgba(217,194,154,.05))", hero_ink="#ECE9E2", hero_sub="rgba(236,233,226,.6)",
        chip_bg="rgba(217,194,154,.12)", chip_ink="#D9C29A",
        shadow="0 10px 30px rgba(0,0,0,.35)", slot_full="rgba(217,194,154,.18)", slot_full_ink="#ECE9E2",
        page_grad="radial-gradient(120% 60% at 85% 0%,#22304F 0%,rgba(14,19,32,0) 60%)", glass="blur(10px)", status="#ECE9E2", hold_fill="rgba(14,19,32,.28)",
    ),
    "carbon": dict(
        title="③ 碳白竞技 · 白 + 碳黑 + 信号橙",
        desk="#E9E8E4", bg="#FAFAF8", card="#FFFFFF", card2="#F4F3EF", line="#EEECE7",
        ink="#141414", sub="#8C8983", faint="#BDBAB3",
        primary="#141414", on_primary="#FFFFFF", accent="#FF5A1F", accent_ink="#FFFFFF", accent_text="#E2480F",
        hero_bg="#141414", hero_ink="#FFFFFF", hero_sub="rgba(255,255,255,.6)",
        chip_bg="#141414", chip_ink="#FFFFFF",
        shadow="0 1px 0 rgba(0,0,0,.04)", slot_full="#141414", slot_full_ink="#FFFFFF",
        page_grad="none", glass="none", status="#141414", hold_fill="rgba(255,90,31,.55)",
    ),
}

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"PingFang SC","Helvetica Neue",Arial,sans-serif;background:%(desk)s;min-height:100vh;color:%(ink)s}
.serif{font-family:"New York","Songti SC","STSong",Georgia,serif;font-weight:600;letter-spacing:-.5px}
.hd{text-align:center;padding:40px 16px 0;color:%(ink)s}
.hd h1{font-size:20px;font-weight:700}
.hd p{font-size:13px;opacity:.6;margin-top:6px}
.back{position:fixed;left:16px;top:16px;height:34px;padding:0 14px;border-radius:17px;background:%(card)s;color:%(ink)s;font-size:13px;display:inline-flex;align-items:center;text-decoration:none;border:1px solid %(line)s}
.stage{display:flex;gap:48px;justify-content:center;flex-wrap:wrap;padding:30px 24px 60px}
.dev{display:flex;flex-direction:column;align-items:center;gap:12px}
.lbl{font-size:13px;font-weight:600;color:%(ink)s;opacity:.8}
.phone{position:relative;width:375px;height:812px;border-radius:46px;overflow:hidden;background:%(bg)s;box-shadow:0 0 0 10px #111,0 0 0 11px #2a2a2a,0 30px 70px rgba(0,0,0,.25);display:flex;flex-direction:column}
.phone::before{content:"";position:absolute;inset:0;background:%(page_grad)s;pointer-events:none}
.phone::after{content:"";position:absolute;left:50%%;bottom:8px;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:%(ink)s;opacity:.8;z-index:9}
.sb{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;font-size:15px;font-weight:600;color:%(status)s;position:relative}
.nav{height:44px;display:flex;align-items:center;justify-content:center;position:relative;font-size:16px;font-weight:600;color:%(ink)s}
.nav .bk{position:absolute;left:18px;font-size:20px;opacity:.7}
.cap{position:absolute;right:8px;width:87px;height:32px;border-radius:16px;border:1px solid %(line)s;background:%(card)s;display:flex;align-items:center;justify-content:space-around;font-size:13px;color:%(ink)s}
.scr{flex:1;overflow:hidden;padding:6px 20px 0;position:relative}
.top{display:flex;align-items:center;justify-content:space-between}
.chip{height:26px;padding:0 12px;border-radius:13px;background:%(chip_bg)s;color:%(chip_ink)s;font-size:12px;font-weight:600;display:inline-flex;align-items:center;letter-spacing:.3px}
.dn{font-size:11px;letter-spacing:1.5px;color:%(sub)s}
.title{margin-top:18px;font-size:26px;line-height:1.25;font-weight:600;letter-spacing:-.3px}
.title .n{font-size:38px;color:%(accent_text)s;vertical-align:-3px}
.mood{display:inline-flex;gap:2px;margin-top:14px;padding:3px;border-radius:15px;background:%(card2)s;border:1px solid %(line)s}
.mood span{height:26px;padding:0 11px;border-radius:12px;font-size:12px;color:%(sub)s;display:inline-flex;align-items:center}
.mood span.on{background:%(card)s;color:%(ink)s;font-weight:600;box-shadow:%(shadow)s}
.slots{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
.slot{height:96px;border-radius:20px;border:1px dashed %(faint)s;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:11px;color:%(faint)s}
.slot .p{font-size:20px;font-weight:300}
.slot.on{border:1px solid %(line)s;background:%(card)s;color:%(ink)s;box-shadow:%(shadow)s;backdrop-filter:%(glass)s}
.slot.on .e{font-size:24px}
.slot.on .t{font-size:10px;color:%(sub)s;font-variant-numeric:tabular-nums}
.slots.full .slot.on{background:%(slot_full)s;color:%(slot_full_ink)s;border-color:transparent}
.slots.full .slot.on .t{color:%(slot_full_ink)s;opacity:.65}
.prog{display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:%(sub)s}
.prog b{color:%(accent_text)s;font-weight:700}
.rec{position:relative;margin-top:18px;padding:18px;border-radius:24px;background:%(hero_bg)s;color:%(hero_ink)s;border:1px solid %(line)s}
.rec .l{font-size:10px;letter-spacing:2px;color:%(accent)s;font-weight:600}
.rec .w{margin-top:10px;font-size:20px;font-weight:600;line-height:1.35}
.rec .y{margin-top:6px;font-size:12px;color:%(hero_sub)s}
.rec .m{margin-top:12px;display:flex;gap:6px}
.rec .m span{height:22px;padding:0 9px;border-radius:11px;border:1px solid %(hero_sub)s;font-size:11px;display:inline-flex;align-items:center;color:%(hero_sub)s}
.rec .ck{position:absolute;right:18px;bottom:18px;width:44px;height:44px;border-radius:50%%;background:%(accent)s;color:%(accent_ink)s;display:grid;place-items:center;font-size:18px;font-weight:700}
.grp{display:flex;justify-content:space-between;align-items:baseline;margin:22px 2px 10px}
.grp b{font-size:14px;font-weight:600}
.grp span{font-size:11px;color:%(sub)s}
.list{border-radius:22px;background:%(card)s;border:1px solid %(line)s;overflow:hidden;backdrop-filter:%(glass)s}
.it{display:flex;align-items:center;gap:12px;padding:13px 14px}
.it+.it{border-top:1px solid %(line)s}
.it .ic{width:38px;height:38px;border-radius:12px;background:%(card2)s;display:grid;place-items:center;font-size:18px}
.it .n{flex:1;font-size:14px;font-weight:500;line-height:1.3}
.it .s{font-size:11px;color:%(sub)s;margin-top:3px}
.it .ck{width:32px;height:32px;border-radius:50%%;border:1.2px solid %(ink)s;opacity:.85;display:grid;place-items:center;font-size:13px;color:%(ink)s}
.it.lock .n,.it.lock .ic{opacity:.4}
.it .lt{font-size:10px;color:%(sub)s;text-align:right;line-height:1.3}
.it .lt b{display:block;font-size:13px;color:%(ink)s;opacity:.7;font-variant-numeric:tabular-nums}
.ring{width:34px;height:34px;border-radius:50%%;background:conic-gradient(%(accent)s 80%%,%(line)s 0);display:grid;place-items:center}
.ring i{width:28px;height:28px;border-radius:50%%;background:%(bg)s;display:grid;place-items:center;font-style:normal;font-size:9px;font-weight:700;color:%(ink)s}
.tab{position:relative;height:84px;padding-bottom:28px;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid %(line)s;background:%(card)s;backdrop-filter:%(glass)s}
.tab a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;color:%(sub)s;text-decoration:none}
.tab a.on{color:%(accent_text)s;font-weight:600}
.tab .d{width:5px;height:5px;border-radius:50%%;background:currentColor;opacity:0}
.tab a.on .d{opacity:1}
.mask{position:absolute;inset:0;background:rgba(0,0,0,.42);z-index:5}
.sheet{position:absolute;left:0;right:0;bottom:0;z-index:6;padding:24px 22px 40px;border-radius:30px 30px 0 0;background:%(bg)s;border-top:1px solid %(line)s}
.sheet .h{display:flex;gap:12px;align-items:center}
.sheet .h .ic{width:50px;height:50px;border-radius:16px;background:%(card)s;border:1px solid %(line)s;display:grid;place-items:center;font-size:26px}
.sheet .t{font-size:19px;font-weight:600}
.sheet .st{font-size:12px;color:%(sub)s;margin-top:3px}
.pl{margin-top:16px;padding:14px;border-radius:16px;background:%(card2)s;font-size:12.5px;line-height:1.65;color:%(sub)s}
.ops{display:flex;gap:8px;margin-top:12px}
.ops span{flex:1;height:38px;border-radius:19px;border:1px solid %(line)s;background:%(card)s;display:grid;place-items:center;font-size:12px;color:%(ink)s}
.hold{position:relative;overflow:hidden;margin-top:18px;height:58px;border-radius:29px;background:%(primary)s;color:%(on_primary)s;display:grid;place-items:center;font-size:16px;font-weight:600;letter-spacing:.5px}
.hold::before{content:"";position:absolute;left:0;top:0;bottom:0;width:62%%;background:%(hold_fill)s}
.hold span{position:relative}
.cancel{text-align:center;margin-top:14px;font-size:13px;color:%(sub)s}
.win{margin-top:18px;padding:18px;border-radius:24px;background:%(hero_bg)s;color:%(hero_ink)s;display:flex;align-items:center;gap:16px;border:1px solid %(line)s}
.win .b{font-size:56px;line-height:1;color:%(accent)s}
.win .t{font-size:15px;font-weight:600}
.win .s{font-size:12px;color:%(hero_sub)s;margin-top:3px}
.rk{margin-top:14px;border-radius:22px;background:%(card)s;border:1px solid %(line)s;overflow:hidden}
.rk .r{display:flex;align-items:center;gap:12px;padding:12px 14px}
.rk .r+.r{border-top:1px solid %(line)s}
.rk .no{width:18px;font-size:13px;color:%(sub)s;text-align:center}
.rk .av{width:30px;height:30px;border-radius:50%%;display:grid;place-items:center;font-size:12px;color:#fff;font-weight:600}
.rk .nm{flex:1;font-size:13.5px}
.rk .v{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.rk .r.me{background:%(card2)s}
.disc{text-align:center;font-size:11px;color:%(faint)s;margin-top:18px}
.btm{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 20px 36px;border-top:1px solid %(line)s;background:%(bg)s}
.btn{height:50px;border-radius:25px;display:grid;place-items:center;font-size:15px;font-weight:600}
.btn.a{background:%(primary)s;color:%(on_primary)s}
.btn.b{border:1px solid %(line)s;background:%(card)s;color:%(ink)s}
"""

SB = '<div class="sb"><span>12:40</span><span>●●● ◔ ▭</span></div>'
NAV = '<div class="nav"><span class="bk">‹</span>今天的<div class="cap"><span>···</span><span>|</span><span>◎</span></div></div>'
HEAD = '''<div class="top"><span class="chip">周四 · 工作日</span><span class="dn">DAY 6 / 14</span></div>'''
MOOD = '<div class="mood"><span class="on">正常</span><span>很忙</span><span>不太舒服</span></div>'
SLOTS2 = '''<div class="slots"><div class="slot on"><span class="e">💧</span>喝够 4 杯水<span class="t">10:58</span></div><div class="slot on"><span class="e">🥬</span>午饭先吃菜<span class="t">12:10</span></div><div class="slot"><span class="p">＋</span>还差 1 项</div></div>
<div class="prog"><span><b>2 / 3</b>　已完成</span><span>全队 3/5 已达标</span></div>'''
REC = '''<div class="rec"><div class="l">AI 推荐 · 现在正合适</div><div class="w">午饭后绕楼走 15 分钟</div><div class="y">你从 9 点坐到现在了，走一走下午不犯困</div><div class="m"><span>15 分钟</span><span>办公室附近</span></div><div class="ck">✓</div></div>'''
LIST = '''<div class="grp"><b>动一动</b><span>工作日侧重 · 别久坐</span></div>
<div class="list">
<div class="it"><span class="ic">👟</span><div class="n">走满 6000 步<div class="s">微信运动自动打卡</div></div><div class="ring"><i>80%%</i></div></div>
<div class="it"><span class="ic">🪑</span><div class="n">每坐 1 小时起来动 3 分钟<div class="s">3 × 3 分钟 · 随时</div></div><span class="ck">✓</span></div>
<div class="it"><span class="ic">🪜</span><div class="n">走一次楼梯代替电梯<div class="s">2 分钟 · 随时</div></div><span class="ck">✓</span></div>
</div>
<div class="grp"><b>吃喝 · 作息</b><span>2 项已完成</span></div>
<div class="list">
<div class="it lock"><span class="ic">🧋</span><div class="n">下午茶不点奶茶<div class="s">晚上确认</div></div><div class="lt"><b>20:00</b>后可打</div></div>
<div class="it"><span class="ic">😴</span><div class="n">午休闭眼 10 分钟<div class="s">12:30 – 14:00</div></div><span class="ck">✓</span></div>
</div>'''
TAB = '<div class="tab"><a class="on"><span>今日</span><span class="d"></span></a><a><span>战队</span><span class="d"></span></a><a><span>我的</span><span class="d"></span></a></div>'


def page(key, t):
    css = CSS % t
    p1 = f'''<div class="phone">{SB}{NAV}<div class="scr">{HEAD}<div class="title">再做 <span class="n serif">1</span> 项，<br>今天就达标</div>{MOOD}{SLOTS2}{REC}{LIST % ()}</div>{TAB}</div>'''
    p2 = f'''<div class="phone">{SB}{NAV}<div class="scr">{HEAD}<div class="title">再做 <span class="n serif">1</span> 项，<br>今天就达标</div>{MOOD}{SLOTS2}{REC}</div>
<div class="mask"></div><div class="sheet"><div class="h"><span class="ic">🚶</span><div><div class="t">真的走完 15 分钟了？</div><div class="st">会发到队内动态，4 个队友都看得到</div></div></div>
<div class="pl">没做完就先别按。排名只奖励真做了的人，糊弄排名等于糊弄自己。</div>
<div class="ops"><span>拍一张（可选）</span><span>说一句（可选）</span></div>
<div class="hold"><span>按住 1 秒 · 真的做完了</span></div><div class="cancel">还没，等下再来</div></div></div>'''
    p3 = f'''<div class="phone">{SB}{NAV}<div class="scr">{HEAD}<div class="title">今天达标了</div>
<div class="slots full" style="margin-top:20px"><div class="slot on"><span class="e">💧</span>喝够 4 杯水<span class="t">10:58</span></div><div class="slot on"><span class="e">🥬</span>午饭先吃菜<span class="t">12:10</span></div><div class="slot on"><span class="e">🚶</span>饭后绕楼走<span class="t">12:41</span></div></div>
<div class="prog"><span><b>3 / 3</b>　你今天第 4 个</span><span>全队 4/5</span></div>
<div class="win"><span class="b serif">6</span><div><div class="t">连续达标 6 天</div><div class="s">就差大刘了，他做完全队就是 5 天</div></div></div>
<div class="grp"><b>实时排名</b><span>谁打卡马上刷新</span></div>
<div class="rk">
<div class="r"><span class="no">1</span><span class="av" style="background:#4C8C6A">杰</span><span class="nm">阿杰</span><span class="v">6/6</span></div>
<div class="r"><span class="no">2</span><span class="av" style="background:#8A7BB8">M</span><span class="nm">Mia</span><span class="v">6/6</span></div>
<div class="r me"><span class="no">3</span><span class="av" style="background:#C77B55">王</span><span class="nm">小王 · 我</span><span class="v">6/6</span></div>
<div class="r"><span class="no">4</span><span class="av" style="background:#C9A24A">刘</span><span class="nm">大刘 · 今天还没打</span><span class="v">3/3</span></div>
</div>
<div class="disc">不适即停，有基础疾病请先咨询医生</div></div>
<div class="btm"><span class="btn b">催大刘</span><span class="btn a">好了</span></div></div>'''
    return f'''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{t["title"]} · 打卡页预览</title><style>{css}</style></head>
<body><a class="back" href="../index.html">← 总览</a><header class="hd"><h1>{t["title"]}</h1><p>主题预览 · 08 打卡页（工作日 · Day 6）· 清单 / 按住确认 / 达标</p></header>
<main class="stage"><div class="dev"><div class="lbl">今天的清单</div>{p1}</div><div class="dev"><div class="lbl">点打勾 · 按住 1 秒确认</div>{p2}</div><div class="dev"><div class="lbl">达标 + 实时排名</div>{p3}</div></main></body></html>'''


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for k, t in THEMES.items():
        with open(os.path.join(here, f"08-{k}.html"), "w", encoding="utf-8") as f:
            f.write(page(k, t))
    print("ok")
