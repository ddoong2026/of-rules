import test from 'node:test';
import assert from 'node:assert/strict';
import {createLesson,applyOperation,studentView} from './state.mjs';
import {PATHS,REACTIONS} from './content.mjs';
const roster=Array.from({length:16},(_,i)=>({id:`s${i}`,name:`학생${i}`}));
const op=(state,id,type,rest={},teacher=false,preview=false)=>applyOperation(state,id,teacher,{id:crypto.randomUUID(),type,...rest},preview);
test('sixteen distinct assignments persist, and unreleased content cannot start',()=>{
  const state=createLesson(roster);assert.equal(Object.keys(state.students).length,16);assert.equal(new Set(Object.values(state.students).map(s=>s.path)).size,16);
  assert.throws(()=>op(state,'teacher','move',{targets:['s0'],activity:'관찰'},true),/검수/);
  assert.throws(()=>op(state,'s0','approve'),/교사/);
  assert.throws(()=>studentView(state,'outsider'),/학생/);
});
test('private observations, optimistic revisions, and idempotent drafts',()=>{
  let state=createLesson(roster);
  const operation={id:'draft-1',type:'draft',base:0,draft:{notes:[{id:'n',kind:'보이는 것',image:1,x:.25,y:.5,text:'사람'}],diary:{answers:{},text:'내 생각'},feedbackDraft:{reaction:'',text:''}}};
  state=applyOperation(state,'s0',false,operation);
  assert.equal(studentView(state,'s1').notes.length,0);
  assert.deepEqual(applyOperation(state,'s0',false,operation),state);
  assert.throws(()=>applyOperation(state,'s0',false,{...operation,id:'stale'}),/CONFLICT/);
  state=op(state,'t','publish',{},true);assert.equal(studentView(state,'s1').notes[0].x,.25);
});
test('latest movement wins, forced blank submissions remain blank, no free unlock',()=>{
  let state=createLesson(roster);state.students.s0.activity='일기';
  state=op(state,'t','move',{targets:['s0'],activity:'관찰'},true,true);
  state=op(state,'t','move',{targets:['s0'],activity:'정리'},true,true);
  state=op(state,'s0','ack',{sequence:1});assert.equal(state.students.s0.activity,'일기');
  state=op(state,'s0','ack',{sequence:2});assert.equal(state.students.s0.activity,'정리');
  assert.equal(state.students.s1.activity,'준비');assert.equal(state.students.s0.diary.versions[0].text,'');assert.equal(state.students.s0.grants.length,0);
  assert.equal(state.students.s0.supplement,true);
});
test('feedback excludes self, binds diary version, needs approval, and only opens target',()=>{
  let state=createLesson(roster);
  for(const s of Object.values(state.students)){s.diary.versions=[{version:1,text:'생각',answers:{},path:s.path}];s.activity='피드백';}
  state=op(state,'t','assignFeedback',{},true);
  for(const s of Object.values(state.students))assert.notEqual(s.target.recipient,s.id);
  assert.equal(new Set(Object.values(state.students).map(s=>s.target.recipient)).size,16);
  const expected=state.students.s0.target.path;
  state.students.s0.feedbackDraft={reaction:REACTIONS[0],text:'잘 읽었어'};
  state=op(state,'s0','feedback');assert.equal(state.students.s0.grants.length,0);
  state=op(state,'t','approve',{},true);assert.deepEqual(state.students.s0.grants,[expected]);
  assert.equal(state.students.s1.grants.length,0);
  state=op(state,'t','approve',{},true);assert.deepEqual(state.students.s0.grants,[expected]);
});
test('blank feedback cannot unlock, and extra attempts preserve assigned progress',()=>{
  let state=createLesson(roster);state.students.s0.activity='피드백';state.students.s0.target={recipient:'s1',path:'1-B',version:1};
  assert.throws(()=>op(state,'s0','feedback'),/댓글/);
  state=op(state,'t','move',{targets:['s0'],activity:'3D'},true,true);state=op(state,'s0','ack',{sequence:1});
  state=op(state,'t','approve',{},true);assert.equal(state.students.s0.grants.length,0);
  assert.throws(()=>op(state,'s0','step',{path:'1-B',step:0},false,true),/승인/);
  state.students.s0.grants=['1-B'];state.students.s0.attempts['1-A']={checkpoint:2,seen:[0],complete:false};
  state=op(state,'s0','step',{path:'1-B',step:0,mode:'alternative'},false,true);
  assert.equal(state.students.s0.attempts['1-A'].checkpoint,2);assert.equal(state.students.s0.attempts['1-B'].mode,'alternative');
  assert.equal(PATHS.length,16);
});
test('research autosaves shared cards and rejects concurrent overwritten edits',()=>{
  let state=createLesson(roster);
  const draft={notes:[],diary:{answers:{},text:''},feedbackDraft:{reaction:'',text:''},research:{'card-1':{artifact:'주먹 도끼',base:0,name:'주먹 도끼',usage:'도구',source:'17쪽'}}};
  state=op(state,'s0','draft',{base:0,draft});
  assert.equal(studentView(state,'s1').cards.length,1);
  assert.equal(studentView(state,'s4').cards.length,0);
  assert.throws(()=>op(state,'s1','draft',{base:0,draft:{...draft,research:{'card-1':{...draft.research['card-1'],usage:'다른 내용'}}}}),/CONFLICT/);
  state.students.s0.activity='조사';
  state=op(state,'t','move',{targets:['s0'],activity:'일기'},true,true);
  state=op(state,'s0','ack',{sequence:1});
  assert.equal(state.cards['card-1'].status,'강제 제출');
  assert.equal(state.cards['card-1'].usage,'도구');
});
