// Names and appearances are fictional teaching characters, not recovered portraits.
const cast=[
  ['가람','채집 무리의 어른','돌이','뗀석기 만드는 사람'],
  ['여울','먹을거리를 보관하는 이웃','소담','토기 빚는 사람'],
  ['마루','곡식을 거두는 사람','나래','청동 도구 만드는 사람'],
  ['바다','실 잣는 사람','모래','그물 만드는 사람'],
  ['한울','마을의 질서를 이야기하는 어른','누리','토기 빚는 사람'],
  ['겨울','부여의 제천 행사 준비자','무쇠','철제 도구 만드는 사람'],
  ['솔','동예의 이웃 마을 중재자','해길','동해안 길잡이'],
  ['들꽃','삼한의 농사짓는 사람','가온','교류에 참여하는 사람'],
  ['산','고구려의 소식 전달자','다온','비문을 살피는 사람'],
  ['물결','백제 항구의 뱃사람','온유','백제의 교류 사절'],
  ['별','신라의 소식 전달자','돌찬','신라의 돌 다루는 사람'],
  ['쇠울','가야의 철 운송자','아라','가야의 철 장인'],
  ['봄','평범한 하루를 기다리는 어머니','새길','신라의 소식 전달자'],
  ['새봄','새 터전을 마련하는 이웃','그루','고구려의 생활을 기억하는 어른'],
  ['보리','불국사를 찾은 사람','혜담','불교 문화를 들려주는 승려'],
  ['이음','발해의 교역자','연화','발해의 기와 만드는 사람'],
];
export function charactersFor(id){
  const [group,letter]=id.split('-'),quadrant=letter.charCodeAt(0)-65;
  const [name,role,guideName,guideRole]=cast[(Number(group)-1)*4+quadrant];
  return {
    player:{image:`/history/players-${group}-v1.png`,quadrant},
    companion:{image:'/history/npc-companions-v1.png',column:quadrant,row:Number(group)-1,name,role},
    expert:{image:'/history/npc-experts-v1.png',column:quadrant,row:Number(group)-1,name:guideName,role:guideRole},
  };
}
export function spriteStyle(appearance,facing=0,frame=0){
  const player=appearance.quadrant!==undefined,rows=player?8:4;
  const column=player?appearance.quadrant:appearance.column;
  const row=player?facing*2+frame%2:appearance.row;
  return {backgroundImage:`url(${appearance.image})`,backgroundSize:`400% ${rows*100}%`,backgroundPosition:`${column*100/3}% ${row*100/(rows-1)}%`};
}
