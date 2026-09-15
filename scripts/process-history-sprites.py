"""User-authorized background extraction/alignment; never redraws low-poly figures.

Tool dependencies are isolated in tmp/sprite-tools (rembg[cpu]).
Run with --preview to review a representative player and both NPC types first.
"""
from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tmp/sprite-tools'))
os.environ['U2NET_HOME'] = str(ROOT / 'tmp/sprite-models')
os.environ['OMP_NUM_THREADS'] = '2'
from PIL import Image
import numpy as np
from rembg import new_session
from scipy import ndimage

SOURCE = ROOT / 'assets/history/characters-source'
OUT = ROOT / 'public/history'
REVIEW = ROOT / 'tmp/sprite-review'
CELL = 192
# Reviewed source boundaries: generation did not consistently produce equal rows.
SHEETS = {
    'players-1-v1': ([0, 250, 481, 712, 942, 1173, 1404, 1635], [0,1,2,3,4,5,6,6]),
    'players-2-v1': ([0, 249, 497, 743, 981, 1237, 1490, 1774], [0,1,2,3,4,4,5,6]),
    'players-3-v1': ([0, 229, 449, 674, 895, 1122, 1347, 1559, 1774], list(range(8))),
    'players-4-v1': ([0, 242, 473, 702, 933, 1164, 1389, 1619], [0,1,2,3,4,5,6,6]),
    'npc-companions-v1': ([0, 324, 639, 945, 1254], list(range(4))),
    'npc-experts-v1': ([0, 331, 657, 970, 1254], list(range(4))),
}

def extract(crop, session):
    mask = np.asarray(session.predict(crop)[0])
    labels, count = ndimage.label(mask > 110)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    if count == 0 or sizes.max() < crop.width * crop.height * .08:
        raise ValueError('No reliable character silhouette')
    main = labels == sizes.argmax()
    # Limit model haze to a narrow edge of the largest connected character.
    edge = ndimage.binary_dilation(main, iterations=2)
    alpha = np.where(edge, np.clip((mask.astype(float)-70)*255/150, 0, 255), 0).astype('uint8')
    sprite = crop.convert('RGBA'); sprite.putalpha(Image.fromarray(alpha))
    return sprite.crop(sprite.getbbox())

def run():
    REVIEW.mkdir(parents=True, exist_ok=True)
    session = new_session('u2netp', providers=['CPUExecutionProvider'])
    preview = '--preview' in sys.argv
    names = ['players-1-v1','npc-companions-v1','npc-experts-v1'] if preview else SHEETS
    if '--companions-only' in sys.argv:
        names = ['npc-companions-v1']
    for name in names:
        source = Image.open(SOURCE / f'{name}.png').convert('RGB')
        bounds, rows = SHEETS[name]
        crops = {}
        for col in range(4):
            for row in sorted(set(rows)):
                if preview and (col != 0 or row != 0):
                    continue
                box = (round(col*source.width/4), bounds[row], round((col+1)*source.width/4), bounds[row+1])
                crop=source.crop(box)
                if name == 'npc-companions-v1' and col == 2 and row == 0:
                    # Earlier low-poly candidate has grain only, without the
                    # anachronistic metal sickle added by the later generator.
                    reference=Image.open(SOURCE/'npc-companions-reference.png').convert('RGB')
                    crop=reference.crop((627,0,940,324))
                crops[col,row] = extract(crop, session)
        if preview:
            sprite=crops[0,0]
            canvas=Image.new('RGBA', sprite.size, '#466653'); canvas.alpha_composite(sprite)
            canvas.convert('RGB').save(REVIEW / f'{name}-sample.png')
            print(name, 'sample ready', flush=True)
            continue
        atlas=Image.new('RGBA', (CELL*4,CELL*len(rows)))
        for col in range(4):
            # One scale per character across all poses avoids breathing/pulsing.
            scale=min(CELL*.82/max(crops[col,r].width for r in set(rows)), CELL*.88/max(crops[col,r].height for r in set(rows)))
            for destrow,srcrow in enumerate(rows):
                sprite=crops[col,srcrow]
                sprite=sprite.resize((round(sprite.width*scale),round(sprite.height*scale)),Image.Resampling.LANCZOS)
                atlas.alpha_composite(sprite,(col*CELL+(CELL-sprite.width)//2,destrow*CELL+round(CELL*.94)-sprite.height))
        atlas.save(OUT/f'{name}.png', optimize=True)
        print(name, 'saved', atlas.size, flush=True)

if __name__ == '__main__':
    run()
