"""Prepare the approved untextured Meshy base in an isolated Blender process."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
source = root / 'public/history/character-base.glb'
output = root / 'public/history/character-web.glb'
work = root / 'assets/history'
work.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
minimum = min(v.z for v in points)
maximum = max(v.z for v in points)
height = maximum - minimum
for obj in objects:
    obj.data.transform(obj.matrix_world)
    obj.matrix_world.identity()
    for vertex in obj.data.vertices:
        vertex.co.z -= minimum
        vertex.co *= 1.6 / height
    # A neutral clay material makes the untextured, unverified status visible.
    material = bpy.data.materials.new('Untextured educational base - review pending')
    material.diffuse_color = (0.58, 0.48, 0.35, 1)
    material.use_nodes = True
    material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = material.diffuse_color
    material.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = 0.9
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    obj.name = 'HistoryMascot_review_pending'
bpy.ops.wm.save_as_mainfile(filepath=str(work / 'character-base.blend'))
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_animations=False, export_normals=True)
report = {'source': source.name, 'output': output.name, 'vertices': sum(len(o.data.vertices) for o in objects), 'polygons': sum(len(o.data.polygons) for o in objects), 'height_m': 1.6, 'textures': 0, 'rigged': False, 'review': 'geometry inspected; costume and colors pending', 'bytes': output.stat().st_size}
(work / 'character-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
