import test from 'node:test';
import assert from 'node:assert/strict';
import {createLesson,applyOperation,studentView,canReflectWhileWaiting,completedFeedbackPath,reviewQuizPath,reviewQuizPaths,reviewQuizComplete,reviewQuestions,feedbackRecords} from './state.mjs';
import {PATHS,REACTIONS,ACTIVITIES} from './content.mjs';
import {ARTIFACT_SPOTS} from './exploration.mjs';
const roster=Array.from({length:16},(_,i)=>({id:`s${i}`,name:`학생${i}`}));
const op=(state,id,type,rest={},teacher=false,preview=false)=>applyOperation(state,id,teacher,{id:crypto.randomUUID(),type,...rest},preview);

test('first finisher gets quizzes immediately, then friend topics and all remaining topics without duplicates',()=>{
  let state=createLesson(roster);
  const s=state.students.s0;s.activity='3D';
  const records=()=>feedbackRecords(state).filter(f=>f.author==='s0');
  const next=()=>reviewQuizPath(state.students.s0,records());
  const answer=(path,q,choice=q.answer)=>op(state,'s0','answerReviewQuiz',{path,questionId:q.id,choice});
  assert.equal(next(),null);
  assert.throws(()=>answer('1-A',reviewQuestions('1-A')[0]),/일기를 완성/);
  s.diary.text='가족과 함께 이동하는 마음';
  s.diary.answers=Object.fromEntries(PATHS[0].questions.map(q=>[q.id,q.answer]));
  assert.equal(next(),'1-A');
  assert.equal(s.reflection,undefined);
  state.feedback.s0={author:'s0',recipient:'s8',path:'3-A',version:1,valid:true,approved:false};
  assert.deepEqual(reviewQuizPaths(s,records()),['1-A']);
  assert.throws(()=>answer('2-A',reviewQuestions('2-A')[0]),/앞선 복습/);
  const q=reviewQuestions('1-A')[0];
  assert.throws(()=>answer('1-A',q,-1),/문제와 답/);
  state=answer('1-A',q,(q.answer+1)%q.options.length);
  state=answer('1-A',q);
  assert.equal(state.students.s0.reviewQuizzes['1-A'][q.id].attempts,2);
  state=answer('1-A',q,(q.answer+1)%q.options.length);
  assert.equal(state.students.s0.reviewQuizzes['1-A'][q.id].choice,q.answer);
  for(const question of reviewQuestions('1-A'))state=answer('1-A',question);
  assert.equal(next(),'3-A');
  assert.throws(()=>answer('2-A',reviewQuestions('2-A')[0]),/앞선 복습/);
  for(const question of reviewQuestions('3-A'))state=answer('3-A',question);
  assert.equal(next(),'2-A');
  for(const question of reviewQuestions('2-A'))state=answer('2-A',question);
  assert.equal(next(),'4-A');
  for(const question of reviewQuestions('4-A'))state=answer('4-A',question);
  assert.equal(next(),null);
  assert.equal(Object.values(state.students.s0.reviewQuizzes).flatMap(r=>Object.keys(r)).length,32);
  assert.ok(PATHS.every(p=>reviewQuizComplete(state.students.s0,p.id)));
  assert.deepEqual(state.students.s0.grants,[]);
  const saved=structuredClone(state.students.s0.reviewQuizzes);
  state=op(state,'teacher','lock',{locked:true},true);
  assert.throws(()=>answer('1-A',q),/잠시 멈췄/);
  state=op(state,'teacher','lock',{locked:false},true);
  state=op(state,'s0','draft',{base:0,draft:{...state.students.s0,reviewQuizzes:{}}});
  assert.deepEqual(studentView(state,'s0').me.reviewQuizzes,saved);
});

test('no peer is needed to continue from own review to new topics',()=>{
  let state=createLesson(roster);const s=state.students.s0;
  s.activity='3D';s.diary.versions=[{version:1,text:'완성한 일기'}];
  for(const q of reviewQuestions(s.path))state=op(state,s.id,'answerReviewQuiz',{path:s.path,questionId:q.id,choice:q.answer});
  assert.equal(state.students.s0.target,undefined);
  assert.equal(reviewQuizPath(state.students.s0,[]),'2-A');
});

