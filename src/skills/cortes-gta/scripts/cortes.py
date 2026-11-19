#!/usr/bin/env python3
"""cortes-gta · @cobaia.dev
Transforma uma live (link ou arquivo) em cortes 9:16 prontos pra postar.

Etapas (o Claude roda na ordem, você só manda o link):
  checar                          confere se ffmpeg, yt-dlp e o whisper estão instalados
  baixar  LINK|ARQUIVO  -p PASTA  baixa o áudio e o chat (o vídeo inteiro só se for arquivo local)
  picos   -p PASTA                acha os momentos em que o chat e o áudio explodem
  transcrever -p PASTA            transcreve só os candidatos (rápido, roda no seu PC)
  trechos -p PASTA                baixa só os pedaços de vídeo dos candidatos
  quadro  -p PASTA                tira um print do vídeo pro Claude achar a câmera do streamer
  render  -p PASTA                monta os cortes a partir de PASTA/cortes.json
  gravar  CANAL -p PASTA          grava uma live da Twitch ao vivo, com o chat junto
"""
import argparse, json, math, os, re, shutil, socket, subprocess, sys, threading, time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
FONTES = AQUI.parent / "fontes"
W, H = 1080, 1920

# ---------------------------------------------------------------- utilidades

def sh(cmd, **kw):
    kw.setdefault("check", True)
    return subprocess.run(cmd, **kw)

