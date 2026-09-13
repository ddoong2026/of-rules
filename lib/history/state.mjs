import { ACTIVITIES, PATHS, REACTIONS, STEPS, VERSION, pathById } from './content.mjs';

export function createLesson(roster) {
  if (!Array.isArray(roster) || roster.length !== 16 || new Set(roster.map(s=>s.id)).size !== 16) throw Error('서로 다른 학생 16명을 배정해 주세요.');
  return { version: VERSION, published:false, revealed:false, sequence:0, activity:'준비', commands:[], operations:[], cards:{}, feedback:{}, students:Object.fromEntries(roster.map((s,i)=>[s.id,{id:s.id,name:s.name,path:PATHS[i].id,group:PATHS[i].group,activity:'준비',ack:0,revision:0,notes:[],research:{},diary:{answers:{},text:'',versions:[]},feedbackDraft:{reaction:'',text:''},attempts:{},grants:[],lastSeen:null}])) };
}
const fail = message => { throw Error(message); };
const text = value => typeof value === 'string' ? value : '';
function submitDiary(s, forced=false) {
  const path=pathById(s.path);
  if (!forced && (!s.diary.text.trim() || path.questions.some(q=>!Number.isInteger(s.diary.answers[q.id])))) fail('선택 문장과 감정·생각을 작성해 주세요.');
  const versions=s.diary.versions;
  const record={answers:{...s.diary.answers},text:s.diary.text,path:s.path,contentVersion:VERSION,forced};
  if (JSON.stringify(versions.at(-1)?.answers)===JSON.stringify(record.answers) && versions.at(-1)?.text===record.text) return;
  versions.push({...record,version:versions.length+1});
}
function submitFeedback(state,s,forced=false) {
  const f=s.feedbackDraft;
  const valid=REACTIONS.includes(f.reaction) && !!f.text.trim() && !!s.target;
  if (!valid && !forced) fail('반응 하나와 댓글을 작성해 주세요.');
  if (s.target) state.feedback[s.id]={author:s.id,...s.target,reaction:f.reaction,text:f.text,valid,forced,approved:false};
}
function forceCurrent(state,s) {
  if(s.activity==='일기') submitDiary(s,true);
  if(s.activity==='피드백' && !state.feedback[s.id]?.valid) submitFeedback(state,s,true);
  if(s.activity==='조사') Object.values(state.cards).filter(c=>c.owner===s.id || Object.hasOwn(s.research || {},c.id)).forEach(c=>{c.status='강제 제출';});
  if(s.activity==='3D') {const a=s.attempts[s.activePath || s.path]; if(a && !a.complete) a.interrupted=true;}
}
export function applyOperation(original, actor, teacher, op, preview=false) {
  const state=structuredClone(original);
  if (!op || typeof op.id!=='string' || !op.id || typeof op.type!=='string') fail('유효하지 않은 요청입니다.');
  if(state.operations.includes(op.id)) return state;
  const s=state.students[actor];
  if (!teacher && !s) fail('이 수업에 배정되지 않았습니다.');
  if(op.type==='publish' || op.type==='reveal' || op.type==='move' || op.type==='assignFeedback' || op.type==='approve') {
    if(!teacher) fail('교사만 실행할 수 있습니다.');
    if(op.type==='publish') state.published=true;
    if(op.type==='reveal') state.revealed=true;
    if(op.type==='move') {
      if(!ACTIVITIES.includes(op.activity) || !Array.isArray(op.targets) || !op.targets.length || op.targets.some(id=>!state.students[id])) fail('활동 또는 이동 대상이 올바르지 않습니다.');
      // Content cannot be enabled by a client flag or teacher role alone.
      if(!preview && op.activity!=='준비' && PATHS.some(p=>!p.ready)) fail('검수되지 않은 콘텐츠가 있어 학생 수업을 시작할 수 없습니다. 교사 미리보기에서 흐름을 확인해 주세요.');
      state.sequence++;
      for(const id of op.targets) state.students[id].command={sequence:state.sequence,activity:op.activity};
      state.activity=op.activity;
      state.commands.push({id:op.id,sequence:state.sequence,targets:op.targets,activity:op.activity});
    }
    if(op.type==='assignFeedback') {
      const candidates=Object.values(state.students).filter(x=>x.diary.versions.at(-1)?.text.trim() || Object.keys(x.diary.versions.at(-1)?.answers || {}).length);
      // A shuffled ring prevents self-assignment and balances recipients, including same-group peers.
      const shuffled=candidates.map(x=>({x,key:Math.random()})).sort((a,b)=>a.key-b.key).map(v=>v.x);
      if(shuffled.length>1) shuffled.forEach((x,i)=>{
        if(state.feedback[x.id]?.valid) return;
        const target=shuffled[(i+1)%shuffled.length];
        x.target={recipient:target.id,path:target.path,version:target.diary.versions.at(-1).version};
      });
      for(const x of Object.values(state.students)) if(!candidates.includes(x) && shuffled.length && !state.feedback[x.id]?.valid) {
        const target=shuffled[0]; x.target={recipient:target.id,path:target.path,version:target.diary.versions.at(-1).version};
      }
    }
    if(op.type==='approve') Object.values(state.feedback).filter(f=>f.valid && !f.approved).forEach(f=>{f.approved=true;const a=state.students[f.author]; if(!a.grants.includes(f.path)) a.grants.push(f.path);});
  } else {
    if(!s) fail('학생 기록이 없습니다.');
    s.lastSeen=new Date().toISOString();
    if(op.type==='ack') {
      if(s.command && op.sequence===s.command.sequence && s.ack<op.sequence) {
        s.supplement=!!s.supplement || s.activity==='3D' || ['일기','피드백','정리'].includes(s.command.activity);
        forceCurrent(state,s);s.activity=s.command.activity;s.ack=op.sequence;
      }
    } else if(op.type==='draft') {
      if(op.base!==s.revision) fail('CONFLICT: 다른 탭의 기록이 변경되었습니다. 로컬 초안을 확인해 주세요.');
      const d=op.draft;
      if(!d || !Array.isArray(d.notes) || !d.diary || !d.feedbackDraft) fail('기록 형식이 올바르지 않습니다.');
      if(d.notes.some(n=>!['보이는 것','궁금한 것','내 생각·추측'].includes(n.kind) || !Number.isFinite(n.x) || n.x<0 || n.x>1 || !Number.isFinite(n.y) || n.y<0 || n.y>1 || ![1,2,3,4].includes(n.image))) fail('관찰 위치가 올바르지 않습니다.');
      s.notes=d.notes.map(n=>({id:text(n.id),image:n.image,x:n.x,y:n.y,kind:n.kind,text:text(n.text)}));
      const answers={};
      for(const q of pathById(s.path).questions) {const v=d.diary.answers?.[q.id]; if(Number.isInteger(v) && v>=0 && v<q.options.length) answers[q.id]=v;}
      s.diary={...s.diary,answers,text:text(d.diary.text)};
      s.feedbackDraft={reaction:text(d.feedbackDraft.reaction),text:text(d.feedbackDraft.text)};
      const research={};
      for(const [id,r] of Object.entries(d.research || {})) {
        if(!/^[a-z\d-]{1,80}$/i.test(id) || !r || !PATHS.filter(p=>p.group===s.group).some(p=>p.artifacts.includes(r.artifact))) fail('조사 카드가 올바르지 않습니다.');
        const old=state.cards[id];
        if(old && old.group!==s.group) fail('다른 모둠의 카드는 수정할 수 없습니다.');
        const fields={name:text(r.name),usage:text(r.usage),source:text(r.source)};
        const prior=s.research?.[id];
        if(old && prior && Object.entries(fields).every(([k,v])=>prior[k]===v)) {
          research[id]={artifact:old.artifact,name:old.name,usage:old.usage,source:old.source,base:old.revision};
          continue;
        }
        const changed=!old || Object.entries(fields).some(([k,v])=>old[k]!==v);
        if(changed && old && r.base!==old.revision) fail('CONFLICT: 공동보드가 변경되었습니다. 로컬 초안과 새 카드를 비교해 주세요.');
        if(changed) state.cards[id]={id,artifact:r.artifact,group:s.group,owner:old?.owner || actor,helpers:[...new Set([...(old?.helpers || []),actor])],...fields,revision:(old?.revision || 0)+1,status:'초안'};
        research[id]={artifact:r.artifact,...fields,base:state.cards[id].revision};
      }
      s.research=research;
      s.revision++;
    } else if(op.type==='submitResearch') {
      const card=state.cards[op.cardId];
      if(s.activity!=='조사' || !card || card.group!==s.group) fail('우리 모둠 조사 활동에서 제출해 주세요.');
      if(!card.name.trim() || !card.usage.trim()) fail('명칭과 쓰임을 작성해 주세요.');
      card.status='제출';
    } else if(op.type==='diary') {
      if(s.activity!=='일기') fail('일기 활동에서 제출해 주세요.'); submitDiary(s);
    } else if(op.type==='feedback') {
      if(s.activity!=='피드백') fail('피드백 활동에서 제출해 주세요.');
      if(state.feedback[s.id]?.valid) fail('이미 제출한 피드백입니다.');
      submitFeedback(state,s);
    } else if(op.type==='step') {
      if(s.activity!=='3D') fail('체험 활동에서 진행해 주세요.');
      const path=op.path || s.path;
      if(path!==s.path && !s.grants.includes(path)) fail('승인되지 않은 맵입니다.');
      if(!pathById(path) || (!preview && !pathById(path).ready)) fail('검수되지 않은 맵입니다.');
      const a=s.attempts[path] || {checkpoint:0,seen:[],complete:false,mode:op.mode==='alternative'?'alternative':'3D'};
      if(op.step===a.checkpoint && op.step<STEPS.length){a.checkpoint++; if([1,3].includes(op.step)) a.seen.push(op.step===1?0:1);}
      a.complete=a.checkpoint===STEPS.length;s.attempts[path]=a;s.activePath=path;
    } else if(op.type==='enterDiary') {
      if(!s.attempts[s.path]?.complete) fail('기본 체험을 마치면 일기로 이동할 수 있습니다.');s.activity='일기';
    } else if(op.type!=='heartbeat') fail('지원하지 않는 동작입니다.');
  }
  // ponytail: bounded idempotency ledger for a 40-minute lesson; archive externally for multi-day runs.
  state.operations.push(op.id); state.operations=state.operations.slice(-4096);
  return state;
}
export function studentView(state,id) {
  const s=state.students[id]; if(!s) fail('이 수업의 학생이 아닙니다.');
  return {version:state.version,published:state.published,revealed:state.revealed,activity:state.activity,me:s,cards:Object.values(state.cards).filter(c=>c.group===s.group),notes:Object.values(state.students).flatMap(x=>state.published || x.id===id?x.notes.map(n=>({...n,author:x.name})):[]),diaries:Object.values(state.students).filter(x=>x.diary.versions.length).map(x=>({id:x.id,name:x.name,path:x.path,versions:x.diary.versions})),feedback:Object.values(state.feedback).filter(f=>f.author===id || f.recipient===id)};
}
