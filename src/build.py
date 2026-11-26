#!/usr/bin/env python3
"""Gera o site estático do @cobaia.dev.

Uso:  python3 src/build.py
Cada dia tem o miolo em src/dias/<slug>.html; este script monta topo, calendário,
navegação, rodapé e a página /30-dias. Para um dia novo: adicione uma entrada em DIAS
e crie o arquivo do miolo.
"""
import html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://cobaia-dev.vercel.app"
REDES = [
    ("Instagram", "https://www.instagram.com/cobaia.dev/"),
    ("TikTok", "https://www.tiktok.com/@cobaia.dev"),
    ("YouTube", "https://www.youtube.com/@cobaia.dev1"),
]

# n, slug, palavra-chave, título curto (cards), título da página, frase de abertura, resumo (meta description)
DIAS = [
    dict(n=1, slug="dia-01", kw=None, curto="Ninguém editou esse vídeo",
         desc="Como o Claude editou um vídeo inteiro a partir de um áudio cru: cortes, cenas, legenda, música e efeitos."),
    dict(n=2, slug="jogo", kw="JOGO", curto="Um jogo sem código",
         desc="Passo a passo grátis pra criar o seu primeiro jogo com o Claude, sem escrever uma linha de código."),
    dict(n=3, slug="skill", kw="SKILL", curto="Skill é a receita da vó",
         desc="O manual pra criar a sua primeira skill no Claude e ensinar uma tarefa do seu jeito."),
    dict(n=4, slug="limpar", kw="LIMPAR", curto="19 mil e-mails limpos",
         desc="Os dois prompts pra limpar a caixa de entrada e receber o resumo da noite com o Claude no Gmail e na Agenda."),
    dict(n=5, slug="mcp", kw="MCP", curto="O Claude montou meu post no Canva",
         desc="Os pedidos prontos pra copiar e usar o Claude com o Canva via MCP, e o passo a passo pra ligar sem programar."),
    dict(n=6, slug="notebook", kw="NOTEBOOK", curto="Ressuscitei um notebook velho com o Claude", landing=True,
         desc="O guia pra reviver um notebook velho com um Debian 13, do pendrive à interface, com os comandos pra fazer à mão e os pedidos prontos pro Claude Code."),
    dict(n=8, slug="tablet", kw="TABLET", curto="Ressuscitei um tablet abandonado", landing=True,
         desc="O mapa grátis pra ressuscitar o seu tablet velho e o passo a passo feito pro seu modelo, até o limite que ele aguenta."),
    dict(n=9, slug="professor", kw="PROFESSOR", curto="O Claude virou meu professor particular",
         desc="O passo a passo pra instalar o LearnHarness, ligar no Claude e estudar pro Enem com um professor que te testa, ensina e lembra o que revisar."),
    dict(n=10, slug="wifi", kw="WIFI", curto="O Claude achou o ladrão do meu Wi-Fi",
         desc="O pedido exato pro Claude Code investigar o seu Wi-Fi lento (velocidade, consumo escondido e canal do vizinho) e o passo a passo pra corrigir."),
    dict(n=12, slug="omniroute", kw="CLAUDE", curto="O Claude Code ligado em 352 IAs",
         desc="O guia gratuito do OmniRoute: instalar do zero, ligar as IAs grátis no Claude Code e os limites que ninguém te conta."),
    dict(n=13, slug="humano", kw="HUMANO", curto="O Claude escreve sem cara de IA",
         desc="O guia gratuito do Anti-Robô: o pedido que levanta os padrões de texto de IA, a skill que guarda as regras e os pedidos prontos pra escrever como gente."),
    dict(n=14, slug="planilha", kw="PLANILHA", curto="O Claude mostrou pra onde vai o salário",
         desc="O pedido exato pra transformar a fatura do cartão numa planilha com gastos por categoria, plano pra sair das dívidas, reserva de emergência e as assinaturas esquecidas."),
    dict(n=16, slug="vendas", kw="VENDAS", curto="Uma equipe de marketing inteira no Claude",
         desc="O passo a passo gratuito pra instalar 53 especialistas de marketing no Claude, montar o perfil da sua empresa e chamar o conselho com Ogilvy, Hormozi e Seth Godin."),
]
TOTAL = 30
DESTAQUE = 6  # dia em destaque no topo da página principal (o vídeo que viralizou)

ICONS = {
    "Instagram": '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>',
    "TikTok": '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/></svg>',
    "YouTube": '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.27 5 12 5 12 5s-6.27 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.73 19 12 19 12 19s6.27 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z"/></svg>',
}

def esc(s): return html.escape(s, quote=True)
def day(n): return next((d for d in DIAS if d["n"] == n), None)

