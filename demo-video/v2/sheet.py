import sys, subprocess
out, files = sys.argv[1], sys.argv[2:]
import os
cols = int(os.environ.get("COLS", 3)); W = int(os.environ.get("W", 640)); H = int(os.environ.get("H", 360))
ins = []; f = []
for i, p in enumerate(files): ins += ['-i', p]; f.append(f'[{i}]scale={W}:{H}[v{i}]')
lay = '|'.join(f'{(i%cols)*W}_{(i//cols)*H}' for i in range(len(files)))
f.append(''.join(f'[v{i}]' for i in range(len(files))) + f'xstack=inputs={len(files)}:layout={lay}:fill=white')
subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(f), out], check=True)
