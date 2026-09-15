import test from 'node:test';
import assert from 'node:assert/strict';
import {createLesson,applyOperation,studentView} from './state.mjs';
import {PATHS,REACTIONS} from './content.mjs';
const roster=Array.from({length:16},(_,i)=>({id:`s${i}`,name:`학생${i}`}));
const op=(state,id,type,rest={},teacher=false,preview=false)=>applyOperation(state,id,teacher,{id:crypto.randomUUID(),type,...rest},preview);

test('finishing own research unlocks help across groups without changing ownership or bypassing conflicts',()=>{
  let state=createLesson(roster);
  for(const s of Object.values(state.students))s.activity='조사';
  const save=(actor,research)=>op(state,actor,'draft',{base:state.students[actor].revision,draft:{notes:[],diary:{answers:{},text:''},feedbackDraft:{reaction:'',text:''},research}});
  const foreign={artifact:PATHS[4].artifacts[0],name:'친구 자료',usage:'친구의 조사',source:'교과서',base:0};
  state=save('s4',{'friend-card':foreign});
  assert.equal(studentView(state,'s0').canHelpResearch,false);
  assert.throws(()=>save('s0',{'friend-card':{...foreign,base:1,usage:'도움'}}),/내 조사/);
  for(const [i,artifact] of PATHS[0].artifacts.entries()){
    state=save('s0',{...state.students.s0.research,[`own-${i}`]:{artifact,name:artifact,usage:'조사 완료',source:'교과서',base:0}});
    state=op(state,'s0','submitResearch',{cardId:`own-${i}`});
  }
  assert.equal(studentView(state,'s0').canHelpResearch,true);
  assert.ok(studentView(state,'s0').cards.some(c=>c.id==='friend-card'));
  state=save('s0',{...state.students.s0.research,'friend-card':{...foreign,base:1,usage:'친구와 보완한 조사'}});
  assert.equal(state.cards['friend-card'].group,PATHS[4].group);
  assert.equal(state.cards['friend-card'].owner,'s4');
  assert.deepEqual(state.cards['friend-card'].helpers,['s4','s0']);
  assert.throws(()=>save('s4',{'friend-card':{...foreign,base:1,usage:'충돌하는 수정'}}),/CONFLICT/);
  assert.throws(()=>save('s0',{'friend-card':{...foreign,artifact:PATHS[0].artifacts[0],base:2}}),/올바르지/);
  state=op(state,'s0','submitResearch',{cardId:'friend-card'});
  assert.equal(state.cards['friend-card'].status,'제출');
});
test('sixteen distinct assignments persist, and unreleased content cannot start',()=>{
  const state=createLesson(roster);assert.equal(Object.keys(state.students).length,16);assert.equal(new Set(Object.values(state.students).map(s=>s.path)).size,16);
  assert.throws(()=>op(state,'teacher','move',{targets:['s0'],activity:'관찰'},true),/검수/);
  assert.throws(()=>op(state,'s0','approve'),/교사/);
  assert.throws(()=>studentView(state,'outsider'),/학생/);
});
test('private observations, optimistic revisions, and idempotent drafts',()=>{
  let state=createLesson(roster);
  const operation={id:'draft-1',type:'draft',base:0,draft:{notes:[{id:'n',kind:'보이는 것',image:1,x:.25,y:.5,noteX:.6,noteY:.3,text:'사람'}],diary:{answers:{},text:'내 생각'},feedbackDraft:{reaction:'',text:''}}};
  state=applyOperation(state,'s0',false,operation);
  assert.equal(state.students.s0.notes[0].noteX,.6);
  assert.equal(state.students.s0.notes[0].noteY,.3);
  assert.throws(()=>applyOperation(state,'s0',false,{...operation,id:'bad-position',base:1,draft:{...operation.draft,notes:[{...operation.draft.notes[0],noteX:Infinity}]}}),/메모지 위치/);
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

test('completed map can share its saved diary without leaving exploration',()=>{
  let state=createLesson(roster);
  const s=state.students.s0;s.activity='3D';
  s.diary.answers=Object.fromEntries(PATHS[0].questions.map(q=>[q.id,q.answer]));
  s.diary.text='주먹 도끼를 챙기며 가족과 함께 떠날 생각을 했다.';
  assert.throws(()=>op(state,'s0','diary'),/체험/);
  for(let step=0;step<7;step++)state=op(state,'s0','step',{path:s.path,step,mode:'2D'},false,true);
  state=op(state,'s0','diary');
  assert.equal(state.students.s0.activity,'3D');
  assert.equal(state.students.s0.diary.versions.length,1);
  assert.deepEqual(state.students.s0.diary.versions[0].answers,s.diary.answers);
  state=op(state,'s0','diary');
  assert.equal(state.students.s0.diary.versions.length,1);
});

test('teacher pause blocks student mutations in every activity and permits resume and commands',()=>{
  for(const activity of ['준비','관찰','조사','3D','일기','피드백','정리']) {
    let state=createLesson(roster);state.students.s0.activity=activity;
    assert.throws(()=>op(state,'s0','lock',{locked:true}),/교사/);
    state=op(state,'teacher','lock',{locked:true},true);
    assert.equal(studentView(state,'s0').locked,true);
    for(const type of ['draft','step','diary','feedback','submitResearch','enterDiary'])assert.throws(()=>op(state,'s0',type),/잠시 멈췄/);
    state=op(state,'s0','heartbeat');
    state=op(state,'teacher','move',{activity:'준비',targets:['s0']},true,true);
    state=op(state,'s0','ack',{sequence:state.sequence});
    assert.equal(state.students.s0.activity,'준비');
    state=op(state,'teacher','lock',{locked:false},true);
    assert.equal(studentView(state,'s0').locked,false);
    const student=state.students.s0;
    state=op(state,'s0','draft',{base:student.revision,draft:{notes:student.notes,diary:student.diary,feedbackDraft:student.feedbackDraft}});
    assert.equal(state.students.s0.revision,student.revision+1);
  }
});

test('teacher can move any note while paused and stale student drafts preserve teacher placement',()=>{
  let state=createLesson(roster);
  const note={id:'note-1',image:1,x:.4,y:.6,kind:'보이는 것',text:'처음 기록',noteX:.8,noteY:.3};
  state.students.s0.notes=[note];
  const draft={notes:[{...note,text:'입력 중인 새 내용'}],diary:state.students.s0.diary,feedbackDraft:state.students.s0.feedbackDraft};
  assert.throws(()=>op(state,'s1','moveNote',{owner:'s0',noteId:note.id,noteX:.1,noteY:.1}),/교사/);
  state=op(state,'teacher','lock',{locked:true},true);
  for(const [noteX,noteY] of [[.05,.05],[.4,.05],[.8,.05],[.05,.4],[.8,.4],[.05,.8],[.4,.8],[.8,.8]]) {
    state=op(state,'teacher','moveNote',{owner:'s0',noteId:note.id,noteX,noteY},true);
    assert.equal(state.students.s0.notes[0].noteX,noteX);
  }
  assert.throws(()=>op(state,'teacher','moveNote',{owner:'s0',noteId:note.id,noteX:NaN,noteY:0},true),/위치/);
  state=op(state,'teacher','lock',{locked:false},true);
  state=op(state,'s0','draft',{base:0,draft});
  assert.equal(state.students.s0.notes[0].text,'입력 중인 새 내용');
  assert.equal(state.students.s0.notes[0].noteY,.8);
  assert.equal(state.students.s0.notes[0].positionRevision,8);
  assert.equal(state.students.s0.notes[0].boardVersion,2);
  const fresh=state.students.s0;
  state=op(state,'s0','draft',{base:fresh.revision,draft:{...draft,notes:[{...fresh.notes[0],noteX:.2}]}});
  assert.equal(state.students.s0.notes[0].noteX,.2);
});


test('teacher controls snapshot, live and hidden student note visibility',()=>{
  let state=createLesson(roster);
  state.students.s0.notes=[{id:'n',image:1,x:.5,y:.5,kind:'보이는 것',text:'처음'}];
  assert.equal(studentView(state,'s1').notes.length,0);
  assert.throws(()=>op(state,'s0','noteVisibility',{mode:'live'}),/교사/);
  state=op(state,'t','publish',{},true);
  state.students.s0.notes[0].text='수정';
  state.students.s0.notes.push({id:'new',image:1,x:.2,y:.2,kind:'궁금한 것',text:'새 메모'});
  assert.equal(studentView(state,'s1').notes.length,1);
  assert.equal(studentView(state,'s1').notes[0].text,'처음');
  assert.equal(state.students.s0.notes[0].text,'수정');
  state=op(state,'t','noteVisibility',{mode:'live'},true);
  assert.equal(studentView(state,'s1').notes.length,2);
  assert.equal(studentView(state,'s1').notes[0].text,'수정');
  state=op(state,'t','noteVisibility',{mode:'hidden'},true);
  assert.equal(studentView(state,'s1').notes.length,0);
  assert.equal(studentView(state,'s0').notes.length,2);
  state=op(state,'t','publish',{},true);
  assert.equal(studentView(state,'s1').notes.length,2);
});

test('integrated diary requires all correct quizzes and personal reflection, and handles old diary commands',()=>{
  let state=createLesson(roster);
  state=op(state,'t','move',{activity:'일기',targets:['s0']},true,true);
  state=op(state,'s0','ack',{sequence:1});
  assert.equal(state.students.s0.activity,'3D');
  state.students.s0.attempts['1-A']={checkpoint:6,seen:[0,1],complete:false};
  assert.throws(()=>op(state,'s0','step',{step:6,mode:'2D'},false,true),/퀴즈/);
  state.students.s0.diary.answers=Object.fromEntries(PATHS[0].questions.map(q=>[q.id,q.answer]));
  assert.throws(()=>op(state,'s0','step',{step:6,mode:'2D'},false,true),/감정/);
  state.students.s0.diary.text='동굴을 떠나는 것이 두렵지만 가족과 함께여서 안심했다.';
  state=op(state,'s0','step',{step:6,mode:'2D'},false,true);
  state=op(state,'s0','diary');
  assert.equal(state.students.s0.diary.versions.length,1);
});