def head(title, desc, path, og, depth, extra_attr=""):
    up = "../" * depth
    return f'''<!doctype html>
<html lang="pt-BR"{extra_attr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="theme-color" content="#0c0c0c">
<link rel="canonical" href="{SITE}{path}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="@cobaia.dev">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{SITE}/assets/og/{og}.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{up}assets/img/favicon.png">
<link rel="preload" href="{up}assets/fonts/anton-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{up}assets/site.css">
</head>
<body>
<div class="bg" aria-hidden="true"><i></i><i></i><i></i></div>
'''

def topbar(depth):
    up = "../" * depth
    return f'''<header class="top"><div class="bar glass">
  <a class="brand" href="{up}30-dias/"><span class="pf"><img src="{up}assets/img/luis.jpg" alt="" width="34" height="34"></span><span>@cobaia.dev</span></a>
  <div class="bar-r"><div class="bar-soc">{"".join(f'<a class="soc" href="{u}" target="_blank" rel="noopener" aria-label="{n}">{ICONS[n]}</a>' for n, u in REDES[1:])}</div><button class="cal-btn" type="button" data-open-cal aria-haspopup="dialog" aria-controls="cal"><i class="dot"></i>30 dias</button></div>
</div></header>
'''

def calendar(depth, current=None):
    up = "../" * depth
    cells = []
    for n in range(1, TOTAL + 1):
        d = day(n)
        if d:
            here = ' class="here" aria-current="page"' if n == current else ""
            cells.append(f'<a href="{up}{d["slug"]}/" data-cal-day="{n}"{here}>{n:02d}<small>{esc(d["kw"] or "vídeo")}</small></a>')
        else:
            cells.append(f'<span data-cal-day="{n}" aria-label="Dia {n}, ainda trancado"><b>{n:02d}</b></span>')
    return f'''<div class="modal" id="cal" role="dialog" aria-modal="true" aria-labelledby="cal-t" aria-hidden="true">
  <div class="sheet glass">
    <div class="sheet-h"><div><h2 id="cal-t">30 dias</h2><p>um experimento novo todo dia, às 12h</p></div><button class="x" type="button" aria-label="Fechar">×</button></div>
    <div class="cal">{"".join(cells)}</div>
    <div class="legend"><span><i style="background:var(--red)"></i>liberado</span><span><i style="border:1px dashed var(--red)"></i>próximo</span><span><i style="background:rgba(255,255,255,.1)"></i>trancado</span></div>
  </div>
</div>
'''

def redes_botoes(cls="nets"):
    return f'<div class="{cls}">' + "".join(
        f'<a class="glass" href="{u}" target="_blank" rel="noopener">{ICONS[n]}{n}</a>' for n, u in REDES) + "</div>"

def redes_icones():
    return "".join(f'<a class="soc" href="{u}" target="_blank" rel="noopener" aria-label="{n}">{ICONS[n]}</a>' for n, u in REDES)

def foot(depth):
    up = "../" * depth
    return f'''<div class="cta rv">
  <span class="pf"><img src="{up}assets/img/luis.jpg" alt="Foto de perfil do @cobaia.dev" width="96" height="96"></span>
  <h2>30 dias, <em>30 experimentos</em></h2>
  <p class="lede">Eu testo antes de você. Segue pra não perder o próximo.</p>
  <a class="stamp" href="{REDES[0][1]}" target="_blank" rel="noopener">@COBAIA.DEV</a>
  {redes_botoes()}
</div>
<footer><span>© 2026 @cobaia.dev</span><span>30 experimentos com Claude</span></footer>
'''

def prev_next(n, depth):
    up = "../" * depth
    out = []
    p, q = day(n - 1), day(n + 1)
    if p:
        out.append(f'<a class="card glass" href="{up}{p["slug"]}/"><span class="d">← DIA {p["n"]:02d}{" · palavra " + p["kw"] if p["kw"] else ""}</span><div class="t">{esc(p["curto"])}</div><p>{esc(p["desc"])}</p></a>')
    else:
        out.append(f'<a class="card glass" href="{up}30-dias/"><span class="d">← TODOS OS DIAS</span><div class="t">O calendário</div><p>Veja os experimentos liberados até agora.</p></a>')
    if q:
        out.append(f'<a class="card glass red" href="{up}{q["slug"]}/" data-lock-day="{q["n"]}"><span class="d" data-when="DIA {q["n"]:02d} · libera às 12h">DIA {q["n"]:02d}{" · palavra " + q["kw"] if q["kw"] else ""} →</span><div class="t">{esc(q["curto"])}</div><p>{esc(q["desc"])}</p></a>')
    else:
        out.append(f'<div class="card glass red locked"><span class="d">DIA {n+1:02d} · em breve</span><div class="t">Próximo experimento</div><p>Sai às 12h. Segue o @cobaia.dev pra ver primeiro.</p></div>')
    return f'''<section class="rv" aria-labelledby="nx"><p class="eyebrow">continua a série</p><h2 id="nx">Os outros experimentos</h2><div class="next">{"".join(out)}</div></section>'''

