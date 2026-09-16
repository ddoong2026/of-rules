import test from 'node:test';
import assert from 'node:assert/strict';
import {createLesson,applyOperation,studentView,groupComplete,unlockStatus,reviewQuizScore,reviewQuestions,groupScore,groupScores} from './state.mjs';
import {PATHS,ACTIVITIES} from './content.mjs';
import {ARTIFACT_SPOTS} from './exploration.mjs';
const roster=Array.from({length:16},(_,i)=>({id:`s${i}`,name:`학생${i}`}));
const op=(state,id,type,rest={},teacher=false,preview=false)=>applyOperation(state,id,teacher,{id:crypto.randomUUID(),type,...rest},preview);

test('review questions retain correct answers and stay within the related picture group',()=>{
  for(const group of [1,2,3,4]) {
    const questions=reviewQuestions(group);
    assert.equal(questions.length,8);
    assert.equal(new Set(questions.map(q=>q.id)).size,8);
    for(const q of questions) {
      const original=PATHS.filter(p=>p.group===group).flatMap(p=>p.questions).find(item=>item.id===q.id);
      assert.equal(q.options[q.answer],original.options[original.answer]);
      assert.deepEqual([...q.options].sort(),[...original.options].sort());
    }
  }
});

function completePath(state,id,pathId) {
  const s=state.students[id];
  if(pathId===s.path) {
    const p=PATHS.find(x=>x.id===pathId);
    s.diary.answers=Object.fromEntries(p.questions.map(q=>[q.id,q.answer]));
    s.diary.text='그때의 생활을 떠올리며 내 마음을 기록했다.';
  }
  for(let step=0;step<7;step++)state=op(state,id,'step',{path:pathId,step,mode:'2D'});
  return state;
}

test('same-group map unlock requires the own map finished first, then three correct review answers',()=>{
  let state=createLesson(roster);
  const id='s0';
  state.students[id].activity='3D';
  const home=state.students[id].group,own=state.students[id].path;
  const sibling=PATHS.find(p=>p.group===home&&p.id!==own).id;
  assert.throws(()=>op(state,id,'unlockMap',{path:sibling}),/먼저 완료/);
  state=completePath(state,id,own);
  assert.equal(state.students[id].attempts[own].complete,true);
  assert.throws(()=>op(state,id,'unlockMap',{path:sibling}),/퀴즈/);
  const questions=reviewQuestions(home);
  for(const q of questions.slice(0,2))state=op(state,id,'answerReviewQuiz',{group:home,questionId:q.id,choice:q.answer});
  assert.throws(()=>op(state,id,'unlockMap',{path:sibling}),/퀴즈/);
  state=op(state,id,'answerReviewQuiz',{group:home,questionId:questions[2].id,choice:questions[2].answer});
  assert.equal(reviewQuizScore(state.students[id],home),3);
  state=op(state,id,'unlockMap',{path:sibling});
  assert.deepEqual(state.students[id].grants,[sibling]);
  assert.throws(()=>op(state,id,'unlockMap',{path:sibling}),/이미/);
  assert.throws(()=>op(state,id,'unlockMap',{path:'not-a-path'}),/존재하지/);
});

test('unlocking a sibling map preserves the assigned map\'s own progress',()=>{
  let state=createLesson(roster);
  const id='s0';
  state.students[id].activity='3D';
  const own=state.students[id].path;
  assert.throws(()=>op(state,id,'step',{path:'4-D',step:0}),/체험할 수 있는 맵이 아닙니다/);
  state.students[id].attempts[own]={checkpoint:2,seen:[0],complete:false};
  state.students[id].grants=['1-B'];
  state=op(state,id,'step',{path:'1-B',step:0,mode:'alternative'});
  assert.equal(state.students[id].attempts[own].checkpoint,2);
  assert.equal(state.students[id].attempts['1-B'].mode,'alternative');
});

