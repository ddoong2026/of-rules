import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {PATHS} from './content.mjs';
import {ARTIFACT_REFERENCES,PATH_CONTEXT} from './references.mjs';
import {explorationImage} from './exploration.mjs';
import {gameMapImage} from './maps.mjs';

test('every assigned artifact has a textbook reference and every selected image exists',()=>{
  const publicFile=src=>new URL(`../../public${src}`,import.meta.url);
  for(const path of PATHS){
    assert.ok(existsSync(publicFile(explorationImage(path.group))));
    assert.ok(existsSync(publicFile(gameMapImage(path.group))));
    if(!path.artifacts.length)assert.ok(PATH_CONTEXT[path.id],`${path.id} needs non-artifact evidence`);
    for(const artifact of path.artifacts){
      const source=ARTIFACT_REFERENCES[artifact];
      assert.ok(source?.pages,`${artifact} needs printed pages`);
      if(source.photo)assert.ok(existsSync(publicFile(source.photo)),source.photo);
    }
  }
});
