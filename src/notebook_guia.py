#!/usr/bin/env python3
"""Monta o guia pago do notebook: src/notebook-guia/*.html -> notebook/guia/index.html

As aulas ficam em src/notebook-guia/aulas.html, escritas em HTML simples.
O conteúdo dos blocos <pre ...>...</pre> é escrito cru (com <, > e &) e este script escapa.
Uso: python3 src/notebook_guia.py
"""
import html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "notebook-guia"

def escapa_pre(s):
    def f(m):
        corpo = m.group(2)
        if corpo.startswith("\n"):
            corpo = corpo[1:]
        return m.group(1) + html.escape(corpo.rstrip("\n"), quote=False) + "</pre>"
    return re.sub(r"(<pre[^>]*>)(.*?)</pre>", f, s, flags=re.S)

aulas = escapa_pre((SRC / "aulas.html").read_text(encoding="utf-8"))
casca = (SRC / "casca.html").read_text(encoding="utf-8")
out = ROOT / "notebook" / "guia" / "index.html"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(casca.replace("<!--AULAS-->", aulas), encoding="utf-8")
print("ok:", out.relative_to(ROOT), len(re.findall(r'<section class="aula"', aulas)), "aulas")