test('repeated matching visits all other students once and preserves all replies',()=>{
  let state=createLesson(roster);
  for(const s of Object.values(state.students)) {
    s.activity='피드백';s.diary.versions=[{version:1,text:'공유 일기',path:s.path}];
  }
  state=op(state,'s0','heartbeat');
  const visited=new Set();
  for(let round=0;round<15;round++) {
    const recipient=state.students.s0.target.recipient;
    assert.notEqual(recipient,'s0');assert.equal(visited.has(recipient),false);
    visited.add(recipient);
    state.students.s0.feedbackDraft={reaction:REACTIONS[0],text:`답장 ${round+1}`};
    state=op(state,'s0','feedback',{recipient});
  }
  assert.equal(feedbackRecords(state).filter(f=>f.author==='s0'&&f.valid).length,15);
  state=op(state,'teacher','approve',{},true);
  assert.equal(state.students.s0.grants.length,15);
  const last=state.students.s0.target;
  state=op(state,'s0','heartbeat');
  assert.deepEqual(state.students.s0.target,last);
  assert.throws(()=>op(state,'s0','feedback',{recipient:last.recipient}),/이미 제출/);
});

test('multiple feedback rounds preserve history, approve old rounds, and let students enter approved maps',()=>{
  let state=createLesson(roster);
  for(const id of ['s0','s1']) {
    const s=state.students[id];s.activity='피드백';s.diary.versions=[{version:1,text:'공유한 일기',path:s.path}];
  }
  state=op(state,'s0','heartbeat');
  state.students.s0.feedbackDraft={reaction:REACTIONS[0],text:'첫 번째 답장'};
  state=op(state,'s0','feedback',{recipient:'s1'});
  assert.equal(state.students.s0.target.recipient,'s1');
  const oldDraft={...state.students.s0,feedbackTarget:'s1:1'};
  state.students.s4.diary.versions=[{version:1,text:'새 친구 일기',path:'2-A'}];
  state=op(state,'s4','heartbeat');
  assert.equal(state.students.s0.target.recipient,'s4');
  assert.deepEqual(state.students.s0.feedbackDraft,{reaction:'',text:''});
  state=op(state,'s0','draft',{base:0,draft:oldDraft});
  assert.deepEqual(state.students.s0.feedbackDraft,{reaction:'',text:''});
  assert.throws(()=>op(state,'s0','feedback',{recipient:'s1'}),/대상이 변경/);
  assert.throws(()=>op(state,'s0','enterExperience',{path:'1-B'}),/승인/);
  state.students.s0.feedbackDraft={reaction:REACTIONS[1],text:'두 번째 답장'};
  state=op(state,'s0','feedback',{recipient:'s4'});
  assert.equal(state.feedbackHistory[0].text,'첫 번째 답장');
  assert.equal(state.feedback.s0.text,'두 번째 답장');
  state=op(state,'teacher','approve',{},true);
  assert.deepEqual(state.students.s0.grants,['1-B','2-A']);
  assert.equal(state.feedbackHistory[0].approved,true);
  state=op(state,'s0','enterExperience',{path:'1-B'});
  assert.equal(state.students.s0.activity,'3D');
  assert.equal(state.students.s0.activePath,'1-B');
  assert.throws(()=>op(state,'s0','enterExperience',{path:'4-A'}),/승인/);
  state=op(state,'teacher','lock',{locked:true},true);
  assert.throws(()=>op(state,'s0','enterExperience',{path:'2-A'}),/잠시 멈췄/);
  state=op(state,'teacher','lock',{locked:false},true);
  for(let step=0;step<7;step++)state=op(state,'s0','step',{path:'1-B',step});
  state=op(state,'s0','enterFeedback');
  assert.equal(state.students.s0.activity,'피드백');
  state.students.s8.diary.versions=[{version:1,text:'세 번째 친구 일기',path:'3-A'}];
  state=op(state,'s8','heartbeat');
  assert.equal(state.students.s0.target.recipient,'s8');
  assert.equal(studentView(state,'s1').feedback.find(f=>f.author==='s0').text,'첫 번째 답장');
  assert.equal(studentView(state,'s0').feedback.filter(f=>f.author==='s0').length,2);
});

