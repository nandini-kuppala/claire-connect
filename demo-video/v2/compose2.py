#!/usr/bin/env python3
"""v2: animated scenes (clips/*.mp4) + demo scenes (stage PNG + recorded phones/desk) + narration → renders/CLAIRE-Connect-3min.mp4"""
import json, os, subprocess, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
FPS = 30; LEAD = 0.3; TAIL = 0.55
voice = {s['id']: s['seconds'] for s in json.load(open('voice/timings.json'))['segments']}
raw = json.load(open('raw/all.json'))
EXTRA = {'s11': 1.0, 's13': 0.3, 's17': 1.2}
ORDER = [f's{i:02d}' for i in range(1, 10)] + ['s09b'] + [f's{i:02d}' for i in range(10, 18)]
ANIM = {'s01', 's02', 's03', 's04', 's05', 's06', 's10', 's15', 's16', 's17'}
def win(group, sid, a=None, b=None):
    m = {x['edge']: x['t'] for x in raw[group]['marks'] if x['id'] == sid}
    return (a if a is not None else m['start'], b if b is not None else m['end'])
TWO = [(716, 120), (1276, 120)]; ONE = (1252, 120)
DEMO = {
    's07': ('market2', ['amit'], win('market2', 's07')),
    's08': ('market2', ['amit', 'lakshmi'], win('market2', 's08')),
    's09': ('market2', ['amit', 'lakshmi'], win('market2', 's09')),
    's09b': ('ratings', ['store', 'profile'], win('ratings', 's09b')),
    's11': ('goods', ['murali', 'priya'], win('goods', 's11', a=raw['goods']['marks'][0]['t'] + 2.4)),
    's12': ('goods', ['murali'], win('goods', 's12', a=raw['goods']['marks'][2]['t'] + 2.5)),
    's13': ('goods', ['murali'], win('goods', 's13', a=raw['goods']['marks'][4]['t'] + 3.0, b=raw['goods']['marks'][4]['t'] + 16.5)),
    's14': ('desk', ['desk'], win('desk', 's14')),
}
m2 = {x['id'] + ':' + x['edge']: x['t'] for x in raw['market2']['marks']}
CUTS = {'s08': [(40.6, 44.8), (52.4, 57.6)]}  # idle stretches (no change on either phone), dropped from both at once
SLIDE = {'s08': m2['s08:start'] + 5.6}    # Lakshmi's phone slides in once Amit picks her
CAST = json.load(open('raw/cast_market2.json'))  # exact-time screencast videos for the two-phone deal
FLASH = {}
OVER = {'s09': ('stages/pill_sample.png', 'sampled', 3.2, 934, 966)}
ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2']
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-2000:]); sys.exit(1)
os.makedirs('scenes', exist_ok=True); os.makedirs('renders', exist_ok=True)
only = set(sys.argv[1:])
listing = []; total = 0
for sid in ORDER:
    T = round(LEAD + voice[sid] + TAIL + EXTRA.get(sid, 0), 2); out = f'scenes/{sid}.mp4'; total += T
    listing.append(f"file '{os.path.abspath(out)}'")
    if only and sid not in only and os.path.exists(out): continue
    fade = f'fade=t=in:st=0:d=0.25:color=white,fade=t=out:st={T-0.25:.2f}:d=0.25:color=white'
    audio = f'[A]adelay={int(LEAD*1000)}|{int(LEAD*1000)},apad,atrim=0:{T}[a]'
    if sid in ANIM:
        cmd = ['ffmpeg', '-v', 'error', '-y', '-i', f'clips/{sid}.mp4', '-i', f'voice/{sid}.mp3', '-filter_complex',
               f'[0:v]tpad=stop_mode=clone:stop_duration=5,trim=0:{T},setpts=PTS-STARTPTS,{fade}[v];[1:a]anull[A];{audio}', '-map', '[v]', '-map', '[a]', '-t', str(T), *ENC, out]
    else:
        group, names, (a, b) = DEMO[sid]; L = b - a; HOLD = 1.4 if sid != 's12' else 0.6
        speed = min(3.2, max(1.0, L / (T - HOLD)))
        ins = ['-loop', '1', '-framerate', str(FPS), '-t', str(T), '-i', f'stages/{"s08base" if sid in SLIDE else sid}.png']
        f = []; prev = '0:v'
        desk = names == ['desk']
        cut = CUTS.get(sid)
        cutlen = sum(c1 - c0 for c0, c1 in cut) if cut else 0
        if cut: L -= cutlen; speed = min(3.2, max(1.0, L / (T - HOLD)))
        slide = SLIDE.get(sid)
        if slide:
            ins += ['-loop', '1', '-i', 'stages/s08_slide.png']; si = len([x for x in ins if x == '-i']) - 1
        for k, n in enumerate(names):
            fv = FLASH.get(group)
            if group == 'market2': off = a - CAST[n]['t0']
            else: off = (a - raw[group]['flashAt'] + fv[n]) if fv else a - raw[group]['starts'][n]
            src = CAST[n]['mp4'] if group == 'market2' else raw[group]['vids'][n]
            ins += ['-ss', f'{off:.3f}', '-t', f'{L + cutlen:.3f}', '-i', src]
            if desk: x, y, w, h, mask = 240, 180, 1440, 860, 'stages/mask_desk.png'; sc = f'scale={w}:{h}'
            else: (x, y), w, h, mask = (TWO[k] if (len(names) == 2 or sid == 's07') else ONE), 416, 900, 'stages/mask_phone.png'; sc = f'scale={w}:{h}:flags=lanczos' if group == 'market2' else f'crop=390:844:0:0,scale={w}:{h}:flags=lanczos'
            ins += ['-loop', '1', '-i', mask]
            vi, mi = (1 if not slide else 2) + 2 * k, (2 if not slide else 3) + 2 * k
            sel = (f"fps={FPS},select='not(" + '+'.join(f'between(t,{c0 - a:.3f},{c1 - a:.3f})' for c0, c1 in cut) + f")',setpts=N/({FPS}*TB),") if cut else ''
            f.append(f'[{vi}:v]setpts=PTS-STARTPTS,{sel}setpts=PTS/{speed:.4f},fps={FPS},{sc},tpad=stop_mode=clone:stop_duration={T:.2f},trim=0:{T},format=rgba[c{k}];[{mi}:v]scale={w}:{h},format=gray[m{k}];[c{k}][m{k}]alphamerge[cm{k}]')
            if slide and k == 1:
                t0 = (slide - a) / speed
                xe = f"if(lt(t,{t0:.2f}),1920,if(lt(t,{t0 + 0.7:.2f}),1148+772*pow(1-(t-{t0:.2f})/0.7,3),1148))"
                f.append(f"[{prev}][{si}:v]overlay=x='{xe}':y=0[sl];[sl][cm{k}]overlay=x='{xe}+128':y={y}:shortest=0[o{k}]")
            else:
                f.append(f'[{prev}][cm{k}]overlay={x}:{y}:shortest=0[o{k}]')
            prev = f'o{k}'
        ai = len([x for x in ins if x == '-i'])
        if sid in OVER:
            png, mk, dur, ox, oy = OVER[sid]
            mt = [x['t'] for x in raw[group]['marks'] if x['id'] == sid and x['edge'] == mk][0]
            t0 = (mt - a) / speed
            ins += ['-loop', '1', '-i', png]; oi = ai; ai += 1
            f.append(f"[{prev}][{oi}:v]overlay={ox}:{oy}:enable='between(t,{t0:.2f},{t0 + dur:.2f})'[ov]"); prev = 'ov'
        f.append(f'[{prev}]{fade}[v];[{ai}:a]anull[A];{audio}')
        cmd = ['ffmpeg', '-v', 'error', '-y', *ins, '-i', f'voice/{sid}.mp3', '-filter_complex', ';'.join(f), '-map', '[v]', '-map', '[a]', '-t', str(T), *ENC, out]
        print(f'{sid}: {L:.1f}s of footage at {speed:.2f}x')
    run(cmd); print(sid, 'ok', T)
open('scenes/list.txt', 'w').write('\n'.join(listing) + '\n')
run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'scenes/list.txt', '-c', 'copy', 'scenes/concat.mp4'])
bgm = 'bgm.wav' if os.path.exists('bgm.wav') else None
if bgm:
    run(['ffmpeg', '-v', 'error', '-y', '-i', 'scenes/concat.mp4', '-stream_loop', '-1', '-i', bgm, '-filter_complex', f'[1:a]volume=0.10,atrim=0:{total},afade=t=out:st={total-3}:d=3[b];[0:a][b]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', 'renders/CLAIRE-Connect-3min.mp4'])
else:
    run(['ffmpeg', '-v', 'error', '-y', '-i', 'scenes/concat.mp4', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', 'renders/CLAIRE-Connect-3min.mp4'])
print(f'total {total:.1f}s')