def hero(d, depth, kicker, h1, lede, meta):
    up = "../" * depth
    kw = f'<span class="kw">você comentou <b>{d["kw"]}</b></span>' if d["kw"] else '<span class="kw">o primeiro experimento</span>'
    return f'''<div class="hero">
  <div class="hcopy">
    <div><span class="badge">DIA {d["n"]:02d}/30</span>{kw}</div>
    <p class="kick">{kicker}</p>
    <h1>{h1}</h1>
    <p class="lede">{lede}</p>
    <div class="meta">{"".join(f"<span>{m}</span>" for m in meta)}</div>
  </div>
  <div class="phone glass fan">
    <img src="{up}assets/img/capa-dia{d["n"]:02d}.jpg" alt="Capa do vídeo do Dia {d["n"]}" width="540" height="960">
    <div class="watch"><span>assistir</span>{redes_icones()}</div>
  </div>
</div>
'''

def lockscreen(d):
    return f'''<div class="lockscreen"><div class="glass">
  <span class="badge">DIA {d["n"]:02d}/30</span>
  <h2 style="margin-top:18px">Esse experimento ainda está no laboratório</h2>
  <p style="color:var(--muted)">A página libera junto com o vídeo, às 12h. Falta:</p>
  <div class="clock"><div><b>00</b><span>dias</span></div><div><b>00</b><span>horas</span></div><div><b>00</b><span>min</span></div><div><b>00</b><span>seg</span></div></div>
  <button class="cal-btn" type="button" data-open-cal>Ver os dias liberados</button>
</div></div>
'''

def build_day(d):
    src = (ROOT / "src" / "dias" / f'{d["slug"]}.html').read_text(encoding="utf-8")
    meta, body = src.split("\n---\n", 1)
    m = json.loads(meta)
    title = f'{m["titulo"]} · Dia {d["n"]:02d} · @cobaia.dev'
    page = head(title, d["desc"], f'/{d["slug"]}', f'dia{d["n"]:02d}', 1, f' data-day="{d["n"]}"')
    page += topbar(1) + '<main class="wrap">\n' + lockscreen(d)
    page += hero(d, 1, m["kicker"], m["h1"], m["lede"], m["meta"])
    page += body.replace("{{UP}}", "../")
    page += prev_next(d["n"], 1) + foot(1) + "</main>\n" + calendar(1, d["n"])
    page += '<script src="../assets/site.js"></script>\n</body>\n</html>\n'
    out = ROOT / d["slug"] / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(page, encoding="utf-8")

# dias com landing page escrita à mão (fora de DIAS): n, caminho, palavra, título curto, descrição
LANDINGS = [
    dict(n=11, path="gta", kw="GTA", curto="Uma live de GTA VI vira 5 cortes",
         desc="O guia pra montar uma página de cortes de GTA VI com o Claude, da página vazia ao primeiro corte postado."),
]

