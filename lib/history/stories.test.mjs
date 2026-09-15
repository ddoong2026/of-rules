import test from 'node:test';
import assert from 'node:assert/strict';
import {PATHS,STEPS} from './content.mjs';
import {STORIES,storyLines} from './stories.mjs';

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
