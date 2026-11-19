#!/usr/bin/env python3
"""Composites stage backgrounds + recorded clips + narration into scenes, then concatenates the final video."""
import json, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
marks = json.load(open('raw/marks.json'))
files = marks['files']
voice = {s['id']: s['seconds'] for s in json.load(open('voice/timings.json'))['segments']}
ORDER = ['i1', 'i2', 'i3', 'i4', 'i5'] + [f'd{i}' for i in range(1, 15)] + ['m1', 'm2', 'm3', 'm4', 'o1']
SLIDES = {'i1', 'i2', 'i3', 'i4', 'i5', 'o1'}
LEAD = 0.25   # silence before each line
TAIL = 0.65   # breathing room after each line
EXTRA = {'i5': 0.5, 'd14': 0.4, 'o1': 1.2}

span = {}
for m in marks['marks']:
    span.setdefault(m['id'], {'page': m['page']})[m['edge']] = m['t']

os.makedirs('scenes', exist_ok=True)
FPS = 30
ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2']

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:]); raise SystemExit(1)

listing = []
total = 0.0
for sid in ORDER:
    T = round(LEAD + voice[sid] + TAIL + EXTRA.get(sid, 0), 2)
    out = f'scenes/{sid}.mp4'
    audio = ['-i', f'voice/{sid}.mp3']
    afilt = f'[A]adelay={int(LEAD*1000)}|{int(LEAD*1000)},apad,atrim=0:{T}[a]'
    fade = f'fade=t=in:st=0:d=0.3:color=white,fade=t=out:st={T-0.3}:d=0.3:color=white'
    if sid in SLIDES and os.path.exists(out):
        listing.append(f"file '{os.path.abspath(out)}'"); total += T; print(sid, 'cached'); continue
    if sid in SLIDES:
        frames = int(T * FPS)
        cmd = ['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-t', str(T), '-i', f'stages/{sid}.png', *audio,
               '-filter_complex', f"[0:v]scale=2112:-1,zoompan=z='min(zoom+0.00022,1.035)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps={FPS},{fade}[v];[1:a]anull[A];{afilt}",
               '-map', '[v]', '-map', '[a]', '-t', str(T), *ENC, out]
    else:
        s = span[sid]; a, b = s['start'], s['end']; L = b - a
        speed = max(1.0, L / (T - 0.2))
        speed = min(speed, 2.2)
        hold = max(0.0, T - L / speed)
        src = files[s['page']]
        if sid == 'd14':
            w, h, x, y, mask = 1296, 810, 312, 210, 'stages/mask_desk.png'
            scale = f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}:0:0'
        else:
            w, h, x, y, mask = 416, 900, 1252, 90, 'stages/mask_phone.png'
            scale = f'crop=390:844:0:0,scale={w}:{h}:flags=lanczos'
        vf = (f"[1:v]setpts=(PTS-STARTPTS)/{speed:.4f},fps={FPS},{scale},tpad=stop_mode=clone:stop_duration={hold:.3f},format=rgba[clip];"
              f"[2:v]scale={w}:{h},format=gray[m];[clip][m]alphamerge[cm];"
              f"[0:v][cm]overlay={x}:{y}:shortest=0,{fade}[v];[3:a]anull[A];{afilt}")
        cmd = ['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-t', str(T), '-i', f'stages/{sid}.png',
               '-ss', f'{a:.3f}', '-t', f'{L:.3f}', '-i', src, '-loop', '1', '-i', mask, *audio,
               '-filter_complex', vf, '-map', '[v]', '-map', '[a]', '-t', str(T), *ENC, out]
        print(f'{sid}: clip {L:.1f}s → speed {speed:.2f}x, hold {hold:.1f}s')
    run(cmd)
    listing.append(f"file '{os.path.abspath(out)}'")
    total += T
    print(f'{sid} done ({T}s)')

open('scenes/list.txt', 'w').write('\n'.join(listing) + '\n')
os.makedirs('renders', exist_ok=True)
run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'scenes/list.txt', '-c', 'copy', 'raw/concat.mp4'])
# Loudness to -16 LUFS (web standard). Write to a different path: APFS is case-insensitive.
run(['ffmpeg', '-v', 'error', '-y', '-i', 'raw/concat.mp4', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', 'renders/CLAIRE-Connect-demo.mp4'])
print(f'total ≈ {total:.1f}s → renders/CLAIRE-Connect-demo.mp4')