def build_hub():
    itens = {}
    for d in DIAS:
        itens[d["n"]] = dict(n=d["n"], href=f'../{d["slug"]}/', kw=d["kw"], curto=d["curto"], desc=d["desc"])
    for l in LANDINGS:
        itens[l["n"]] = dict(n=l["n"], href=f'../{l["path"]}/', kw=l["kw"], curto=l["curto"], desc=l["desc"])
    DEST = (6, 8)  # guias em destaque: notebook e tablet
    feats = []
    for n in DEST:
        it = itens[n]
        tag = "veio pelo vídeo do notebook?" if n == 6 else "veio pelo vídeo do tablet?"
        go = "Abrir o passo a passo do notebook →" if n == 6 else "Abrir o passo a passo do tablet →"
        feats.append(f'''<a class="feat glass rv fan" href="{it["href"]}" data-lock-day="{n}">
  <div class="feat-im"><img src="../assets/img/capa-dia{n:02d}.jpg" alt="Capa do vídeo do Dia {n}" width="540" height="960"></div>
  <div class="feat-b">
    <span class="feat-tag">{tag}</span>
    <span class="feat-n">DIA {n:02d} · palavra {it["kw"]}</span>
    <span class="feat-t">{esc(it["curto"])}</span>
    <p>{esc(it["desc"])}</p>
    <span class="feat-go">{go}</span>
  </div>
</a>''')
    cards = []
    for n in sorted(itens):
        if n in DEST: continue
        it = itens[n]
        k = f'<span class="k">{it["kw"]}</span>' if it["kw"] else ""
        cards.append(f'''<a class="dcard glass rv" href="{it["href"]}" data-lock-day="{n}">{k}<div class="im"><img src="../assets/img/capa-dia{n:02d}.jpg" alt="Capa do vídeo do Dia {n}" loading="lazy" width="540" height="960"></div><div class="b"><span class="n" data-when="DIA {n:02d} · libera às 12h">DIA {n:02d}</span><span class="t">{esc(it["curto"])}</span></div></a>''')
    kws = {it["kw"]: it["href"] for it in itens.values() if it["kw"]}
    rel = {it["kw"]: it["n"] for it in itens.values() if it["kw"]}
    chips = "".join(f'<a class="kwchip" href="{it["href"]}" data-lock-day="{it["n"]}">{it["kw"]}</a>' for it in sorted(itens.values(), key=lambda x: x["n"]) if it["kw"])
    page = head("Projeto 30 dias · 30 experimentos com o Claude · @cobaia.dev",
                "Todos os experimentos do @cobaia.dev com o Claude: um vídeo novo por dia, com o guia completo de cada um.",
                "/30-dias", "hub", 1)
    page += topbar(1) + f'''<main class="wrap">
<div class="hub-hero">
  <h1>Projeto <em>30 dias</em></h1>
  <p class="kick">30 experimentos com o <span class="claude">Claude</span></p>
  <form class="find glass" id="find" autocomplete="off">
    <label for="kw">Comentou uma palavra? Digite ou toque nela:</label>
    <input id="kw" name="kw" placeholder="ex.: NOTEBOOK" maxlength="20" enterkeyhint="go">
    <div class="kwchips">{chips}</div>
    <p class="res" id="res" aria-live="polite"></p>
  </form>
</div>
{"".join(feats)}
<section class="outros" aria-labelledby="todos"><h2 id="todos" class="feat-h2">Os outros dias</h2>
  <div class="progress" aria-hidden="true"><i data-progress></i></div>
  <p class="note"><span data-done>{len(itens)}</span> de 30 liberados</p>
<div class="grid30">{"".join(cards)}</div></section>
{foot(1)}
</main>
{calendar(1)}
<script src="../assets/site.js"></script>
<script>
(function(){{var K={json.dumps(kws)},N={json.dumps(rel)},f=document.getElementById('find'),i=document.getElementById('kw'),r=document.getElementById('res');
function norm(s){{return s.trim().toUpperCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}}
function look(go){{var w=norm(i.value);if(!w){{r.textContent='';return;}}var s=K[w];
 if(s&&!COBAIA.released(N[w])){{r.textContent='Essa página libera às 12h, junto com o vídeo.';return;}}
 if(s){{if(go)location.href=s;else r.innerHTML='Achei: <a href="'+s+'">abrir o guia de '+w+' →</a>';}}
 else r.textContent='Ainda não tem essa palavra. Confere a grafia ou procura nos dias abaixo.';}}
i.addEventListener('input',function(){{look(false)}});
f.addEventListener('submit',function(e){{e.preventDefault();look(true)}});}})();
</script>
</body>
</html>
'''
    (ROOT / "30-dias").mkdir(exist_ok=True)
    (ROOT / "30-dias" / "index.html").write_text(page, encoding="utf-8")

if __name__ == "__main__":
    for d in DIAS:
        if not d.get("landing"):  # landing pages (ex.: /tablet) são escritas à mão
            build_day(d)
    build_hub()
    # guias pagos: página inteira escrita à mão, copiada para a rota protegida pelo middleware
    for src, dst in [("gta-guia.html", "gta/guia/index.html")]:
        (ROOT / dst).parent.mkdir(parents=True, exist_ok=True)
        (ROOT / dst).write_text((ROOT / "src" / "dias" / src).read_text(encoding="utf-8"), encoding="utf-8")
    # skills que vão junto com os guias: zip fixo (mesma data em tudo) pra não mudar a cada build
    import zipfile
    for skill, dst in [("cortes-gta", "gta/guia/cortes-gta.zip")]:
        base = ROOT / "src" / "skills" / skill
        with zipfile.ZipFile(ROOT / dst, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(base.rglob("*")):
                if f.is_file() and "__pycache__" not in f.parts:
                    info = zipfile.ZipInfo(f"{skill}/{f.relative_to(base).as_posix()}", (2026, 1, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = (0o755 if f.suffix in (".py", ".sh") else 0o644) << 16
                    z.writestr(info, f.read_bytes())
    print("ok:", ", ".join(d["slug"] for d in DIAS), "+ 30-dias")
