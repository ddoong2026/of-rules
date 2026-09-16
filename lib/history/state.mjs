import { ACTIVITIES, PATHS, REACTIONS, STEPS, VERSION, pathById } from './content.mjs';
import { ARTIFACT_SPOTS } from './exploration.mjs';

export function createLesson(roster) {
  if (!Array.isArray(roster) || roster.length !== 16 || new Set(roster.map(s=>s.id)).size !== 16) throw Error('서로 다른 학생 16명을 배정해 주세요.');
  return { version: VERSION, published:false, liveNotes:false, publishedNotes:[], locked:false, revealed:false, sequence:0, activity:'준비', commands:[], operations:[], cards:{}, feedback:{}, students:Object.fromEntries(roster.map((s,i)=>[s.id,{id:s.id,name:s.name,path:PATHS[i].id,group:PATHS[i].group,activity:'준비',ack:0,revision:0,notes:[],research:{},diary:{answers:{},text:'',versions:[]},feedbackDraft:{reaction:'',text:''},attempts:{},grants:[],lastSeen:null}])) };
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
function submitFeedback(state,s,forced=false) {
  const f=s.feedbackDraft;
  const valid=REACTIONS.includes(f.reaction) && !!f.text.trim() && !!s.target;
  if (!valid && !forced) fail('반응 하나와 댓글을 작성해 주세요.');
  if (s.target) {
    const previous=state.feedback[s.id];
    if(previous?.valid&&previous.recipient!==s.target.recipient)(state.feedbackHistory ||= []).push(previous);
    state.feedback[s.id]={author:s.id,...s.target,reaction:f.reaction,text:f.text,valid,forced,approved:false};
  }
}
export const feedbackRecords=state=>[...(state.feedbackHistory||[]),...Object.values(state.feedback)];
const feedbackForTarget=(state,s)=>state.feedback[s.id]?.recipient===s.target?.recipient?state.feedback[s.id]:undefined;
function forceCurrent(state,s) {
  if(s.activity==='일기') submitDiary(s,true);
  if(s.activity==='피드백' && !feedbackForTarget(state,s)?.valid) submitFeedback(state,s,true);
  if(s.activity==='조사') Object.values(state.cards).filter(c=>c.owner===s.id || Object.hasOwn(s.research || {},c.id)).forEach(c=>submitCard(c,true));
  if(s.activity==='3D') {const a=s.attempts[s.activePath || s.path]; if(a && !a.complete) a.interrupted=true;}
}
function matchFeedback(state) {
  const students=Object.values(state.students);
  const candidates=students.filter(s=>s.diary.versions.some(v=>v.text?.trim()));
  const counts=Object.fromEntries(candidates.map(s=>[s.id,0]));
  for(const f of feedbackRecords(state).filter(f=>f.valid))counts[f.recipient]=(counts[f.recipient]||0)+1;
  for(const s of students) if(s.target&&!feedbackForTarget(state,s)?.valid) counts[s.target.recipient]=(counts[s.target.recipient]||0)+1;
  for(const s of students) {
    if((s.target&&!feedbackForTarget(state,s)?.valid) || (!candidates.includes(s)&&s.activity!=='피드백'))continue;
    const visited=new Set(feedbackRecords(state).filter(f=>f.author===s.id&&f.valid).map(f=>f.recipient));
    const start=candidates.indexOf(s)+1;
    const choices=[...candidates.slice(start),...candidates.slice(0,start)].filter(c=>c.id!==s.id&&!visited.has(c.id));
    choices.sort((a,b)=>counts[a.id]-counts[b.id]);
    const target=choices[0];if(!target)continue;
    const version=target.diary.versions.findLast(v=>v.text?.trim());
    s.target={recipient:target.id,path:version.path||target.path,version:version.version};
    s.feedbackDraft={reaction:'',text:''};
    counts[target.id]++;
  }
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
  if(op.type==='noteVisibility' || op.type==='lock' || op.type==='moveNote' || op.type==='publish' || op.type==='reveal' || op.type==='move' || op.type==='assignFeedback' || op.type==='approve') {
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
    if(op.type==='move') {
      if(!ACTIVITIES.includes(op.activity) || !Array.isArray(op.targets) || !op.targets.length || op.targets.some(id=>!state.students[id])) fail('활동 또는 이동 대상이 올바르지 않습니다.');
      // Review status is informational; teachers can run lessons while reviewing.
      state.sequence++;
      for(const id of op.targets) state.students[id].command={sequence:state.sequence,activity:op.activity};
      state.activity=op.activity;
      state.commands.push({id:op.id,sequence:state.sequence,targets:op.targets,activity:op.activity});
    }
    if(op.type==='approve') feedbackRecords(state).filter(f=>f.valid && !f.approved).forEach(f=>{f.approved=true;const a=state.students[f.author]; if(!a.grants.includes(f.path)) a.grants.push(f.path);});
  } else {
    if(!s) fail('학생 기록이 없습니다.');
    if(state.locked && !['ack','heartbeat'].includes(op.type)) fail('선생님이 학생 조작을 잠시 멈췄습니다.');
    s.lastSeen=new Date().toISOString();
    if(op.type==='ack') {
      if(s.command && op.sequence===s.command.sequence && s.ack<op.sequence) {
        s.supplement=!!s.supplement || s.activity==='3D' || ['일기','피드백','정리'].includes(s.command.activity);
        forceCurrent(state,s);s.activity=s.command.activity;s.ack=op.sequence;
        s.saveState=['저장 대기','충돌'].includes(op.saveState)?op.saveState:'저장됨';
      }
    } else if(op.type==='draft') {
      if(op.base!==s.revision) fail('CONFLICT: 다른 탭의 기록이 변경되었습니다. 로컬 초안을 확인해 주세요.');
      const d=op.draft;
      if(!d || !Array.isArray(d.notes) || !d.diary || !d.feedbackDraft) fail('기록 형식이 올바르지 않습니다.');
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
      if(d.feedbackTarget===undefined||d.feedbackTarget===(s.target?`${s.target.recipient}:${s.target.version}`:''))s.feedbackDraft={reaction:text(d.feedbackDraft.reaction),text:text(d.feedbackDraft.text)};
      if(d.reflection) s.reflection=Object.fromEntries(['evidence','perspective','question'].map(key=>[key,text(d.reflection[key])]));
      for(const [path,record] of Object.entries(d.friendReflections||{})) {
        if(!pathById(path)||!s.grants.includes(path)||!s.attempts[path]?.complete) fail('친구의 체험을 마친 뒤 추가 활동을 작성해 주세요.');
        s.friendReflections={...s.friendReflections,[path]:Object.fromEntries(['evidence','perspective','question'].map(key=>[key,text(record?.[key])]))};
      }
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
    } else if(op.type==='feedback') {
      if(s.activity!=='피드백') fail('피드백 활동에서 제출해 주세요.');
      if(feedbackForTarget(state,s)?.valid) fail('이미 제출한 피드백입니다.');
      if(op.recipient!==undefined&&op.recipient!==s.target?.recipient)fail('피드백 대상이 변경되었습니다. 새 친구의 일기를 확인해 주세요.');
      submitFeedback(state,s);
    } else if(op.type==='step') {
      if(!['3D','일기'].includes(s.activity)) fail('체험 활동에서 진행해 주세요.');
      const path=op.path || s.path;
      if(path!==s.path && !s.grants.includes(path)) fail('승인되지 않은 맵입니다.');
      if(!pathById(path)) fail('존재하지 않는 맵입니다.');
      const a=s.attempts[path] || {checkpoint:0,seen:[],complete:false,mode:op.mode==='alternative'?'alternative':op.mode==='2D'?'2D':'3D'};
      if(op.mode==='alternative')a.mode='alternative';
      if(path===s.path && op.step===6 && a.checkpoint===6 && (pathById(path).questions.some(q=>s.diary.answers[q.id]!==q.answer)||!s.diary.text.trim())) fail('퀴즈를 모두 맞히고 상황에 따른 감정·생각을 작성해 주세요.');
      if(op.step===a.checkpoint && op.step<STEPS.length){a.checkpoint++; if([1,3].includes(op.step)) a.seen.push(op.step===1?0:1);}
      a.complete=a.checkpoint===STEPS.length;s.attempts[path]=a;s.activePath=path;
    } else if(op.type==='answerReviewQuiz') {
      const records=feedbackRecords(state).filter(f=>f.author===s.id);
      const path=op.path||reviewQuizPath(s,records);
      if(!reviewQuizPaths(s,records).includes(path))fail('일기를 완성하고 앞선 복습 퀴즈부터 풀어 주세요.');
      const question=path&&reviewQuestions(path).find(q=>q.id===op.questionId);
      if(!['3D','일기','피드백','정리'].includes(s.activity)||!question||!Number.isInteger(op.choice)||op.choice<0||op.choice>=question.options.length) fail('복습 퀴즈의 문제와 답을 확인해 주세요.');
      s.reviewQuizzes ||= {};
      const record=s.reviewQuizzes[path] ||= {};
      if(record[question.id]?.choice!==question.answer)record[question.id]={choice:op.choice,attempts:(record[question.id]?.attempts||0)+1};
    } else if(op.type==='enterExperience') {
      if(!['3D','일기','피드백','정리'].includes(s.activity)||(op.path===s.path?s.activity!=='3D':!s.grants.includes(op.path)||!feedbackRecords(state).some(f=>f.author===s.id&&f.path===op.path&&f.valid&&f.approved)))fail('피드백을 남기고 선생님이 승인한 체험만 시작할 수 있습니다.');
      s.activity='3D';s.activePath=op.path;
    } else if(op.type==='enterFeedback') {
      if(!['3D','일기'].includes(s.activity) || !s.diary.versions.some(v=>v.text?.trim()) || !s.target || s.target.recipient===s.id || !state.students[s.target.recipient]?.diary.versions.some(v=>v.version===s.target.version&&v.text?.trim())) fail('일기를 공유하고 피드백할 친구가 배정되면 이동할 수 있습니다.');
      s.activity='피드백';
    } else if(op.type==='enterDiary') {
      if(!s.attempts[s.path]?.complete) fail('기본 체험을 마치면 일기로 이동할 수 있습니다.');s.activity='3D';
    } else if(op.type!=='heartbeat') fail('지원하지 않는 동작입니다.');
  }
  if(!state.locked)matchFeedback(state);
  // ponytail: bounded idempotency ledger for a 40-minute lesson; archive externally for multi-day runs.
  state.operations.push(op.id); state.operations=state.operations.slice(-4096);
  return state;
}
function groupResearchComplete(state,group) {
  const artifacts=[...new Set((ARTIFACT_SPOTS[group]||[]).map(([artifact])=>artifact))];
  return artifacts.length>0 && artifacts.every(artifact=>Object.values(state.cards).some(c=>!c.extra&&c.group===group&&c.artifact===artifact&&c.name.trim()&&c.usage.trim()&&c.versions?.some(v=>v.revision===c.revision)));
}
export function canReflectWhileWaiting(student,version) {
  return !version && !!student.diary.text.trim() && pathById(student.path).questions.every(q=>student.diary.answers[q.id]===q.answer);
}
export function completedFeedbackPath(student,feedback) {
  if(!feedback?.valid||!feedback.approved||!student.grants.includes(feedback.path)||!student.attempts[feedback.path]?.complete)return null;
  if(student.target&&student.target.recipient!==feedback.recipient)return null;
  return feedback.path;
}
export function reviewQuizPath(student,feedback) {
  return reviewQuizPaths(student,feedback).find(path=>!reviewQuizComplete(student,path))||null;
}
export function reviewQuizComplete(student,path) {
  return reviewQuestions(path).every(q=>Object.values(student.reviewQuizzes||{}).some(record=>record[q.id]?.choice===q.answer));
}
export function reviewQuizRecord(student) {
  const result={};
  for(const [path,record] of Object.entries(student.reviewQuizzes||{}))for(const q of reviewQuestions(path)) {
    if(record[q.id]&&result[q.id]?.choice!==q.answer)result[q.id]=record[q.id];
  }
  return result;
}
export function reviewQuizPaths(student,feedback) {
  if(!canReflectWhileWaiting(student)&&!student.diary.versions.some(v=>v.text?.trim()))return [];
  const records=(Array.isArray(feedback)?feedback:[feedback]).filter(f=>f?.valid);
  const priority=[student.path,...records.map(f=>f.path)];
  const unique=paths=>paths.filter((path,i)=>paths.findIndex(p=>pathById(p)?.group===pathById(path)?.group)===i);
  const first=unique(priority);
  const allowed=!reviewQuizComplete(student,student.path)?[student.path]:first.every(path=>reviewQuizComplete(student,path))?unique([...first,...PATHS.map(p=>p.id)]):first;
  // Keep earlier quiz records reachable when a new feedback topic changes the order.
  return unique([...allowed,...Object.keys(student.reviewQuizzes||{}).filter(path=>pathById(path))]);
}
export function reviewQuestions(path) {
  return PATHS.filter(p=>p.group===pathById(path)?.group).flatMap(p=>p.questions.map((q,i)=>{
    const offset=(PATHS.indexOf(p)+i)%q.options.length;
    return {...q,title:p.title,options:[...q.options.slice(offset),...q.options.slice(0,offset)],answer:(q.answer-offset+q.options.length)%q.options.length};
  }));
}
function researchComplete(state,s) {
  const path=pathById(s.path);
  return path.artifacts.length?path.artifacts.every(artifact=>Object.values(state.cards).some(c=>c.group===s.group&&c.artifact===artifact&&c.name.trim()&&c.usage.trim()&&c.versions?.some(v=>v.revision===c.revision))):s.notes.some(n=>n.id===`inquiry-${path.id}`&&n.text.trim());
}
export function studentView(state,id) {
  const s=state.students[id]; if(!s) fail('이 수업의 학생이 아닙니다.');
  return {version:state.version,published:state.published,liveNotes:state.liveNotes??!!state.published,locked:!!state.locked,revealed:state.revealed,activity:state.activity,me:s,canAddResearch:groupResearchComplete(state,s.group),canHelpResearch:!!s.researchHelpUnlocked||researchComplete(state,s),cards:Object.values(state.cards).filter(c=>c.group===s.group||s.researchHelpUnlocked||researchComplete(state,s)),notes:[...s.notes.map(n=>({...n,author:s.name,authorId:id})),...((state.liveNotes??!!state.published)?Object.values(state.students).filter(x=>x.id!==id).flatMap(x=>x.notes.map(n=>({...n,author:x.name,authorId:x.id}))):state.published?(state.publishedNotes||[]).filter(n=>n.authorId!==id):[])],diaries:Object.values(state.students).filter(x=>x.diary.versions.length).map(x=>({id:x.id,name:x.name,path:x.path,versions:x.diary.versions})),feedback:feedbackRecords(state).filter(f=>f.author===id || f.recipient===id)};
}