test('review questions retain correct answers and stay within the related picture group',()=>{
  for(const path of PATHS) {
    const questions=reviewQuestions(path.id);
    assert.equal(questions.length,8);
    assert.equal(new Set(questions.map(q=>q.id)).size,8);
    for(const q of questions) {
      const original=PATHS.filter(p=>p.group===path.group).flatMap(p=>p.questions).find(item=>item.id===q.id);
      assert.equal(q.options[q.answer],original.options[original.answer]);
      assert.deepEqual([...q.options].sort(),[...original.options].sort());
    }
  }
});

test('completed friend exploration opens separate follow-up work and preserves the original reflection',()=>{
  let state=createLesson(roster);
  const s=state.students.s0;
  s.activity='3D';s.diary.versions=[{version:1,text:'내 일기'}];
  s.reflection={evidence:'나의 원래 기록'};
  s.target={recipient:'s1',path:'1-B',version:1};
  state.students.s1.diary.versions=[{version:1,text:'친구 일기'}];
  state.feedback.s0={author:'s0',...s.target,valid:true,approved:false};
  assert.equal(completedFeedbackPath(s,state.feedback.s0),null);
  state=op(state,'teacher','approve',{},true);
  assert.equal(completedFeedbackPath(state.students.s0,state.feedback.s0),null);
  const record={evidence:'친구 시대의 토기',perspective:'정착 생활을 비교했다',question:'음식은 어떻게 보관했을까?'};
  const save=()=>op(state,'s0','draft',{base:state.students.s0.revision,draft:{...state.students.s0,friendReflections:{'1-B':record}}});
  assert.throws(save,/체험을 마친 뒤/);
  for(let step=0;step<7;step++)state=op(state,'s0','step',{path:'1-B',step,mode:'alternative'});
  assert.equal(completedFeedbackPath(state.students.s0,state.feedback.s0),'1-B');
  state=op(state,'s0','enterFeedback');
  assert.equal(state.students.s0.activity,'피드백');
  state=save();
  assert.deepEqual(studentView(state,'s0').me.friendReflections['1-B'],record);
  assert.equal(state.students.s0.reflection.evidence,'나의 원래 기록');
  assert.equal(state.students.s1.friendReflections,undefined);
  const {friendReflections:omitted,...legacyDraft}=state.students.s0;
  state=op(state,'s0','draft',{base:state.students.s0.revision,draft:legacyDraft});
  assert.deepEqual(state.students.s0.friendReflections,omitted);
  state.students.s0.target={recipient:'s2',path:'1-C',version:1};
  assert.equal(completedFeedbackPath(state.students.s0,state.feedback.s0),null);
  assert.deepEqual(state.students.s0.friendReflections['1-B'],record);
});

test('sharing diaries automatically matches waiting students and keeps drafts and assigned versions stable',()=>{
  let state=createLesson(roster);
  const share=id=>{
    const s=state.students[id];s.activity='3D';s.attempts[s.path]={complete:true};
    s.diary.answers=Object.fromEntries(PATHS.find(p=>p.id===s.path).questions.map(q=>[q.id,q.answer]));
    s.diary.text=`${id}의 완성한 일기`;
    state=op(state,id,'diary');
  };
  assert.throws(()=>op(state,'s0','enterFeedback'),/일기를 공유/);
  share('s0');
  assert.equal(state.students.s0.target,undefined);
  assert.equal(state.students.s1.target,undefined);
  state.students.s0.reflection={question:'어떤 마음이었니?'};
  share('s1');
  assert.equal(state.students.s0.target.recipient,'s1');
  assert.equal(state.students.s1.target.recipient,'s0');
  assert.equal(state.students.s0.activity,'3D');
  state=op(state,'s0','enterFeedback');
  assert.equal(state.students.s0.activity,'피드백');
  state.students.s0.feedbackDraft={reaction:REACTIONS[0],text:'친구를 위한 답장'};
  const assigned=structuredClone(state.students.s0.target);
  share('s2');
  share('s3');
  assert.equal(state.students.s3.target.recipient,'s2');
  state.students.s1.diary.text='수정한 일기';
  state=op(state,'s1','diary');
  state=op(state,'teacher','assignFeedback',{},true);
  assert.deepEqual(state.students.s0.target,assigned);
  assert.equal(state.students.s0.feedbackDraft.text,'친구를 위한 답장');
  assert.equal(state.students.s0.reflection.question,'어떤 마음이었니?');
  state=op(state,'s0','feedback');
  assert.equal(state.feedback.s0.version,assigned.version);
  assert.deepEqual(state.students.s0.grants,[]);
  const nextTarget=structuredClone(state.students.s0.target);
  assert.notEqual(nextTarget.recipient,assigned.recipient);
  assert.deepEqual(state.students.s0.feedbackDraft,{reaction:'',text:''});
  state=op(state,'s4','heartbeat');
  assert.deepEqual(state.students.s0.target,nextTarget);
});