test('cross-group map unlock requires the whole home group finished, that group reviewed, and three correct answers',()=>{
  let state=createLesson(roster);
  const id='s0';
  state.students[id].activity='3D';
  const home=state.students[id].group,own=state.students[id].path;
  state=completePath(state,id,own);
  const homeQuestions=reviewQuestions(home);
  for(const q of homeQuestions.slice(0,3))state=op(state,id,'answerReviewQuiz',{group:home,questionId:q.id,choice:q.answer});
  for(const p of PATHS.filter(x=>x.group===home&&x.id!==own)) {
    state=op(state,id,'unlockMap',{path:p.id});
    state=completePath(state,id,p.id);
  }
  assert.equal(groupComplete(state.students[id],home),true);
  const otherGroup=home===1?2:1;
  const target=PATHS.find(p=>p.group===otherGroup).id;
  assert.throws(()=>op(state,id,'unlockMap',{path:target}),/조사 카드/);
  assert.throws(()=>op(state,id,'reviewGroup',{group:home}),/우리 모둠/);
  state=op(state,id,'reviewGroup',{group:otherGroup});
  assert.deepEqual(state.students[id].reviewedGroups,[otherGroup]);
  assert.throws(()=>op(state,id,'unlockMap',{path:target}),/퀴즈/);
  const otherQuestions=reviewQuestions(otherGroup);
  for(const q of otherQuestions.slice(0,3))state=op(state,id,'answerReviewQuiz',{group:otherGroup,questionId:q.id,choice:q.answer});
  state=op(state,id,'unlockMap',{path:target});
  assert.ok(state.students[id].grants.includes(target));
  assert.equal(unlockStatus(state.students[id],target).already,true);
});

test('group score sums completed maps across members and only reaches students once the teacher publishes it',()=>{
  let state=createLesson(roster);
  const groupOne=Object.values(state.students).filter(s=>s.group===1).map(s=>s.id);
  assert.equal(groupScore(state,1),0);
  const id=groupOne[0];
  state.students[id].attempts[state.students[id].path]={checkpoint:7,seen:[0,1],complete:true};
  assert.equal(groupScore(state,1),1);
  state.students[id].grants=['1-B'];
  state.students[id].attempts['1-B']={checkpoint:7,seen:[0,1],complete:true};
  assert.equal(groupScore(state,1),2);
  assert.deepEqual(groupScores(state).find(g=>g.group===1),{group:1,score:2});
  assert.equal(studentView(state,id).scores,null);
  assert.equal(studentView(state,id).scoreVisible,false);
  assert.throws(()=>op(state,id,'scoreVisibility',{visible:true}),/교사/);
  assert.throws(()=>op(state,'t','scoreVisibility',{visible:'yes'},true),/공개 상태/);
  state=op(state,'t','scoreVisibility',{visible:true},true);
  assert.equal(studentView(state,id).scoreVisible,true);
  assert.ok(studentView(state,id).scores.some(g=>g.group===1&&g.score===2));
});

test('extra research opens only after every picture target is submitted and remains shared and saved',()=>{
  for(const group of [1,2,3,4]) {
    let state=createLesson(roster);
    const actor=Object.values(state.students).find(s=>s.group===group).id;
    state.students[actor].activity='조사';
    const save=research=>op(state,actor,'draft',{base:state.students[actor].revision,draft:{...state.students[actor],research}});
    const extra={artifact:'추가 생활 자료',extra:true,name:'추가 생활 자료',usage:'생활을 알아보았다',source:'',base:0};
    assert.equal(studentView(state,actor).canAddResearch,false);
    assert.throws(()=>save({extra}),/모둠 그림/);
    const artifacts=[...new Set(ARTIFACT_SPOTS[group].map(([artifact])=>artifact))];
    for(const [i,artifact] of artifacts.entries()) {
      state=save({...state.students[actor].research,[`base-${i}`]:{artifact,name:artifact,usage:'쓰임',source:'교과서',base:0}});
      assert.equal(studentView(state,actor).canAddResearch,false);
      state=op(state,actor,'submitResearch',{cardId:`base-${i}`});
    }
    assert.equal(studentView(state,actor).canAddResearch,true);
    state=save({...state.students[actor].research,extra});
    assert.equal(studentView(state,actor).canAddResearch,true);
    assert.throws(()=>op(state,actor,'submitResearch',{cardId:'extra'}),/자료 URL/);
    state=save({...state.students[actor].research,extra:{...state.students[actor].research.extra,source:'https://museum.example/artifact'}});
    state=op(state,actor,'submitResearch',{cardId:'extra'});
    const peer=Object.values(state.students).find(s=>s.group===group&&s.id!==actor).id;
    assert.equal(studentView(state,peer).cards.find(c=>c.id==='extra').status,'제출');
    assert.equal(state.cards.extra.extra,true);
    state=save({...state.students[actor].research,'base-0':{...state.students[actor].research['base-0'],usage:'수정 중'}});
    assert.equal(studentView(state,actor).canAddResearch,false);
    assert.throws(()=>save({...state.students[actor].research,another:{...extra,artifact:'다음 조사'}}),/모둠 그림/);
  }
});

