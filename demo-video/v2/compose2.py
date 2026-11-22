#!/usr/bin/env python3
"""v2: animated scenes (clips/*.mp4) + demo scenes (stage PNG + recorded phones/desk) + narration → renders/CLAIRE-Connect-3min.mp4"""
import json, os, subprocess, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
FPS = 30; LEAD = 0.3; TAIL = 0.6
voice = {s['id']: s['seconds'] for s in json.load(open('voice/timings.json'))['segments']}
raw = json.load(open('raw/all.json'))
EXTRA = {'s08': 1.5, 's09': 2.0, 's11': 3.0, 's13': 1.5, 's14': 0.8, 's17': 1.2}
ORDER = [f's{i:02d}' for i in range(1, 18)]
ANIM = {'s01', 's02', 's03', 's04', 's05', 's06', 's10', 's15', 's16', 's17'}
def win(group, sid, a=None, b=None):
    m = {x['edge']: x['t'] for x in raw[group]['marks'] if x['id'] == sid}
    return (a if a is not None else m['start'], b if b is not None else m['end'])
TWO = [(716, 120), (1276, 120)]; ONE = (1252, 120)
DEMO = {
    's07': ('market', ['amit', 'lakshmi'], win('market', 's07')),
    's08': ('market', ['amit', 'lakshmi'], win('market', 's08')),
    's09': ('market', ['amit', 'lakshmi'], win('market', 's09')),
    's11': ('goods', ['murali', 'priya'], win('goods', 's11', a=raw['goods']['marks'][0]['t'] + 2.4)),
    's12': ('goods', ['murali'], win('goods', 's12', a=raw['goods']['marks'][2]['t'] + 3.0)),
    's13': ('goods', ['murali'], win('goods', 's13', a=63.5, b=77.0)),
    's14': ('desk', ['desk'], win('desk', 's14')),
}
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
        ins = ['-loop', '1', '-framerate', str(FPS), '-t', str(T), '-i', f'stages/{sid}.png']
        f = []; prev = '0:v'
        desk = names == ['desk']
        for k, n in enumerate(names):
            off = a - raw[group]['starts'][n]
            ins += ['-ss', f'{off:.3f}', '-t', f'{L:.3f}', '-i', raw[group]['vids'][n]]
            if desk: x, y, w, h, mask = 240, 180, 1440, 860, 'stages/mask_desk.png'; sc = f'scale={w}:{h}'
            else: (x, y), w, h, mask = (TWO[k] if len(names) == 2 else ONE), 416, 900, 'stages/mask_phone.png'; sc = f'crop=390:844:0:0,scale={w}:{h}:flags=lanczos'
            ins += ['-loop', '1', '-i', mask]
            vi, mi = 1 + 2 * k, 2 + 2 * k
            f.append(f'[{vi}:v]setpts=(PTS-STARTPTS)/{speed:.4f},fps={FPS},{sc},tpad=stop_mode=clone:stop_duration={T:.2f},trim=0:{T},format=rgba[c{k}];[{mi}:v]scale={w}:{h},format=gray[m{k}];[c{k}][m{k}]alphamerge[cm{k}];[{prev}][cm{k}]overlay={x}:{y}:shortest=0[o{k}]')
            prev = f'o{k}'
        ai = 1 + 2 * len(names)
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
