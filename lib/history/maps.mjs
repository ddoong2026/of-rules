// Schematic teaching maps: landmarks distinguish contexts, not archaeological reconstructions.
const scenes=[
  ['동굴 앞 이동 준비','cave','#c4b49a','사냥·채집','임시 거처'],
  ['강가의 정착 마을','river','#b3c89c','토기와 저장','움집'],
  ['농경 마을의 수확과 제사','dolmen','#ceca87','벼 수확','고인돌'],
  ['바닷가의 실 잣기와 바느질','coast','#a9cdc5','물고기잡이','옷 만들기'],
  ['고조선의 마을 질서','earthwall','#c6b08e','법과 질서','지배자'],
  ['부여와 고구려의 제천 행사 비교','ritual','#bdc9a9','부여 · 12월','고구려 · 10월'],
  ['동해안 마을의 경계','boundary','#b4cdbb','옥저 · 동해안','동예 · 마을 경계'],
  ['삼한의 벼농사와 철제 도구','forge','#b9c383','논과 농기구','교역'],
  ['고구려의 산성과 영토 확대','fort','#aeb9ac','광개토 대왕','장수왕 · 평양'],
  ['백제의 바닷길 교류','port','#b4d4d3','해상 교역','한강 유역'],
  ['신라의 한강 진출','tomb','#c7c291','경주','진흥왕 · 한강'],
  ['가야의 철 생산과 운송','forge','#bbae94','철 생산','낙동강 교역'],
  ['신라와 당의 관계 변화','fort','#b6bea0','나당 동맹','나당 전쟁'],
  ['새 터전으로 향하는 발해 건국','mountain','#adc2b8','고구려 유민','말갈 집단'],
  ['통일신라의 불교와 교류','temple','#bdc8a2','불국사·석굴암','청해진 · 다른 시기'],
  ['발해의 문화 계승과 교류','capital','#b5c4c1','고구려 문화 계승','교통로와 교류'],
];
export const mapFor=id=>{const [group,letter]=id.split('-');const [title,type,color,left,right]=scenes[(Number(group)-1)*4+letter.charCodeAt(0)-65];return {title,type,color,left,right};};
export const OBSTACLES=[{x:80,y:70,w:230,h:130},{x:670,y:70,w:210,h:130},{x:400,y:50,w:150,h:100}];
export const STATIONS=[{x:200,y:260},{x:340,y:270},{x:630,y:320},{x:750,y:440},{x:340,y:270},{x:500,y:490},{x:500,y:490}];
export const gameMapImage=group=>`/history/game-map-${group}-v2.png`;
export function walk(p,dx,dy) {
  const blocked=(x,y)=>x<30 || x>930 || y<30 || y>610 || OBSTACLES.some(o=>x>o.x-16&&x<o.x+o.w+16&&y>o.y-16&&y<o.y+o.h+16);
  const x=blocked(p.x+dx,p.y)?p.x:p.x+dx;
  return {x,y:blocked(x,p.y+dy)?p.y:p.y+dy};
}

export function walkToward(position,target,seconds) {
  const dx=target.x-position.x,dy=target.y-position.y,distance=Math.hypot(dx,dy);
  if(distance===0)return position;
  const speed=Math.min(190*seconds,distance);
  return walk(position,dx/distance*speed,dy/distance*speed);
}
