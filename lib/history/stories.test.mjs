import test from 'node:test';
import assert from 'node:assert/strict';
import {PATHS,STEPS} from './content.mjs';
import {portraitStyle} from './characters.mjs';
import {mapFor} from './maps.mjs';
import {existsSync} from 'node:fs';
import {STORIES,storyLines,questDialogue} from './stories.mjs';

test('all 32 quizzes have their required evidence in the preceding NPC conversation and retry hint',()=>{
  // Learning objectives checked independently of the dialogue data/order.
  const evidence={
    '1-A':[['사냥','채집'],['먹을 것','다른 곳','이동']],
    '1-B':[['움집','머물','농사'],['곡식','조리']],
    '1-C':[['청동','무기','제사'],['돌을 갈','간석기','생활 도구']],
    '1-D':[['물고기','바다'],['식물','실']],
    '2-A':[['옛 기록','단군왕검','전해'],['법 조항','생명','재산','약속']],
    '2-B':[['부여','고구려','하늘','제사'],['닮은 점','다른 점','함께']],
    '2-C':[['옥저','동예','동해안'],['동예','침범하지 않는']],
    '2-D':[['마한·진한·변한','삼한'],['철제 농기구','생산량','늘릴']],
    '3-A':[['광개토 대왕','만주','영토'],['장수왕','수도','평양']],
    '3-B':[['백제','한강 유역'],['영토','넓히고','바닷길']],
    '3-C':[['신라','경주'],['한강','중국','직접 교류']],
    '3-D':[['철','풍부'],['여러 나라','연맹']],
    '4-A':[['신라','당','동맹'],['당','지배','맞서']],
    '4-B':[['고구려 유민','말갈'],['발해','고구려 문화','이어받']],
    '4-C':[['불교','일반 백성'],['청해진','당·일본','무역']],
    '4-D':[['고구려 문화','중국 문화','발전'],['교통로','교류']],
  };
  for(const path of PATHS)for(const [index,question] of path.questions.entries()){
    const turns=questDialogue(path,index+1);
    const spoken=turns.filter(t=>t.speaker!=='player').map(t=>t.text).join(' ');
    assert.equal(turns[0].speaker,'player');
    assert.equal(turns.at(-1).speaker,'player');
    for(const word of evidence[path.id][index]){
      assert.ok(spoken.includes(word),`${question.id}: missing prior evidence ${word}`);
      assert.ok(question.hint.includes(word),`${question.id}: unrelated retry hint ${word}`);
    }
  }
});

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

test('all 112 quests have player and NPC dialogue, portraits, and preserve both local places',()=>{
  for(const path of PATHS){
    const spoken=STEPS.flatMap((_,step)=>questDialogue(path,step).map(t=>t.text));
    assert.equal(new Set(spoken).size,spoken.length,`${path.id}: repeated spoken line`);
    for(let step=0;step<STEPS.length;step++){
      const turns=questDialogue(path,step);
      assert.ok(turns.some(t=>t.speaker==='player'));
      assert.ok(turns.some(t=>t.speaker!=='player'));
      for(const turn of turns){
        assert.ok(turn.text.trim());
        const portrait=portraitStyle(path.id,turn.speaker);
        assert.ok(!JSON.stringify(portrait).includes('NaN'));
        const file=portrait.backgroundImage.slice(5,-1);
        assert.ok(existsSync(new URL('../../public/'+file,import.meta.url)));
      }
    }
    assert.ok(questDialogue(path,0).some(t=>t.text.includes(mapFor(path.id).left)));
    assert.ok(questDialogue(path,3).some(t=>t.text.includes(mapFor(path.id).right)));
  }
});
