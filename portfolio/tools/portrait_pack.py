# Packs a portrait for the site from three same-size images (see the depth step in README):
#   color.png  - the photo
#   depth.png  - estimated depth, near = white (Apple Depth Anything V2 via Core ML)
#   matte.png  - person segmentation (Apple Vision)
# Output: public/assets/face.png (RGBA, only you) + public/assets/face_depth.png (L, depth)
#
#   python tools/portrait_pack.py <dir>
import sys, os
import numpy as np
from PIL import Image, ImageFilter

d = sys.argv[1]
color = Image.open(os.path.join(d, 'color.png')).convert('RGB')
depth = np.asarray(Image.open(os.path.join(d, 'depth.png')).convert('L')).astype(np.float32) / 255
matte = np.asarray(Image.open(os.path.join(d, 'matte.png')).convert('L')).astype(np.float32) / 255

# the matte also catches people behind you: keep only the near layer
h, w = depth.shape
core = depth[int(h * 0.25):int(h * 0.6), int(w * 0.35):int(w * 0.65)]   # your face
near = np.percentile(core, 50)
fg = np.clip((depth - (near - 0.32)) / 0.08, 0, 1)                        # soft cut ~0.3 behind the face
alpha = np.clip(matte * fg, 0, 1)
a_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))

# depth relative to the face: 1 = nose tip, 0 = back of the hair / shoulders
rel = np.clip((depth - (near - 0.32)) / max(0.05, depth[alpha > 0.5].max() - (near - 0.32)), 0, 1)
d_img = Image.fromarray((rel * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))

rgba = color.copy(); rgba.putalpha(a_img)
bb = a_img.point(lambda v: 255 if v > 40 else 0).getbbox()
rgba, d_img = rgba.crop(bb), d_img.crop(bb)
size = (min(560, rgba.width), round(min(560, rgba.width) * rgba.height / rgba.width))
rgba, d_img = rgba.resize(size, Image.LANCZOS), d_img.resize(size, Image.LANCZOS)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets')
rgba.save(os.path.join(out, 'face.png'), optimize=True)
d_img.save(os.path.join(out, 'face_depth.png'), optimize=True)
prev = Image.new('RGB', (size[0] * 2, size[1]), (236, 235, 230))
bg = Image.new('RGB', size, (236, 235, 230)); bg.paste(rgba, mask=rgba.split()[3])
prev.paste(bg, (0, 0)); prev.paste(d_img.convert('RGB'), (size[0], 0))
prev.save(os.path.join(d, 'pack_preview.png'))
print('PORTRAIT_OK', size, f"{os.path.getsize(os.path.join(out, 'face.png'))//1024} KB + {os.path.getsize(os.path.join(out, 'face_depth.png'))//1024} KB")
