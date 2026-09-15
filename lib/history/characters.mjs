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
const expertLines=[
  '돌의 어떤 부분을 다듬으면 자르거나 찍는 데 도움이 될까? 주먹 도끼 사진을 보고 떠날 때 챙길 도구를 생각해 보자.',
  '먹을 것을 담아 둘 그릇이 필요하구나. 토기의 모양을 살피며 보관과 조리에 어떻게 썼을지 이야기해 보자.',
  '밭에서 쓰는 돌칼과 청동 거울은 쓰임이 달라. 빛나는 것만 보지 말고 오늘 네 일에 필요한 도구를 찾아보렴.',
  '실과 그물을 만드는 일에는 손이 많이 가지. 뼈바늘과 가락바퀴를 살피며 옷을 받을 사람을 떠올려 보자.',
  '함께 쓰는 물건을 지키려면 어떤 약속이 필요할까? 토기를 살펴본 뒤, 전해지는 법으로 당시 생활을 알아보자.',
  '도구를 보면 사람들이 하는 일도 떠올릴 수 있지. 철검과 낫의 쓰임을 구분하고 두 나라의 풍습도 비교해 보렴.',
  '이웃을 찾아가는 길에도 서로 지켜야 할 것이 있단다. 교과서 지도와 동예의 풍습을 보고 네가 묻고 싶은 말을 생각해 보자.',
  '농사 도구와 교류의 흔적은 서로 다른 이야기를 들려줘. 낫과 다호리 붓을 비교하되, 다호리 한 곳의 자료를 삼한 전체로 넓혀 생각하지는 말자.',
  '비석은 오랜 시간이 지나도 이야기를 전해 주지. 광개토 대왕릉비를 살피고 장수왕 때의 일과 구분해 보자.',
  '바닷길에서는 물건과 소식이 함께 오가지. 칠지도를 교류의 자료로 살펴보자. 이 항구의 특정 배에 실렸다고 단정할 수는 없어.',
  '돌에 남은 흔적과 지도를 함께 보면 새 길의 의미가 보일 거야. 진흥왕 순수비와 한강 유역을 연결해 보렴.',
  '이 덩이쇠는 철의 재료이면서 화폐로도 쓰였어. 다른 지역에서 이것을 받을 사람이 무엇을 만들지 상상해 볼까?',
  '소식의 순서가 바뀌면 이야기도 달라져. 나당 동맹 다음에 왜 서로 싸우게 되었는지 차례대로 살펴보자.',
  '떠나온 곳의 기억을 새 이웃에게 전하고 싶구나. 두 수막새는 문화가 이어진 흔적을 비교하는 자료야. 건국 순간에 함께 쓰였다고 보지는 말자.',
  '누군가의 안녕을 바라는 마음으로 이곳을 찾았니? 석탑과 경전의 실물 자료를 보며 불교가 사람들 생활에 어떤 의미였을지 생각해 보렴.',
  '지붕 끝의 무늬에도 이어받은 문화가 담겨 있지. 수막새와 은화를 서로 다른 단서로 살피며 발해가 주변과 어떻게 연결되었는지 찾아보자.',
];
export function charactersFor(id){
  const [group,letter]=id.split('-'),quadrant=letter.charCodeAt(0)-65;
  const [name,role,guideName,guideRole]=cast[(Number(group)-1)*4+quadrant];
  return {
    player:{image:`/history/players-${group}-v1.png`,quadrant},
    companion:{image:'/history/npc-companions-v1.png',column:quadrant,row:Number(group)-1,name,role},
    expert:{image:'/history/npc-experts-v1.png',column:quadrant,row:Number(group)-1,name:guideName,role:guideRole,dialogue:expertLines[(Number(group)-1)*4+quadrant]},
  };
}
export function spriteStyle(appearance,facing=0,frame=0){
  const player=appearance.quadrant!==undefined,rows=player?8:4;
  const column=player?appearance.quadrant:appearance.column;
  const row=player?facing*2+frame%2:appearance.row;
  return {backgroundImage:`url(${appearance.image})`,backgroundSize:`400% ${rows*100}%`,backgroundPosition:`${column*100/3}% ${row*100/(rows-1)}%`};
}

// Preserve the same low-poly identities used on the map.
export function portraitStyle(id,speaker) {
  const appearance=charactersFor(id)[speaker];
  if(speaker==='companion')return {...spriteStyle(appearance),backgroundImage:'url(/history/dialogue-companions-lowpoly-v1.png)'};
  const rows=speaker==='player'?8:4,column=speaker==='player'?appearance.quadrant:appearance.column;
  const row=speaker==='player'?0:appearance.row;
  // Show the upper 65% of the existing sprite cell as a dialogue portrait.
  return {backgroundImage:`url(${appearance.image})`,backgroundSize:`${4/.65*100}% ${rows/.65*100}%`,backgroundPosition:`${(column+.175)/(4-.65)*100}% ${row/(rows-.65)*100}%`};
}