def ffprobe_dur(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", str(p)], capture_output=True, text=True).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0

def ffprobe_wh(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height", "-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout.strip()
    w, h = out.split("\n")[0].split(",")[:2]
    return int(w), int(h)

def ler_json(p, padrao=None):
    p = Path(p)
    if not p.exists():
        return padrao
    return json.loads(p.read_text(encoding="utf-8"))

def gravar_json(p, dado):
    Path(p).write_text(json.dumps(dado, ensure_ascii=False, indent=2), encoding="utf-8")

def hms(s):
    s = max(0, s)
    return f"{int(s // 3600)}:{int(s % 3600 // 60):02d}:{s % 60:05.2f}"

def ytdlp():
    exe = shutil.which("yt-dlp")
    return [exe] if exe else [sys.executable, "-m", "yt_dlp"]

def eh_link(x):
    return bool(re.match(r"https?://", x))

# ---------------------------------------------------------------- checar

def cmd_checar(a):
    ok = True
    for nome in ["ffmpeg", "ffprobe"]:
        tem = shutil.which(nome)
        print(f"{'OK ' if tem else 'FALTA'}  {nome}")
        ok &= bool(tem)
    try:
        import yt_dlp  # noqa
        print("OK     yt-dlp")
    except ImportError:
        print("FALTA  yt-dlp           -> pip install yt-dlp"); ok = False
    try:
        import faster_whisper  # noqa
        print("OK     faster-whisper")
    except ImportError:
        print("FALTA  faster-whisper   -> pip install faster-whisper"); ok = False
    try:
        import numpy  # noqa
        print("OK     numpy")
    except ImportError:
        print("FALTA  numpy            -> pip install numpy"); ok = False
    td = shutil.which("TwitchDownloaderCLI") or shutil.which("TwitchDownloaderCLI.exe")
    print(f"{'OK ' if td else 'opcional'}  TwitchDownloaderCLI (chat de VOD da Twitch)")
    sl = shutil.which("streamlink")
    print(f"{'OK ' if sl else 'opcional'}  streamlink (gravar live ao vivo)")
    print(f"{'OK ' if (FONTES / 'Anton-Regular.ttf').exists() else 'FALTA'}  fonte Anton")
    print("\nTudo certo." if ok else "\nInstale o que falta e rode de novo.")
    return 0 if ok else 1

# ---------------------------------------------------------------- baixar

def baixar_chat_twitch(link, pasta):
    m = re.search(r"twitch\.tv/videos/(\d+)", link)
    td = shutil.which("TwitchDownloaderCLI") or shutil.which("TwitchDownloaderCLI.exe")
    if not m:
        print("Link da Twitch sem /videos/NUMERO: não dá pra pegar o chat de um VOD assim.")
        return None
    if not td:
        print("Sem TwitchDownloaderCLI: sigo só com o áudio (funciona, mas o chat ajuda muito).")
        return None
    out = pasta / "chat_twitch.json"
    out.unlink(missing_ok=True)
    r = sh([td, "chatdownload", "--id", m.group(1), "-o", str(out)], check=False)
    return out if r.returncode == 0 and out.exists() else None

def baixar_chat_youtube(link, pasta):
    r = sh(ytdlp() + ["--skip-download", "--write-subs", "--sub-langs", "live_chat",
                       "-o", str(pasta / "chat"), link], check=False)
    achados = list(pasta.glob("chat*.live_chat.json"))
    return achados[0] if achados else None

def cmd_baixar(a):
    pasta = Path(a.pasta); pasta.mkdir(parents=True, exist_ok=True)
    info = {"origem": a.fonte}
    if eh_link(a.fonte):
        print("1/2 · baixando só o áudio (bem mais leve que o vídeo)…")
        sh(ytdlp() + ["-f", "bestaudio/best", "-x", "--audio-format", "m4a",
                       "-o", str(pasta / "audio.%(ext)s"), a.fonte])
        info["audio"] = str(next(pasta.glob("audio.*")))
        print("2/2 · baixando o chat…")
        chat = None
        if "twitch.tv" in a.fonte:
            chat = baixar_chat_twitch(a.fonte, pasta)
        elif "youtu" in a.fonte:
            chat = baixar_chat_youtube(a.fonte, pasta)
        if chat:
            info["chat"] = str(chat)
        else:
            print("Chat não veio. Os picos vão sair só pelo áudio.")
    else:
        src = Path(a.fonte).expanduser().resolve()
        if not src.exists():
            sys.exit(f"Arquivo não encontrado: {src}")
        info["video"] = str(src)
        print("Arquivo local: extraindo o áudio…")
        sh(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "96k",
            str(pasta / "audio.m4a")])
        info["audio"] = str(pasta / "audio.m4a")
        for nome in ["chat.jsonl", src.stem + ".chat.jsonl"]:
            c = src.parent / nome
            if c.exists():
                info["chat"] = str(c); break
    info["duracao"] = ffprobe_dur(info["audio"])
    gravar_json(pasta / "live.json", info)
    print(f"Pronto: {hms(info['duracao'])} de live, chat {'sim' if info.get('chat') else 'não'}.")

# ---------------------------------------------------------------- chat

REACAO = re.compile(r"(k{4,}|(ha){3,}|(rs){3,}|lul|kekw|omegalul|lmao|pog|\?{3,}|!{3,}|clip|corta|mds|meu deus|"
                    r"kkk|socorro|n[aã]o acredito|caraca|caralho|que isso|wtf|😂|🤣|💀)", re.I)

def ler_chat(caminho):
    """Devolve [(segundo, texto)] de qualquer formato conhecido."""
    p = Path(caminho); msgs = []
    if p.suffix == ".jsonl" and not p.name.endswith(".live_chat.json"):
        for linha in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            try:
                d = json.loads(linha); msgs.append((float(d["t"]), d.get("msg", "")))
            except Exception:
                pass
        return msgs
    if p.name.endswith(".live_chat.json"):
        for linha in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            try:
                d = json.loads(linha)
                rep = d.get("replayChatItemAction", d)
                t = float(rep.get("videoOffsetTimeMsec", 0)) / 1000
                for ac in rep.get("actions", []):
                    it = ac.get("addChatItemAction", {}).get("item", {})
                    r = it.get("liveChatTextMessageRenderer") or it.get("liveChatPaidMessageRenderer")
                    if r:
                        txt = "".join(x.get("text", "") or x.get("emoji", {}).get("shortcuts", [""])[0]
                                      for x in r.get("message", {}).get("runs", []))
                        msgs.append((t, txt))
            except Exception:
                pass
        return msgs
    d = json.loads(p.read_text(encoding="utf-8", errors="ignore"))
    for c in d.get("comments", []):
        msgs.append((float(c.get("content_offset_seconds", 0)), c.get("message", {}).get("body", "")))
    return msgs

# ---------------------------------------------------------------- picos

def energia_audio(audio, passo=0.5):
    import numpy as np
    sr = 8000
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    n = int(sr * passo); k = len(x) // n
    x = x[: k * n].reshape(k, n)
    rms = np.sqrt((x ** 2).mean(axis=1) + 1e-9)
    return 20 * np.log10(rms), passo

def z_local(v, janela):
    """z-score de cada ponto contra a mediana dos `janela` pontos anteriores (robusto a live que muda de clima)."""
    import numpy as np
    v = np.asarray(v, dtype=np.float32); out = np.zeros_like(v)
    for i in range(len(v)):
        ini = max(0, i - janela); base = v[ini:i] if i - ini >= 20 else v[: max(20, i + 1)]
        med = np.median(base); mad = np.median(np.abs(base - med)) * 1.4826 + 1e-3
        out[i] = (v[i] - med) / mad
    return out

def cmd_picos(a):
    import numpy as np
    pasta = Path(a.pasta); live = ler_json(pasta / "live.json")
    if not live:
        sys.exit("Rode o baixar antes.")
    dur = live["duracao"]; seg = int(math.ceil(dur))
    print("Lendo o áudio…")
    db, passo = energia_audio(live["audio"])
    por_seg = int(1 / passo)
    db_s = db[: (len(db) // por_seg) * por_seg].reshape(-1, por_seg).max(axis=1)
    db_s = np.pad(db_s, (0, max(0, seg - len(db_s))), constant_values=db_s.min() if len(db_s) else -60)[:seg]
    sus = np.convolve(db_s, np.ones(6) / 6, mode="same")  # grito/risada sustentada pesa mais que um estalo
    z_aud = z_local(sus, 300)

    msgs = ler_chat(live["chat"]) if live.get("chat") else []
    tem_chat = len(msgs) > 50
    if tem_chat:
        print(f"Lendo {len(msgs)} mensagens do chat…")
        cont = np.zeros(seg); reac = np.zeros(seg)
        for t, txt in msgs:
            i = int(t)
            if 0 <= i < seg:
                cont[i] += 1
                if REACAO.search(txt or ""):
                    reac[i] += 1
        sinal = np.convolve(cont + 2 * reac, np.ones(10), mode="full")[:seg]  # soma dos últimos 10 s
        z_chat = z_local(sinal, 300)
        # o chat reage uns 6 a 12 s depois do lance (atraso da live + tempo de digitar): puxa pra trás
        atraso = a.atraso
        z_chat = np.concatenate([z_chat[atraso:], np.zeros(atraso)])
        nota = 0.65 * np.clip(z_chat, 0, 25) + 0.35 * np.clip(z_aud, 0, 25)
    else:
        print("Sem chat: usando só o áudio (risada, grito, mudança brusca).")
        nota = np.clip(z_aud, 0, 25)
    nota = np.convolve(nota, np.ones(5) / 5, mode="same")

    escolhidos = []; ordem = np.argsort(-nota)
    for i in ordem:
        if len(escolhidos) >= a.quantos:
            break
        if nota[i] <= 0.5 or i < 20 or i > seg - 10:
            continue
        if all(abs(i - j) >= a.distancia for j in escolhidos):
            escolhidos.append(int(i))
    escolhidos.sort()

    cands = []
    for n, pico in enumerate(escolhidos, 1):
        ini = max(0, pico - a.antes); fim = min(dur, pico + a.depois)
        amostra = [txt for t, txt in msgs if pico - 2 <= t - a.atraso <= pico + 12][:25] if tem_chat else []
        cands.append({"id": f"c{n:02d}", "pico": pico, "inicio": ini, "fim": fim,
                      "nota": round(float(nota[pico]), 2), "chat": amostra})
    gravar_json(pasta / "candidatos.json", cands)
    print(f"{len(cands)} candidatos salvos em {pasta / 'candidatos.json'}:")
    for c in cands:
        print(f"  {c['id']}  {hms(c['pico'])}  nota {c['nota']}")

# ---------------------------------------------------------------- transcrever

def cmd_transcrever(a):
    from faster_whisper import WhisperModel
    pasta = Path(a.pasta); live = ler_json(pasta / "live.json"); cands = ler_json(pasta / "candidatos.json")
    if not cands:
        sys.exit("Rode o picos antes.")
    print(f"Carregando o whisper ({a.modelo}). Na 1ª vez ele baixa o modelo, demora um pouco.")
    if a.gpu:
        modelo = WhisperModel(a.modelo, device="cuda", compute_type="float16")
    else:
        modelo = WhisperModel(a.modelo, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 4)
    tmp = pasta / "_tmp.wav"; linhas_md = ["# Candidatos a corte\n",
        "Cada bloco é um momento em que o chat e/ou o áudio explodiram. Tempo em h:mm:ss da live.\n"]
    for c in cands:
        if a.so and c["id"] not in a.so:
            continue
        sh(["ffmpeg", "-y", "-v", "error", "-ss", str(c["inicio"]), "-t", str(c["fim"] - c["inicio"]),
            "-i", live["audio"], "-ac", "1", "-ar", "16000", str(tmp)])
        segs, _ = modelo.transcribe(str(tmp), language="pt", word_timestamps=True, vad_filter=True,
                                    initial_prompt="Live de GTA, gírias, risadas, polícia, carro, missão.")
        palavras, frases = [], []
        for s in segs:
            frases.append({"s": round(c["inicio"] + s.start, 2), "e": round(c["inicio"] + s.end, 2), "t": s.text.strip()})
            for w in (s.words or []):
                palavras.append({"w": w.word.strip(), "s": round(c["inicio"] + w.start, 2), "e": round(c["inicio"] + w.end, 2)})
        c["frases"] = frases; c["palavras"] = palavras
        linhas_md.append(f"\n## {c['id']} · pico em {hms(c['pico'])} · nota {c['nota']}\n")
        for f in frases:
            linhas_md.append(f"- `{hms(f['s'])}` {f['t']}")
        if c.get("chat"):
            linhas_md.append("\nChat nessa hora: " + " | ".join(m for m in c["chat"] if m)[:600])
        print(f"  {c['id']} ok ({len(palavras)} palavras)")
    tmp.unlink(missing_ok=True)
    gravar_json(pasta / "candidatos.json", cands)
    (pasta / "candidatos.md").write_text("\n".join(linhas_md) + "\n", encoding="utf-8")
    print(f"Leia {pasta / 'candidatos.md'} pra escolher os cortes.")

# ---------------------------------------------------------------- trechos / quadro

def cmd_trechos(a):
    pasta = Path(a.pasta); live = ler_json(pasta / "live.json"); cands = ler_json(pasta / "candidatos.json")
    if live.get("video"):
        print("Vídeo local: não precisa baixar trechos."); return
    tdir = pasta / "trechos"; tdir.mkdir(exist_ok=True)
    for c in cands:
        if a.so and c["id"] not in a.so:
            continue
        ini, fim = max(0, c["inicio"] - 5), c["fim"] + 5
        destino = tdir / f"{c['id']}.mp4"
        c["trecho"] = str(destino); c["trecho_ini"] = round(ini)
        if destino.exists():
            continue
        print(f"Baixando {c['id']} ({hms(ini)} a {hms(fim)})…")
        sh(ytdlp() + ["-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--download-sections", f"*{ini:.0f}-{fim:.0f}",
                       "--force-keyframes-at-cuts", "--merge-output-format", "mp4", "-o", str(destino), live["origem"]])
    gravar_json(pasta / "candidatos.json", cands)

def fonte_video(pasta, live, cands, ini, fim):
    """Acha de onde recortar [ini, fim] e devolve (arquivo, deslocamento)."""
    if live.get("video"):
        return live["video"], 0.0
    for c in cands:
        if c.get("trecho") and c["trecho_ini"] <= ini and fim <= c["trecho_ini"] + ffprobe_dur(c["trecho"]) + 0.5:
            return c["trecho"], float(c["trecho_ini"])
    sys.exit(f"Nenhum trecho cobre {hms(ini)}–{hms(fim)}. Rode: trechos --so <id do candidato>")

def cmd_quadro(a):
    pasta = Path(a.pasta); live = ler_json(pasta / "live.json"); cands = ler_json(pasta / "candidatos.json") or []
    if live.get("video"):
        arq, t = live["video"], (cands[0]["pico"] if cands else 60)
    else:
        c = next((c for c in cands if c.get("trecho")), None)
        if not c:
            sys.exit("Rode o trechos antes.")
        arq, t = c["trecho"], 8
    out = pasta / "quadro.jpg"
    sh(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", arq, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "3", str(out)])
    w, h = ffprobe_wh(arq)
    print(f"Print salvo em {out} (1280 px de largura). O vídeo original tem {w}x{h}.")
    print("Coordenadas da câmera vão em fração da tela (0 a 1), então não importa o tamanho.")

# ---------------------------------------------------------------- legendas (ASS)

def ass_cor(hexrgb, alpha="00"):
    h = hexrgb.lstrip("#"); return f"&H{alpha}{h[4:6]}{h[2:4]}{h[0:2]}"

def ass_t(s):
    s = max(0, s); cs = int(round(s * 100))
    return f"{cs // 360000}:{cs % 360000 // 6000:02d}:{cs % 6000 // 100:02d}.{cs % 100:02d}"

def esc(t):
    return t.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")

def blocos(palavras, maxp=3):
    out, cur = [], []
    for w in palavras:
        if cur and (len(cur) >= maxp or w["s"] - cur[-1]["e"] > 0.6 or re.search(r"[.!?,]$", cur[-1]["w"])):
            out.append(cur); cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return out

def montar_ass(corte, palavras, dur, layout, cfg, cam_pos="cima"):
    cor = cfg.get("cor_destaque", "#FFB458"); cor2 = cfg.get("cor_gancho", "#F36A78")
    # posições: legenda onde o olho já está, gancho sem cobrir rosto nem ação
    if layout == "empilhado" and cam_pos == "cima":
        y_leg, y_gan, an_gan, y_cred, an_cred = 1420, 768, 5, 1850, 2
    elif layout == "empilhado":
        y_leg, y_gan, an_gan, y_cred, an_cred = 1152, 250, 8, 70, 8
    else:
        y_leg, y_gan, an_gan, y_cred, an_cred = 1400, 360, 8, 70, 8
    est = [
        f"Style: Leg,Anton,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,7,3,5,60,60,0,1",
        f"Style: Gancho,Anton,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,8,0,8,70,70,0,1",
        f"Style: Cred,Anton,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,0,0,0,0,100,100,1,0,3,10,0,8,40,40,0,1",
    ]
    ev = []
    gancho = esc(corte.get("gancho", "").upper())
    dest = (corte.get("destaque") or "").upper()
    if gancho:
        if dest and dest in gancho:
            gancho = gancho.replace(dest, "{\\c" + ass_cor(cor2) + "}" + dest + "{\\c&H00FFFFFF&}", 1)
        fim_g = dur if cfg.get("gancho_o_tempo_todo", True) else min(dur, 4.0)
        ev.append(f"Dialogue: 2,{ass_t(0)},{ass_t(fim_g)},Gancho,,0,0,0,,{{\\an{an_gan}\\pos(540,{y_gan})\\fad(120,0)}}{gancho}")
    cred = esc(corte.get("credito") or cfg.get("credito", ""))
    if cred:
        ev.append(f"Dialogue: 3,{ass_t(0)},{ass_t(dur)},Cred,,0,0,0,,{{\\an{an_cred}\\pos(540,{y_cred})}}{cred}")
    for b in blocos(palavras):
        for i, w in enumerate(b):
            ini = w["s"]; fim = b[i + 1]["s"] if i + 1 < len(b) else max(w["e"], w["s"] + 0.25)
            if fim <= 0 or ini >= dur:
                continue
            partes = []
            for j, x in enumerate(b):
                t = esc(x["w"].upper())
                partes.append("{\\c" + ass_cor(cor) + "\\fscx112\\fscy112}" + t + "{\\c&H00FFFFFF&\\fscx100\\fscy100}" if j == i else t)
            ev.append(f"Dialogue: 1,{ass_t(max(0, ini))},{ass_t(min(dur, fim))},Leg,,0,0,0,,{{\\an5\\pos(540,{y_leg})}}" + " ".join(partes))
    return ("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\n\n"
            "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
            "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
            "MarginL, MarginR, MarginV, Encoding\n" + "\n".join(est) +
            "\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n" + "\n".join(ev) + "\n")

# ---------------------------------------------------------------- render

def encaixar(ini, fim, palavras):
    """Começa e termina no vão entre palavras, nunca no meio de uma."""
    for w in palavras:
        if w["s"] < ini < w["e"]:
            ini = max(0, w["s"] - 0.08)
        if w["s"] < fim < w["e"]:
            fim = w["e"] + 0.25
    return ini, fim

def filtro_video(layout, src_w, src_h, cam, foco_x, cam_pos="cima"):
    if layout == "empilhado" and cam:
        gh, ch = 1152, 768  # 60% jogo, 40% câmera (em cima por padrão, ou embaixo)
        cw_ = int(src_h * W / gh) // 2 * 2; cw_ = min(cw_, src_w)
        if foco_x is None:  # tira a câmera de dentro do quadro do jogo quando dá
            cx = (src_w - cw_) // 2
            cam_x0, cam_x1 = cam["x"] * src_w, (cam["x"] + cam["w"]) * src_w
            if cam_x0 >= src_w / 2 and cx + cw_ > cam_x0:
                cx = max(0, int(cam_x0) - cw_)
            elif cam_x1 <= src_w / 2 and cx < cam_x1:
                cx = min(src_w - cw_, int(cam_x1))
            cx = cx // 2 * 2
        else:
            cx = int((src_w - cw_) * foco_x) // 2 * 2
        x, y, w, h = [int(v) for v in (cam["x"] * src_w, cam["y"] * src_h, cam["w"] * src_w, cam["h"] * src_h)]
        alvo = W / ch
        if w / h > alvo:
            nw = int(h * alvo); x += (w - nw) // 2; w = nw
        else:
            nh = int(w / alvo); y += (h - nh) // 2; h = nh
        return (f"[0:v]split=2[a][b];[a]crop={cw_}:{src_h}:{cx}:0,scale={W}:{gh}:flags=lanczos,setsar=1[jogo];"
                f"[b]crop={w // 2 * 2}:{h // 2 * 2}:{x}:{y},scale={W}:{ch}:flags=lanczos,setsar=1[cam];"
                + ("[cam][jogo]vstack=inputs=2[base]" if cam_pos == "cima" else "[jogo][cam]vstack=inputs=2[base]"))
    foco_x = 0.5 if foco_x is None else foco_x
    if layout == "zoom":
        cw_ = int(src_h * W / H) // 2 * 2; cx = int((src_w - cw_) * foco_x) // 2 * 2
        return f"[0:v]crop={cw_}:{src_h}:{cx}:0,scale={W}:{H}:flags=lanczos,setsar=1[base]"
    # "jogo": tela inteira no meio, fundo borrado
    return (f"[0:v]split=2[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
            f"boxblur=28:2,eq=brightness=-0.12[fundo];[b]scale={W}:-2:flags=lanczos[meio];"
            f"[fundo][meio]overlay=0:(H-h)/2-80,setsar=1[base]")

def cmd_render(a):
    pasta = Path(a.pasta); live = ler_json(pasta / "live.json"); cands = ler_json(pasta / "candidatos.json") or []
    cfg = ler_json(pasta / "cortes.json")
    if not cfg:
        sys.exit("Falta o cortes.json (o Claude escreve depois de ler o candidatos.md).")
    todas = [w for c in cands for w in c.get("palavras", [])]
    todas.sort(key=lambda w: w["s"])
    saida = pasta / "prontos"; saida.mkdir(exist_ok=True)
    fontsdir = str(FONTES).replace("\\", "/").replace(":", "\\:")
    for corte in cfg["cortes"]:
        if a.so and corte["id"] not in a.so:
            continue
        ini, fim = encaixar(float(corte["inicio"]), float(corte["fim"]), todas)
        dur = round(fim - ini, 2)
        arq, desl = fonte_video(pasta, live, cands, ini, fim)
        sw, shh = ffprobe_wh(arq)
        layout = corte.get("layout", cfg.get("layout", "empilhado"))
        cam = corte.get("cam", cfg.get("cam"))
        if layout == "empilhado" and not cam:
            layout = "jogo"
        pal = [{"w": w["w"], "s": w["s"] - ini, "e": w["e"] - ini} for w in todas if w["e"] > ini and w["s"] < fim]
        ass = saida / f"{corte['id']}.ass"
        cam_pos = corte.get("cam_posicao", cfg.get("cam_posicao", "cima"))
        ass.write_text(montar_ass(corte, pal, dur, layout, cfg, cam_pos), encoding="utf-8")
        assf = str(ass).replace("\\", "/").replace(":", "\\:")
        fx = corte.get("foco_x", cfg.get("foco_x"))
        fv = filtro_video(layout, sw, shh, cam, None if fx is None else float(fx), cam_pos)
        fv += f";[base]ass='{assf}':fontsdir='{fontsdir}',fps=30,format=yuv420p[v]"
        mp4 = saida / f"{corte['id']}.mp4"
        print(f"Montando {corte['id']} · {dur:.1f} s · layout {layout}…")
        sh(["ffmpeg", "-y", "-v", "error", "-ss", f"{ini - desl:.2f}", "-t", f"{dur:.2f}", "-i", arq,
            "-filter_complex", fv, "-map", "[v]", "-map", "0:a:0?",
            "-af", "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000",
            "-c:v", "libx264", "-preset", a.preset, "-crf", "20", "-profile:v", "high",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(mp4)])
        txt = [f"CORTE {corte['id']} · {dur:.0f} s", ""]
        for rede in ["tiktok", "reels", "shorts"]:
            p = (corte.get("post") or {}).get(rede)
            if p:
                txt += [rede.upper(), p, ""]
        (saida / f"{corte['id']}.txt").write_text("\n".join(txt), encoding="utf-8")
        ass.unlink(missing_ok=True) if not a.manter_ass else None
    print(f"\nCortes prontos em {saida}")

# ---------------------------------------------------------------- gravar ao vivo

def cmd_gravar(a):
    pasta = Path(a.pasta); pasta.mkdir(parents=True, exist_ok=True)
    canal = a.canal.lower().split("/")[-1]
    sl = shutil.which("streamlink")
    if not sl:
        sys.exit("Instale o streamlink: pip install streamlink")
    video = pasta / "live.ts"; chatf = pasta / "chat.jsonl"
    t0 = time.time(); parar = threading.Event()

    def chat():
        while not parar.is_set():
            try:
                s = socket.create_connection(("irc.chat.twitch.tv", 6667), timeout=30)
                s.sendall(f"NICK justinfan{int(t0) % 99999}\r\nJOIN #{canal}\r\n".encode())
                buf = ""
                with open(chatf, "a", encoding="utf-8") as f:
                    while not parar.is_set():
                        try:
                            dado = s.recv(4096).decode("utf-8", "ignore")
                        except socket.timeout:
                            continue
                        if not dado:
                            break
                        buf += dado
                        *linhas, buf = buf.split("\r\n")
                        for l in linhas:
                            if l.startswith("PING"):
                                s.sendall(b"PONG :tmi.twitch.tv\r\n")
                            elif "PRIVMSG" in l:
                                msg = l.split(" :", 1)[1] if " :" in l else ""
                                f.write(json.dumps({"t": round(time.time() - t0, 2), "msg": msg}, ensure_ascii=False) + "\n")
                                f.flush()
            except OSError:
                time.sleep(5)

    threading.Thread(target=chat, daemon=True).start()
    print(f"Gravando twitch.tv/{canal} em {video} (Ctrl+C pra parar)…")
    try:
        sh([sl, "--twitch-disable-ads", "-o", str(video), f"https://twitch.tv/{canal}", "best"], check=False)
    except KeyboardInterrupt:
        pass
    parar.set()
    print(f"Fim. Agora: baixar {video} -p {pasta}  (o chat.jsonl ao lado é lido sozinho)")

# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("checar"); s.set_defaults(f=cmd_checar)
    s = sub.add_parser("baixar"); s.add_argument("fonte"); s.add_argument("-p", "--pasta", required=True); s.set_defaults(f=cmd_baixar)
    s = sub.add_parser("picos"); s.add_argument("-p", "--pasta", required=True)
    s.add_argument("--quantos", type=int, default=12); s.add_argument("--distancia", type=int, default=90)
    s.add_argument("--antes", type=int, default=40); s.add_argument("--depois", type=int, default=20)
    s.add_argument("--atraso", type=int, default=8); s.set_defaults(f=cmd_picos)
    s = sub.add_parser("transcrever"); s.add_argument("-p", "--pasta", required=True)
    s.add_argument("--modelo", default="small"); s.add_argument("--so", nargs="*")
    s.add_argument("--gpu", action="store_true", help="placa NVIDIA com CUDA e cuDNN instalados"); s.set_defaults(f=cmd_transcrever)
    s = sub.add_parser("trechos"); s.add_argument("-p", "--pasta", required=True); s.add_argument("--so", nargs="*"); s.set_defaults(f=cmd_trechos)
    s = sub.add_parser("quadro"); s.add_argument("-p", "--pasta", required=True); s.set_defaults(f=cmd_quadro)
    s = sub.add_parser("render"); s.add_argument("-p", "--pasta", required=True); s.add_argument("--so", nargs="*")
    s.add_argument("--preset", default="medium"); s.add_argument("--manter-ass", action="store_true"); s.set_defaults(f=cmd_render)
    s = sub.add_parser("gravar"); s.add_argument("canal"); s.add_argument("-p", "--pasta", required=True); s.set_defaults(f=cmd_gravar)
    a = ap.parse_args()
    r = a.f(a)
    sys.exit(r or 0)

if __name__ == "__main__":
    main()