test('only teachers can distribute lessons, and withdrawing distribution preserves student work',()=>{
  let state=createLesson(roster);
  state.students.s0.diary.text='보존할 기록';
  assert.throws(()=>op(state,'s0','distribution',{distributed:true}),/교사/);
  assert.throws(()=>op(state,'teacher','distribution',{distributed:'yes'},true),/배포 상태/);
  state=op(state,'teacher','distribution',{distributed:true},true);
  assert.equal(state.distributed,true);
  state=op(state,'teacher','distribution',{distributed:false},true);
  assert.equal(state.distributed,false);
  assert.equal(state.students.s0.diary.text,'보존할 기록');
});

test('finishing own research unlocks help across groups without changing ownership or bypassing conflicts',()=>{
  let state=createLesson(roster);
  for(const s of Object.values(state.students))s.activity='조사';
  const save=(actor,research)=>op(state,actor,'draft',{base:state.students[actor].revision,draft:{notes:[],diary:{answers:{},text:''},research}});
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
test('sixteen distinct assignments persist and teacher access remains required',()=>{
  const state=createLesson(roster);assert.equal(Object.keys(state.students).length,16);assert.equal(new Set(Object.values(state.students).map(s=>s.path)).size,16);
  assert.throws(()=>op(state,'s0','move',{targets:['s0'],activity:'관찰'}),/교사/);
  assert.throws(()=>op(state,'s0','scoreVisibility',{visible:true}),/교사/);
  assert.throws(()=>studentView(state,'outsider'),/학생/);
});

test('real lessons allow all activities and all sixteen unreviewed maps without a preview override',()=>{
  let state=createLesson(roster);
  assert.ok(PATHS.every(p=>!p.ready));
  for(const activity of ACTIVITIES){
    state=op(state,'teacher','move',{targets:roster.map(s=>s.id),activity},true);
    for(const {id} of roster){
      state=op(state,id,'ack',{sequence:state.sequence});
      assert.equal(studentView(state,id).me.activity,activity);
    }
  }
  state=op(state,'teacher','move',{targets:roster.map(s=>s.id),activity:'3D'},true);
  for(const {id} of roster){
    state=op(state,id,'ack',{sequence:state.sequence});
    const s=state.students[id],path=PATHS.find(p=>p.id===s.path);
    assert.throws(()=>op(state,id,'step',{path:PATHS.find(p=>p.id!==s.path).id,step:0}),/체험할 수 있는 맵이 아닙니다/);
    s.diary.answers=Object.fromEntries(path.questions.map(q=>[q.id,q.answer]));
    s.diary.text='그때의 생활을 떠올리며 내 마음을 기록했다.';
    for(let step=0;step<7;step++)state=op(state,id,'step',{path:path.id,step,mode:'2D'});
    assert.equal(state.students[id].attempts[path.id].complete,true);
    state=op(state,id,'diary');
    assert.equal(state.students[id].diary.versions.length,1);
  }
});
test('private observations, optimistic revisions, and idempotent drafts',()=>{
  let state=createLesson(roster);
  const operation={id:'draft-1',type:'draft',base:0,draft:{notes:[{id:'n',kind:'보이는 것',image:1,x:.25,y:.5,noteX:.6,noteY:.3,text:'사람'}],diary:{answers:{},text:'내 생각'}}};
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
test('research autosaves shared cards and rejects concurrent overwritten edits',()=>{
  let state=createLesson(roster);
  const draft={notes:[],diary:{answers:{},text:''},research:{'card-1':{artifact:'주먹 도끼',base:0,name:'주먹 도끼',usage:'도구',source:'17쪽'}}};
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
  for(const activity of ['준비','관찰','조사','3D','일기','정리']) {
    let state=createLesson(roster);state.students.s0.activity=activity;
    assert.throws(()=>op(state,'s0','lock',{locked:true}),/교사/);
    state=op(state,'teacher','lock',{locked:true},true);
    assert.equal(studentView(state,'s0').locked,true);
    for(const type of ['draft','step','diary','unlockMap','submitResearch','enterDiary'])assert.throws(()=>op(state,'s0',type),/잠시 멈췄/);
    state=op(state,'s0','heartbeat');
    state=op(state,'teacher','move',{activity:'준비',targets:['s0']},true,true);
    state=op(state,'s0','ack',{sequence:state.sequence});
    assert.equal(state.students.s0.activity,'준비');
    state=op(state,'teacher','lock',{locked:false},true);
    assert.equal(studentView(state,'s0').locked,false);
    const student=state.students.s0;
    state=op(state,'s0','draft',{base:student.revision,draft:{notes:student.notes,diary:student.diary}});
    assert.equal(state.students.s0.revision,student.revision+1);
  }
});

test('teacher can move any note while paused and stale student drafts preserve teacher placement',()=>{
  let state=createLesson(roster);
  const note={id:'note-1',image:1,x:.4,y:.6,kind:'보이는 것',text:'처음 기록',noteX:.8,noteY:.3};
  state.students.s0.notes=[note];
  const draft={notes:[{...note,text:'입력 중인 새 내용'}],diary:state.students.s0.diary};
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

test('step advances even when the client sends a stale step number, but never past the diary quiz gate',()=>{
  let state=createLesson(roster);
  state.students.s0.activity='3D';
  const s=state.students.s0;
  state=op(state,'s0','step',{path:s.path,step:0,mode:'2D'});
  assert.equal(state.students.s0.attempts[s.path].checkpoint,1);
  // A retried/late request that still names the old step number must not get stuck: the
  // server advances from wherever it actually is, not from the client's remembered step.
  state=op(state,'s0','step',{path:s.path,step:0,mode:'2D'});
  assert.equal(state.students.s0.attempts[s.path].checkpoint,2);
  state.students.s0.attempts[s.path].checkpoint=6;
  assert.throws(()=>op(state,'s0','step',{path:s.path,step:0,mode:'2D'}),/퀴즈/);
});

test('students move freely between tabs and back without losing draft state or forcing submission',()=>{
  let state=createLesson(roster);
  state=op(state,'t','move',{activity:'조사',targets:['s0']},true,true);
  state=op(state,'s0','ack',{sequence:1});
  assert.equal(state.students.s0.activity,'조사');
  state=op(state,'s0','selfMove',{activity:'관찰'});
  assert.equal(state.students.s0.activity,'관찰');
  state=op(state,'s0','selfMove',{activity:'정리'});
  assert.equal(state.students.s0.activity,'정리');
  state=op(state,'s0','selfMove',{activity:'조사'});
  assert.equal(state.students.s0.activity,'조사');
  assert.throws(()=>op(state,'s0','selfMove',{activity:'없는활동'}),/올바르지/);
  assert.throws(()=>op(state,'t','selfMove',{activity:'관찰'},true),/학생 기록/);
});

test('chat messages are shared in real time, capped in length, and rejected when blank',()=>{
  let state=createLesson(roster);
  assert.throws(()=>op(state,'s0','chat',{text:'   '}),/메시지/);
  state=op(state,'s0','chat',{text:'저는 그림 1을 보고 있어요.'});
  state=op(state,'s1','chat',{text:'저도 봤어요!'});
  assert.equal(state.chat.length,2);
  assert.equal(state.chat[0].author,'학생0');
  assert.equal(state.chat[0].authorId,'s0');
  assert.equal(studentView(state,'s2').chat.length,2);
  assert.equal(studentView(state,'s2').chat[1].text,'저도 봤어요!');
});
