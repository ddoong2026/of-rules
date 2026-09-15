import test from 'node:test';
import assert from 'node:assert/strict';
import {PATHS,STEPS} from './content.mjs';
import {portraitStyle} from './characters.mjs';
import {mapFor} from './maps.mjs';
import {existsSync} from 'node:fs';
import {STORIES,storyLines,questDialogue} from './stories.mjs';

test('every assignment has a complete story, seven scenes and a diary bridge',()=>{
  assert.equal(Object.keys(STORIES).length,PATHS.length);
  assert.equal(new Set(Object.values(STORIES).map(s=>s.title)).size,PATHS.length);
  for(const path of PATHS){
    const story=STORIES[path.id],lines=storyLines(path);
    for(const field of ['title','role','opening','speaker','dialogue','turn','reflection'])assert.ok(story[field]?.trim(),`${path.id}: ${field}`);
    assert.equal(lines.length,STEPS.length);
    assert.equal(lines[5],path.questions[0].prompt);
    assert.equal(lines[6],story.reflection);
  }
});

test('all 112 quests have player and NPC dialogue, portraits, and preserve both local places',()=>{
  for(const path of PATHS){
    const spoken=STEPS.flatMap((_,step)=>questDialogue(path,step).map(t=>t.text));
    assert.equal(new Set(spoken).size,spoken.length,`${path.id}: repeated spoken line`);
    for(let step=0;step<STEPS.length;step++){
      const turns=questDialogue(path,step);
      assert.ok(turns.some(t=>t.speaker==='player'));
      assert.ok(turns.some(t=>t.speaker!=='player'));
      for(const turn of turns){
        assert.ok(turn.text.trim());
        const portrait=portraitStyle(path.id,turn.speaker);
        assert.ok(!JSON.stringify(portrait).includes('NaN'));
        const file=portrait.backgroundImage.slice(5,-1);
        assert.ok(existsSync(new URL('../../public/'+file,import.meta.url)));
      }
    }
    assert.ok(questDialogue(path,0).some(t=>t.text.includes(mapFor(path.id).left)));
    assert.ok(questDialogue(path,3).some(t=>t.text.includes(mapFor(path.id).right)));
  }
});
