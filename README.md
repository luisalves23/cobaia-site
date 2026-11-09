# cobaia-site

Site do @cobaia.dev: uma página por experimento do projeto 30 dias, com o guia completo prometido em cada vídeo.

- HTML, CSS e JS puros. Sem framework, sem build na Vercel.
- Cada página libera sozinha às 12h (Brasília) do dia dela (`assets/site.js`, função `releaseOf`).

## Adicionar um dia novo
1. Copie a capa reduzida (540 px de largura) para `assets/img/capa-diaNN.jpg`.
2. Adicione o dia em `DIAS` no `src/build.py`.
3. Crie o miolo em `src/dias/<palavra>.html` (use um dos existentes como modelo).
4. Rode `python3 src/build.py` e `node src/og.js` (imagem de prévia da DM) e faça o commit.
