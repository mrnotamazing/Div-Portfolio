# Cuts the hair out of a back-of-head photo -> public/assets/hair.png (RGBA, hair only).
# The site turns every opaque pixel into particles; brightness becomes shine, the silhouette becomes depth.
#
#   python tools/hair_cutout.py <photo> [x0 y0 x1 y1] [--exclude x0 y0 x1 y1]...
#
# The box crops to the head; --exclude boxes remove things like sunglasses.
import sys, os
import numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
src = args.pop(0)
excl = []
while '--exclude' in args:
    i = args.index('--exclude')
    excl.append(tuple(int(v) for v in args[i + 1:i + 5]))
    del args[i:i + 5]
box = tuple(int(v) for v in args[:4]) if len(args) >= 4 else None

img = Image.open(src).convert('RGB')
if box:
    img = img.crop(box)
a = np.asarray(img).astype(np.float32) / 255.0
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
warm = (r - b)                                     # skin is warm; dark hair is neutral
mask = (lum < 0.64) & ~((warm > 0.11) & (lum > 0.32))   # skin = bright AND clearly warm; brown hair highlights stay
for (x0, y0, x1, y1) in excl:
    ox, oy = (box[0], box[1]) if box else (0, 0)
    mask[max(0, y0 - oy):max(0, y1 - oy), max(0, x0 - ox):max(0, x1 - ox)] = False

# clean: keep the largest connected blob (the head of hair), soften the edge
m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MedianFilter(5))  # close small holes
mask = np.asarray(m) > 127
try:
    from collections import deque
    h, w = mask.shape
    seen = np.zeros_like(mask)
    best = None
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            if mask[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = True; pts = []
                while q:
                    cy, cx = q.popleft(); pts.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                if best is None or len(pts) > len(best):
                    best = pts
    keep = np.zeros_like(mask)
    ys, xs = zip(*best)
    keep[list(ys), list(xs)] = True
    mask = keep
except Exception as e:
    print('blob step skipped:', e)

alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
out = img.copy()
out.putalpha(alpha)
# trim to content and cap the size (the site samples it at ~200px anyway)
bb = alpha.getbbox()
out = out.crop(bb)
out.thumbnail((520, 520))
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'hair.png')
out.save(dst, optimize=True)
prev = Image.new('RGB', out.size, (236, 235, 230))
prev.paste(out, mask=out.split()[3])
prev.save(os.environ.get('PREVIEW', '/dev/null'), format='PNG') if os.environ.get('PREVIEW') else None
print('HAIR_OK', out.size, f'{os.path.getsize(dst)//1024} KB', f'coverage {mask.mean():.2f}')
