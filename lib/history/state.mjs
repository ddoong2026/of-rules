import { ACTIVITIES, PATHS, STEPS, VERSION, pathById } from './content.mjs';
import { ARTIFACT_SPOTS } from './exploration.mjs';

export function createLesson(roster) {
  if (!Array.isArray(roster) || roster.length !== 16 || new Set(roster.map(s=>s.id)).size !== 16) throw Error('서로 다른 학생 16명을 배정해 주세요.');
  return { version: VERSION, published:false, liveNotes:false, publishedNotes:[], locked:false, revealed:false, scoreVisible:false, freeMode:false, sequence:0, activity:'준비', commands:[], operations:[], cards:{}, chat:[], students:Object.fromEntries(roster.map((s,i)=>[s.id,{id:s.id,name:s.name,path:PATHS[i].id,group:PATHS[i].group,activity:'준비',ack:0,revision:0,notes:[],research:{},diary:{answers:{},text:'',versions:[]},attempts:{},grants:[],mapOrder:[],reviewedGroups:[],reviewQuizzes:{},lastSeen:null}])) };
}
const fail = message => { throw Error(message); };
const text = value => typeof value === 'string' ? value : '';
function submitCard(card, forced) {
  card.status=forced?'강제 제출':'제출';
  card.versions ||= [];
  const snapshot={name:card.name,usage:card.usage,source:card.source,forced,revision:card.revision};
  if(card.versions.at(-1)?.revision!==card.revision)card.versions.push(snapshot);
}
function submitDiary(s, forced=false) {
  const path=pathById(s.path);
  if (!forced && (!s.diary.text.trim() || path.questions.some(q=>s.diary.answers[q.id]!==q.answer))) fail('퀴즈를 모두 맞히고 상황에 따른 감정·생각을 작성해 주세요.');
  const versions=s.diary.versions;
  const record={answers:{...s.diary.answers},text:s.diary.text,path:s.path,contentVersion:VERSION,forced};
  if (JSON.stringify(versions.at(-1)?.answers)===JSON.stringify(record.answers) && versions.at(-1)?.text===record.text) return;
  versions.push({...record,version:versions.length+1});
}
function forceCurrent(state,s) {
  if(s.activity==='일기') submitDiary(s,true);
  if(s.activity==='조사') Object.values(state.cards).filter(c=>c.owner===s.id || Object.hasOwn(s.research || {},c.id)).forEach(c=>submitCard(c,true));
  if(s.activity==='3D') {const a=s.attempts[s.activePath || s.path]; if(a && !a.complete) a.interrupted=true;}
}
export function applyOperation(original, actor, teacher, op) {
  const state=structuredClone(original);
  if (!op || typeof op.id!=='string' || !op.id || typeof op.type!=='string') fail('유효하지 않은 요청입니다.');
  if(state.operations.includes(op.id)) return state;
  if(op.type==='move' && op.activity==='일기')op={...op,activity:'3D'};
  const s=state.students[actor];
  if (!teacher && !s) fail('이 수업에 배정되지 않았습니다.');
  if(op.type==='distribution') {
    if(!teacher)fail('교사만 실행할 수 있습니다.');
    if(typeof op.distributed!=='boolean')fail('배포 상태가 올바르지 않습니다.');
    state.distributed=op.distributed;
    state.operations.push(op.id);
    return state;
  }
  if(op.type==='noteVisibility' || op.type==='lock' || op.type==='moveNote' || op.type==='publish' || op.type==='reveal' || op.type==='move' || op.type==='scoreVisibility' || op.type==='freeMode') {
    if(!teacher) fail('교사만 실행할 수 있습니다.');
    if(op.type==='lock') {
      if(typeof op.locked!=='boolean') fail('잠금 상태가 올바르지 않습니다.');
      state.locked=op.locked;
    }
    if(op.type==='moveNote') {
      const note=state.students[op.owner]?.notes.find(n=>n.id===op.noteId);
      if(!note || ![op.noteX,op.noteY].every(v=>Number.isFinite(v)&&v>=0&&v<=1)) fail('메모지 위치가 올바르지 않습니다.');
      Object.assign(note,{noteX:op.noteX,noteY:op.noteY,boardVersion:2,positionRevision:(note.positionRevision||0)+1});
    }
    if(op.type==='noteVisibility') {
      if(!['hidden','live'].includes(op.mode)) fail('메모 공개 방식이 올바르지 않습니다.');
      state.liveNotes=op.mode==='live';state.published=state.liveNotes;state.publishedNotes=[];
    }
    if(op.type==='publish') {
      state.published=true;state.liveNotes=false;
      state.publishedNotes=Object.values(state.students).flatMap(x=>x.notes.map(n=>({...n,author:x.name,authorId:x.id})));
    }
    if(op.type==='reveal') state.revealed=true;
    if(op.type==='scoreVisibility') {
      if(typeof op.visible!=='boolean') fail('점수 공개 상태가 올바르지 않습니다.');
      state.scoreVisible=op.visible;
    }
    if(op.type==='freeMode') {
      if(typeof op.enabled!=='boolean') fail('모드 상태가 올바르지 않습니다.');
      state.freeMode=op.enabled;
    }
    if(op.type==='move') {
      if(!ACTIVITIES.includes(op.activity) || !Array.isArray(op.targets) || !op.targets.length || op.targets.some(id=>!state.students[id])) fail('활동 또는 이동 대상이 올바르지 않습니다.');
      // Review status is informational; teachers can run lessons while reviewing.
      state.sequence++;
      for(const id of op.targets) state.students[id].command={sequence:state.sequence,activity:op.activity};
      state.activity=op.activity;
      state.commands.push({id:op.id,sequence:state.sequence,targets:op.targets,activity:op.activity});
    }
  } else {
    if(!s) fail('학생 기록이 없습니다.');
    if(state.locked && !['ack','heartbeat'].includes(op.type)) fail('선생님이 학생 조작을 잠시 멈췄습니다.');
    s.lastSeen=new Date().toISOString();
    if(op.type==='ack') {
      if(s.command && op.sequence===s.command.sequence && s.ack<op.sequence) {
        s.supplement=!!s.supplement || s.activity==='3D' || ['일기','정리'].includes(s.command.activity);
        forceCurrent(state,s);s.activity=s.command.activity;s.ack=op.sequence;
        s.saveState=['저장 대기','충돌'].includes(op.saveState)?op.saveState:'저장됨';
      }
    } else if(op.type==='draft') {
      if(op.base!==s.revision) fail('CONFLICT: 다른 탭의 기록이 변경되었습니다. 로컬 초안을 확인해 주세요.');
      const d=op.draft;
      if(!d || !Array.isArray(d.notes) || !d.diary) fail('기록 형식이 올바르지 않습니다.');
      if(d.notes.some(n=>!['보이는 것','궁금한 것','내 생각·추측'].includes(n.kind) || !Number.isFinite(n.x) || n.x<0 || n.x>1 || !Number.isFinite(n.y) || n.y<0 || n.y>1 || ![1,2,3,4].includes(n.image))) fail('관찰 위치가 올바르지 않습니다.');
      if(d.notes.some(n=>['noteX','noteY'].some(k=>n[k]!==undefined && (!Number.isFinite(n[k]) || n[k]<0 || n[k]>1)))) fail('메모지 위치가 올바르지 않습니다.');
      s.notes=d.notes.map(n=>{
        const previous=s.notes.find(old=>old.id===n.id);
        const placement=(previous?.positionRevision||0)>(n.positionRevision||0)?previous:n;
        return {id:text(n.id),image:n.image,x:n.x,y:n.y,kind:n.kind,text:text(n.text),positionRevision:previous?.positionRevision||0,...(placement.boardVersion===2?{boardVersion:2}:{}),...(placement.noteX!==undefined?{noteX:placement.noteX}:{}),...(placement.noteY!==undefined?{noteY:placement.noteY}:{})};
      });
      const answers={};
      for(const q of pathById(s.path).questions) {const v=d.diary.answers?.[q.id]; if(Number.isInteger(v) && v>=0 && v<q.options.length) answers[q.id]=v;}
      s.diary={...s.diary,answers,text:text(d.diary.text)};
      if(researchComplete(state,s))s.researchHelpUnlocked=true;
      const research={};
      for(const [id,r] of Object.entries(d.research || {})) {
        if(!/^[a-z\d-]{1,80}$/i.test(id) || !r) fail('조사 카드가 올바르지 않습니다.');
        const old=state.cards[id];
        if(old ? old.artifact!==r.artifact : r.extra===true ? s.activity!=='조사' || !groupResearchComplete(state,s.group) || !text(r.artifact).trim() || r.artifact.length>100 : !PATHS.filter(p=>p.group===s.group).some(p=>p.artifacts.includes(r.artifact))) fail('조사 카드가 올바르지 않습니다. 모둠 그림의 조사를 모두 마친 뒤 추가해 주세요.');
        if(old && old.group!==s.group && !s.researchHelpUnlocked) fail('내 조사를 마치면 다른 모둠을 도울 수 있습니다.');
        const fields={name:text(r.name),usage:text(r.usage),source:text(r.source)};
        const prior=s.research?.[id];
        if(old && prior && Object.entries(fields).every(([k,v])=>prior[k]===v)) {
          research[id]={artifact:old.artifact,name:old.name,usage:old.usage,source:old.source,base:old.revision};
          continue;
        }
        const changed=!old || Object.entries(fields).some(([k,v])=>old[k]!==v);
        if(changed && old && r.base!==old.revision) fail('CONFLICT: 공동보드가 변경되었습니다. 로컬 초안과 새 카드를 비교해 주세요.');
        if(changed) state.cards[id]={id,artifact:r.artifact,extra:old?!!old.extra:r.extra===true,group:old?.group??s.group,owner:old?.owner || actor,helpers:[...new Set([...(old?.helpers || []),actor])],...fields,revision:(old?.revision || 0)+1,status:'초안',versions:old?.versions || []};
        research[id]={artifact:r.artifact,...fields,base:state.cards[id].revision};
      }
      s.research=research;
      s.revision++;
      s.saveState='저장됨';
    } else if(op.type==='submitResearch') {
      const card=state.cards[op.cardId];
      if(s.activity!=='조사' || !card || (card.group!==s.group&&!s.researchHelpUnlocked&&!researchComplete(state,s))) fail('내 조사를 마친 뒤 친구 조사를 제출해 주세요.');
      if(!card.name.trim() || !card.usage.trim()) fail('명칭과 쓰임을 작성해 주세요.');
      if(card.extra && !card.source.trim()) fail('추가 조사에 사용한 교과서 쪽 또는 자료 URL을 작성해 주세요.');
      submitCard(card,false);
      if(researchComplete(state,s))s.researchHelpUnlocked=true;
    } else if(op.type==='diary') {
      if(s.activity!=='일기' && !(s.activity==='3D' && s.attempts[s.path]?.complete)) fail('체험을 마치거나 일기 활동에서 제출해 주세요.'); submitDiary(s);
    } else if(op.type==='step') {
      if(!['3D','일기'].includes(s.activity)) fail('체험 활동에서 진행해 주세요.');
      const path=op.path || s.path;
      if(path!==s.path && !state.freeMode && !s.grants.includes(path)) fail('체험할 수 있는 맵이 아닙니다.');
      if(!pathById(path)) fail('존재하지 않는 맵입니다.');
      const a=s.attempts[path] || {checkpoint:0,seen:[],complete:false,mode:op.mode==='alternative'?'alternative':op.mode==='2D'?'2D':'3D'};
      if(op.mode==='alternative')a.mode='alternative';
      if(path===s.path && a.checkpoint===6 && (pathById(path).questions.some(q=>s.diary.answers[q.id]!==q.answer)||!s.diary.text.trim())) fail('퀴즈를 모두 맞히고 상황에 따른 감정·생각을 작성해 주세요.');
      // Advance from wherever the server says the student is, rather than requiring the
      // client's step number to match exactly: a lost response or stale re-render must
      // not leave a student unable to progress on the next click.
      if(a.checkpoint<STEPS.length){const at=a.checkpoint;a.checkpoint++; if([1,3].includes(at)) a.seen.push(at===1?0:1);}
      a.complete=a.checkpoint===STEPS.length;s.attempts[path]=a;s.activePath=path;
      if(a.complete && !(s.mapOrder||[]).includes(path)) s.mapOrder=[...(s.mapOrder||[]),path];
    } else if(op.type==='answerReviewQuiz') {
      // In free mode any topic's own two questions can be practiced for fun; the practice
      // record is stored the same way (keyed by that path) but never gates anything.
      const practicePath=state.freeMode && op.path ? pathById(op.path) : null;
      const current=practicePath?op.path:chainQuizProgress(s).current;
      const questions=practicePath?practicePath.questions:chainQuizProgress(s).questions;
      const question=questions.find(q=>q.id===op.questionId);
      if(!current||!question||!Number.isInteger(op.choice)||op.choice<0||op.choice>=question.options.length) fail('복습 퀴즈의 문제와 답을 확인해 주세요.');
      s.reviewQuizzes ||= {};
      const record=s.reviewQuizzes[current] ||= {};
      if(record[question.id]?.choice!==question.answer)record[question.id]={choice:op.choice,attempts:(record[question.id]?.attempts||0)+1};
    } else if(op.type==='reviewGroup') {
      const group=Number(op.group);
      if(![1,2,3,4].includes(group)) fail('모둠 번호가 올바르지 않습니다.');
      if(group===s.group) fail('우리 모둠은 확인이 필요 없습니다.');
      s.reviewedGroups=[...new Set([...(s.reviewedGroups||[]),group])];
    } else if(op.type==='unlockMap') {
      const target=pathById(op.path);
      if(!target) fail('존재하지 않는 맵입니다.');
      if(!state.freeMode) {
        const status=unlockStatus(s,op.path);
        if(status.already) fail('이미 체험할 수 있는 맵입니다.');
        if(status.pendingUnfinished) fail('이미 잠금 해제한 맵을 먼저 체험해 주세요.');
        if(!status.sameGroup && !status.groupDone) fail('우리 모둠 맵을 모두 체험하면 다른 모둠 맵을 열 수 있어요.');
        if(!status.sameGroup && !status.reviewed) fail('그 모둠의 조사 카드를 먼저 확인해 주세요.');
        if(!status.quizPassed) fail('대화를 떠올리는 문제를 모두 맞혀야 체험할 수 있어요.');
      }
      if(!s.grants.includes(op.path))s.grants.push(op.path);
    } else if(op.type==='enterExperience') {
      if(!['3D','일기','정리'].includes(s.activity)||(op.path===s.path?s.activity!=='3D':!state.freeMode&&!s.grants.includes(op.path)))fail('체험할 수 있는 맵만 선택할 수 있습니다.');
      if(!pathById(op.path)) fail('존재하지 않는 맵입니다.');
      s.activity='3D';s.activePath=op.path;
    } else if(op.type==='enterDiary') {
      if(!s.attempts[s.path]?.complete) fail('기본 체험을 마치면 일기로 이동할 수 있습니다.');s.activity='3D';
    } else if(op.type==='selfMove') {
      // Students move freely between tabs and back; nothing is force-submitted,
      // since browsing away and returning should not lose in-progress work.
      if(!ACTIVITIES.includes(op.activity)) fail('활동이 올바르지 않습니다.');
      s.activity=op.activity;
    } else if(op.type==='chat') {
      const value=text(op.text).trim().slice(0,300);
      if(!value) fail('메시지를 입력해 주세요.');
      (state.chat ||= []).push({id:op.id,author:s.name,authorId:s.id,text:value,at:new Date().toISOString()});
      if(state.chat.length>300) state.chat=state.chat.slice(-300);
    } else if(op.type!=='heartbeat') fail('지원하지 않는 동작입니다.');
  }
  // ponytail: bounded idempotency ledger for a 40-minute lesson; archive externally for multi-day runs.
  state.operations.push(op.id); state.operations=state.operations.slice(-4096);
  return state;
}
function groupResearchComplete(state,group) {
  const artifacts=[...new Set((ARTIFACT_SPOTS[group]||[]).map(([artifact])=>artifact))];
  return artifacts.length>0 && artifacts.every(artifact=>Object.values(state.cards).some(c=>!c.extra&&c.group===group&&c.artifact===artifact&&c.name.trim()&&c.usage.trim()&&c.versions?.some(v=>v.revision===c.revision)));
}
export function groupComplete(student,group) {
  return PATHS.filter(p=>p.group===group).every(p=>student.attempts[p.id]?.complete);
}
// Each unlock quiz is tied to the map the student just finished (their "current" map in
// mapOrder), not a shared group bank: the first ever unlock quiz reuses that map's own two
// quest questions, and every one after also carries one question from the map completed
// right before it, so earlier content stays fresh without repeating a whole group's questions.
export function chainQuestions(student) {
  const order=student.mapOrder||[];
  const current=order.at(-1);
  if(!current) return [];
  const currentPath=pathById(current);
  if(!currentPath) return [];
  const previous=order.at(-2),previousPath=previous&&pathById(previous);
  return previousPath?[...currentPath.questions,previousPath.questions[0]]:currentPath.questions;
}
export function chainQuizProgress(student) {
  const current=(student.mapOrder||[]).at(-1)||null;
  const questions=chainQuestions(student);
  const record=current?student.reviewQuizzes?.[current]||{}:{};
  const score=questions.filter(q=>record[q.id]?.choice===q.answer).length;
  return {current,questions,record,score,needed:questions.length,passed:questions.length>0&&score===questions.length};
}
// Same-group unlocks only need the just-finished map's mini quiz passed; cross-group unlocks
// additionally need the whole home group finished and that other group's research cards
// reviewed first. Only one unlocked-but-unfinished map may exist at a time, since the quiz
// that unlocks the next one is defined in terms of "the map I just finished".
export function unlockStatus(student,targetPath) {
  const target=pathById(targetPath);
  const sameGroup=target.group===student.group;
  const already=targetPath===student.path||student.grants.includes(targetPath);
  const pendingUnfinished=student.grants.some(id=>!student.attempts[id]?.complete);
  const groupDone=groupComplete(student,student.group);
  const reviewed=sameGroup||!!(student.reviewedGroups||[]).includes(target.group);
  const quiz=chainQuizProgress(student);
  const ok=!already&&!pendingUnfinished&&(sameGroup?true:groupDone&&reviewed)&&quiz.passed;
  return {path:targetPath,group:target.group,sameGroup,already,pendingUnfinished,groupDone,reviewed,quizScore:quiz.score,quizNeeded:quiz.needed,quizPassed:quiz.passed,ok};
}
export function groupScore(state,group) {
  return Object.values(state.students).filter(s=>s.group===group).reduce((sum,s)=>sum+[s.path,...s.grants].filter(id=>s.attempts[id]?.complete).length,0);
}
export function groupScores(state) {
  return [1,2,3,4].map(group=>({group,score:groupScore(state,group)}));
}
function researchComplete(state,s) {
  const path=pathById(s.path);
  return path.artifacts.length?path.artifacts.every(artifact=>Object.values(state.cards).some(c=>c.group===s.group&&c.artifact===artifact&&c.name.trim()&&c.usage.trim()&&c.versions?.some(v=>v.revision===c.revision))):s.notes.some(n=>n.id===`inquiry-${path.id}`&&n.text.trim());
}
export function studentView(state,id) {
  const s=state.students[id]; if(!s) fail('이 수업의 학생이 아닙니다.');
  return {version:state.version,published:state.published,liveNotes:state.liveNotes??!!state.published,locked:!!state.locked,revealed:state.revealed,activity:state.activity,me:s,chat:state.chat||[],scoreVisible:!!state.scoreVisible,scores:state.scoreVisible?groupScores(state):null,freeMode:!!state.freeMode,canAddResearch:groupResearchComplete(state,s.group),canHelpResearch:!!state.freeMode||!!s.researchHelpUnlocked||researchComplete(state,s),cards:Object.values(state.cards).filter(c=>state.freeMode||c.group===s.group||s.researchHelpUnlocked||researchComplete(state,s)),notes:[...s.notes.map(n=>({...n,author:s.name,authorId:id})),...((state.liveNotes??!!state.published)?Object.values(state.students).filter(x=>x.id!==id).flatMap(x=>x.notes.map(n=>({...n,author:x.name,authorId:x.id}))):state.published?(state.publishedNotes||[]).filter(n=>n.authorId!==id):[])]};
}
