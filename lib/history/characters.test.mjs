import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {PATHS} from './content.mjs';
import {charactersFor,spriteStyle} from './characters.mjs';

test('sixteen player slots and thirty-two named NPCs use valid transparent atlases',async()=>{
  const players=new Set(),names=new Set(),files=new Set();
  for(const path of PATHS){
    const cast=charactersFor(path.id);
    players.add(`${cast.player.image}:${cast.player.quadrant}`);
    for(const npc of [cast.companion,cast.expert]){
      names.add(npc.name);assert.ok(npc.role);assert.ok(npc.row>=0&&npc.row<4&&npc.column>=0&&npc.column<4);
    }
    for(const sprite of Object.values(cast))files.add(sprite.image);
  }
  assert.equal(players.size,16);assert.equal(names.size,32);
  assert.equal(spriteStyle(charactersFor('4-D').player,3,1).backgroundPosition,'100% 100%');
  assert.equal(spriteStyle(charactersFor('1-A').player,0,0).backgroundPosition,'0% 0%');
  for(const file of files){
    const image=sharp(fileURLToPath(new URL(`../../public${file}`,import.meta.url)));
    const metadata=await image.metadata(),stats=await image.stats();
    assert.equal(metadata.channels,4,`${file}: real alpha required`);
    assert.equal(stats.channels[3].min,0,`${file}: transparent background required`);
    assert.equal(metadata.height/metadata.width,file.includes('players-')?2:1);
  }
});