test('automatic matching skips blank shares, observes pause, and catches up when resumed',()=>{
  let state=createLesson(roster);
  state.students.s0.activity='피드백';
  state.students.s1.diary.versions=[{version:1,text:' ',answers:{q:0},forced:true}];
  state=op(state,'s0','heartbeat');
  assert.equal(state.students.s0.target,undefined);
  state=op(state,'teacher','lock',{locked:true},true);
  state.students.s1.diary.versions.push({version:2,text:'공유된 일기',path:'1-B'});
  state=op(state,'s0','heartbeat');
  assert.equal(state.students.s0.target,undefined);
  assert.throws(()=>op(state,'s0','enterFeedback'),/잠시 멈췄/);
  state=op(state,'teacher','lock',{locked:false},true);
  assert.deepEqual(state.students.s0.target,{recipient:'s1',path:'1-B',version:2});
  assert.equal(state.students.s1.target,undefined);
});

test('waiting reflection requires a finished diary and preserves private work when feedback arrives',()=>{
  let state=createLesson(roster);
  const s=state.students.s0;
  assert.equal(canReflectWhileWaiting(s),false);
  s.diary.text='가족과 함께 이동해서 안심했다.';
  assert.equal(canReflectWhileWaiting(s),false);
  s.diary.answers=Object.fromEntries(PATHS[0].questions.map(q=>[q.id,q.answer]));
  assert.equal(canReflectWhileWaiting(s),true);
  const reflection={evidence:'교과서 17쪽의 주먹 도끼',perspective:'가족도 두려웠을 것 같다.',question:'어떤 도구가 가장 필요했니?'};
  state=op(state,'s0','draft',{base:0,draft:{...s,reflection}});
  assert.deepEqual(studentView(state,'s0').me.reflection,reflection);
  assert.equal(studentView(state,'s1').notes.length,0);
  state.students.s0.diary.versions=[{version:1,text:s.diary.text,answers:s.diary.answers}];
  state=op(state,'teacher','assignFeedback',{},true);
  assert.equal(canReflectWhileWaiting(state.students.s0),true);
  state.students.s1.diary.versions=[{version:1,text:'친구의 일기',answers:{}}];
  state=op(state,'teacher','assignFeedback',{},true);
  const view=studentView(state,'s0'),target=view.diaries.find(d=>d.id===view.me.target.recipient);
  assert.equal(canReflectWhileWaiting(view.me,target.versions[0]),false);
  const {reflection:omitted,...oldDraft}=view.me;
  state=op(state,'s0','draft',{base:view.me.revision,draft:oldDraft});
  assert.deepEqual(state.students.s0.reflection,omitted);
  assert.deepEqual(state.students.s0.grants,[]);
  assert.equal(state.feedback.s0,undefined);
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
test('sixteen distinct assignments persist and teacher access remains required',()=>{
  const state=createLesson(roster);assert.equal(Object.keys(state.students).length,16);assert.equal(new Set(Object.values(state.students).map(s=>s.path)).size,16);
  assert.throws(()=>op(state,'s0','move',{targets:['s0'],activity:'관찰'}),/교사/);
  assert.throws(()=>op(state,'s0','approve'),/교사/);
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
    assert.throws(()=>op(state,id,'step',{path:PATHS.find(p=>p.id!==s.path).id,step:0}),/승인/);
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
