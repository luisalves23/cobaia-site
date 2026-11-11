// Gera as imagens de prévia (1200x630) que aparecem quando o link é colado na DM.
// Uso: node src/og.js   (precisa do Playwright)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const R = path.resolve(__dirname, '..'); const A = 'file://' + R + '/assets/';
const items = [
  ['dia01', 'DIA 01/30', 'NINGUÉM <span>EDITOU</span> ESSE VÍDEO', null],
  ['dia02', 'DIA 02/30', 'SEU PRIMEIRO <span>JOGO</span> COM O CLAUDE', 'JOGO'],
  ['dia03', 'DIA 03/30', 'SKILL É A <span>RECEITA DA VÓ</span>', 'SKILL'],
  ['dia04', 'DIA 04/30', '19 MIL E-MAILS <span>LIMPOS</span>', 'LIMPAR'],
  ['dia05', 'DIA 05/30', 'MCP: A TOMADA <span>PADRÃO</span> DA IA', 'MCP'],
  ['dia06', 'DIA 06/30', 'UM NOTEBOOK VELHO <span>RESSUSCITADO</span>', 'NOTEBOOK'],
  ['hub', 'PROJETO 30 DIAS', '30 DIAS, <span>30 EXPERIMENTOS</span> COM CLAUDE', null],
];
const css = `@font-face{font-family:Anton;src:url(${A}fonts/anton-latin-400-normal.woff2)}@font-face{font-family:M;font-weight:700;src:url(${A}fonts/jetbrains-mono-latin-700-normal.woff2)}@font-face{font-family:S;font-style:italic;src:url(${A}fonts/instrument-serif-latin-400-italic.woff2)}
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;color:#F2EEE6;background:radial-gradient(ellipse at 30% 40%,#2a0d0d 0%,#0c0c0c 65%);position:relative;font-family:M}
.dots{position:absolute;inset:0;background-image:radial-gradient(rgba(242,238,230,.1) 2px,transparent 2.6px);background-size:44px 44px}
.l{position:absolute;left:70px;top:70px;width:690px}.b{display:inline-block;font-family:Anton;font-size:34px;background:#FF2D2D;color:#0c0c0c;padding:4px 20px 1px;border-radius:30px}
h1{font-family:Anton;font-weight:400;font-size:92px;line-height:.95;margin-top:34px}h1 span{color:#FF2D2D}
.k{position:absolute;left:70px;bottom:62px;font-size:26px;color:#a7a29a}.k b{color:#F2EEE6;border:2px dashed #a7a29a;padding:2px 12px;border-radius:8px}
.p{position:absolute;right:70px;top:50px;width:300px;height:530px;border-radius:34px;padding:8px;background:linear-gradient(160deg,rgba(255,255,255,.25),rgba(255,255,255,.05));box-shadow:0 30px 70px rgba(0,0,0,.6);transform:rotate(3deg)}
.p img{width:100%;height:100%;object-fit:cover;border-radius:27px}.h{position:absolute;right:70px;bottom:20px;font-size:22px;color:#77726c}
.av{position:absolute;right:120px;top:150px;width:300px;height:300px;border-radius:50%;border:10px solid #FF2D2D;object-fit:cover}`;
(async () => {
  fs.mkdirSync(R + '/assets/og', { recursive: true });
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  for (const [id, badge, title, kw] of items) {
    const right = id === 'hub' ? `<img class="av" src="${A}img/avatar.jpg">` : `<div class="p"><img src="${A}img/capa-${id}.jpg"></div>`;
    const k = kw ? `<div class="k">você comentou <b>${kw}</b> </div>` : `<div class="k">@cobaia.dev · 30 experimentos com Claude</div>`;
    const tmp = path.join(require('os').tmpdir(), 'cobaia-og.html'); fs.writeFileSync(tmp, `<html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="dots"></div><div class="l"><span class="b">${badge}</span><h1>${title}</h1></div>${k}${right}</body></html>`); await pg.goto('file://' + tmp);
    await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(200);
    await pg.screenshot({ path: `${R}/assets/og/${id}.png` });
  }
  await b.close(); console.log('og ok');
})();
