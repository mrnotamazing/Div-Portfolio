# Generates a Taihu-style scholar's stone (water-worn limestone with through-holes)
# and exports it to site/public/assets/stone.glb.
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/taihu_stone.py -- [seed]
#
# Works headless on Blender 2.93+. Change the seed for a different stone.
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SEED = int(argv[0]) if argv else 7
random.seed(SEED)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets", "stone.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. base mass: tall, slightly twisted
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.0)
stone = bpy.context.active_object
stone.scale = (0.78, 0.62, 1.3)  # Z is up in Blender
bpy.ops.object.transform_apply(scale=True)

def add_displace(obj, tex_type, size, strength, name):
    tex = bpy.data.textures.new(name, type=tex_type)
    if tex_type == "CLOUDS":
        tex.noise_scale = size
        tex.noise_depth = 3
    elif tex_type == "VORONOI":
        tex.noise_scale = size
    m = obj.modifiers.new(name, "DISPLACE")
    m.texture = tex
    m.strength = strength
    m.texture_coords = "OBJECT"
    return m

add_displace(stone, "CLOUDS", 0.8, 0.32, "lumps")
bpy.ops.object.modifier_apply(modifier="lumps")

# 2. water-worn tunnels: elongated capsules punched through the mass
cutters = []
for i in range(6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1.0)
    c = bpy.context.active_object
    r = random.uniform(0.2, 0.32)
    c.scale = (r, r * random.uniform(0.8, 1.2), 1.6)            # long enough to pass right through
    c.location = (random.uniform(-0.3, 0.3), random.uniform(-0.1, 0.1), -0.85 + i * 0.34 + random.uniform(-0.1, 0.1))
    c.rotation_euler = Euler((math.pi / 2 + random.uniform(-0.5, 0.5), 0, random.uniform(-0.7, 0.7)))  # mostly front-to-back
    cutters.append(c)

bpy.context.view_layer.objects.active = stone
for i, c in enumerate(cutters):
    m = stone.modifiers.new(f"hole{i}", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.object = c
    m.solver = "EXACT"
    bpy.ops.object.modifier_apply(modifier=m.name)
for c in cutters:
    bpy.data.objects.remove(c, do_unlink=True)

# 3. fuse into one clean surface, soften (water), then add fine pitted texture (stone)
m = stone.modifiers.new("remesh", "REMESH")
m.mode = "VOXEL"
m.voxel_size = 0.028
bpy.ops.object.modifier_apply(modifier="remesh")

m = stone.modifiers.new("soften", "SMOOTH")
m.factor = 0.8
m.iterations = 4
bpy.ops.object.modifier_apply(modifier="soften")

add_displace(stone, "CLOUDS", 0.12, 0.05, "grain")
bpy.ops.object.modifier_apply(modifier="grain")
add_displace(stone, "VORONOI", 0.09, -0.02, "pits")
bpy.ops.object.modifier_apply(modifier="pits")

# 4. budget for the web: ~16k triangles
tris = sum(len(p.vertices) - 2 for p in stone.data.polygons)
m = stone.modifiers.new("decimate", "DECIMATE")
m.ratio = min(1.0, 16000 / max(tris, 1))
bpy.ops.object.modifier_apply(modifier="decimate")
stone.select_set(True)
bpy.ops.object.shade_smooth()

# center it
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
stone.location = (0, 0, 0)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False, export_normals=False,  # normals are recomputed on the web; sharing vertices halves the file
                         
                          export_texcoords=False, export_materials="NONE", export_yup=True, export_apply=True)
final_tris = sum(len(p.vertices) - 2 for p in stone.data.polygons)
print(f"STONE_OK seed={SEED} tris={final_tris} -> {OUT} ({os.path.getsize(OUT)//1024} KB)")
