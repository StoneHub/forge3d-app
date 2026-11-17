"""Turn a stop-motion frame timeline into an MP4 with an eased, drawn cursor.

Usage: python3 compose.py FRAMES_DIR OUT.mp4 [crop x0,y0,x1,y1] [width]
"""
import json, sys, os, subprocess
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
crop = tuple(map(int, sys.argv[3].split(','))) if len(sys.argv) > 3 else None
width = int(sys.argv[4]) if len(sys.argv) > 4 else 1280
segs = json.load(open(f'{d}/timeline.json'))
FPS = 30
def cursor_img(pressed):
    s = 2; im = Image.new('RGBA', (26*s, 26*s), (0,0,0,0)); dr = ImageDraw.Draw(im)
    pts = [(3,2),(3,18),(7.5,13.8),(10.6,20.5),(13.4,19.3),(10.4,12.7),(16.5,12.5)]
    if pressed: dr.ellipse([(0,0),(14*s,14*s)], fill=(79,195,247,110))
    dr.polygon([(x*s,y*s) for x,y in pts], fill='white', outline='black', width=2)
    return im.resize((26,26), Image.LANCZOS)
cur = {False: cursor_img(False), True: cursor_img(True)}
cache = {}
def ease(t): return 2*t*t if t < .5 else 1-(-2*t+2)**2/2
proc = None
for sg in segs:
    base = cache.get(sg['img']) or Image.open(sg['img']).convert('RGB'); cache[sg['img']] = base
    n = max(1, round(sg['ms'] * FPS / 1000))
    for i in range(n):
        t = ease((i+1)/n)
        x = sg['from']['x'] + (sg['to']['x']-sg['from']['x'])*t; y = sg['from']['y'] + (sg['to']['y']-sg['from']['y'])*t
        f = base.copy(); f.paste(cur[sg['pressed']], (int(x-3), int(y-2)), cur[sg['pressed']])
        if crop: f = f.crop(crop)
        h = round(f.height * width / f.width / 2) * 2
        f = f.resize((width, h), Image.LANCZOS)
        if proc is None:
            proc = subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{width}x{h}','-r',str(FPS),'-i','-','-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','-an',out], stdin=subprocess.PIPE)
        proc.stdin.write(f.tobytes())
proc.stdin.close(); proc.wait()
print(out, os.path.getsize(out))
