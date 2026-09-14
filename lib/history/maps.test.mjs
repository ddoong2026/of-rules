import test from 'node:test';
import assert from 'node:assert/strict';
import {walk,mapFor} from './maps.mjs';
import {PATHS} from './content.mjs';

test('all sixteen maps have distinct contexts; movement respects walls and bounds',()=>{
  assert.equal(new Set(PATHS.map(p=>mapFor(p.id).title)).size,16);
  assert.deepEqual(walk({x:480,y:500},10,-10),{x:490,y:490});
  assert.deepEqual(walk({x:30,y:500},-10,0),{x:30,y:500});
  assert.deepEqual(walk({x:200,y:218},0,-8),{x:200,y:218});
  assert.deepEqual(walk({x:920,y:600},20,20),{x:920,y:600});
});
