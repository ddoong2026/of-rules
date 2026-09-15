# 고증 수정 이미지 제작 기록

도구: 기본 제공 `image_gen`. 기존 마스코트와 래스터 스타일을 유지하고 교과서 페이지 및 추출한 개별 유물 사진을 참조했다. 모든 편집은 image_gen으로 수행했다. PDF 원본 사진은 별도로 추출하여 NPC 자료로 연결했다.

## 최종 선택

| 앱 파일 | 생성 원본 파일명 |
|---|---|
| exploration-1-v4.png | exec-86ae67e6-c4be-4f37-bd7e-2c6f3330cde2.png |
| exploration-2-v4.png | exec-fb187566-946d-4c6a-b2fc-b3a91636edc7.png |
| exploration-3-v4.png | exec-001cbf41-b536-47b2-84fc-c9040a24d11f.png |
| game-map-1-v2.png | exec-8e76383f-dc2d-44d6-8f19-8a7c38091e18.png |
| game-map-2-v2.png | exec-2a01dc8c-36b6-4c13-88ef-e515076a77c6.png |
| game-map-3-v2.png | exec-a1e7638c-bd6d-461c-84ff-cd6507da8d98.png |

생성 원본 폴더: `C:/Users/user/.codex/generated_images/01a09a7b-7518-7703-b398-d505dd16c803/`. 위 여섯 파일은 `public/history/`에 복사했다. 탐구4와 맵4는 기존 파일을 유지한다.

## 탐구 그림 편집 지시

공통: 첫 이미지는 편집 대상, 교과서 이미지는 유물 형태 참조만 사용. 네 구역과 대머리의 큰 다면체 머리·작은 몸 캐릭터를 유지. 학습용 유물은 실제 손에 들거나 생활 속에서 사용하며, 확대해서 조사할 수 있게 한다.

- 그림1: 반달 돌칼을 직선 윗변·완만한 곡선 아랫변과 두 구멍을 가진 납작한 돌 도구로 변경. 청동 거울 중앙의 큰 돌출부를 없애고 뒷면 위쪽의 작은 두 고리로 변경. 가락바퀴를 작은 납작한 토제 원반으로 축소. 돌그물추는 작은 홈 난 돌, 뼈바늘은 작은 귀가 있는 가는 바늘. 뾰족한 토기 밑, 무늬 없는 동굴, 식물성 섬유 옷감 유지.
- 그림2: 고조선 검의 톱날 제거, 부여의 창으로 잘못 바뀐 도구를 짧은 자루가 있는 직선 철검으로 수정. 낫의 넓고 짧은 휜 날을 교과서 사진과 대조. 붓의 양끝 털을 표현. 현대 벼루·장식 제천 기둥·동예의 연속 돌담 제거. 제천 행사의 두 시기는 장면을 구분.
- 그림3: 광개토 대왕릉비와 진흥왕 순수비의 다른 윤곽 반영. 가야 금동관의 넓은 판·둥근 돌출부와 납작한 덩이쇠 반영. 무덤의 노출된 정면 출입구와 과도한 성곽을 정리. 칠지도는 실물 사진과의 방향·비례 재대조가 남아 있으며 NPC에서 교과서 실물 사진을 제공.
- 그림4: 수막새 무늬와 은화·석탑 수정을 시도했으나 사각형 비교 삽입물이 생겨 최종 미채택. 이후 사용자 지시로 삽입물 제거가 필요.

## 최종 맵 프롬프트

### game-map-1-v2

Edit this Korean prehistoric 2x2 game atlas. User correction: this is a living world, NOT a museum or artifact hunt map. REMOVE ALL deliberate artifact displays: lower-left rectangular mat and stone knife/bronze mirror arranged upon it; lower-right rectangular mat and oversized spindle/needle/cloth display; upper-left isolated upright handaxe perched on pedestal-like rock. Replace display areas with natural earth, grass, small ordinary stones. Retain ordinary naturally used fishing nets, pots near houses, food drying, shell midden and working areas, no oversized objects, no boards, no placards, no square showcase mats. Preserve clean UNPAINTED cave, dry Neolithic cultivation, grinding slab, Bronze Age rice and dolmen, all four historical environments, same open paths and 2x2 grid, raster RPG quality, no characters or text. NPCs will explain artifacts in UI, do not add any artifacts.

### game-map-2-v2

Edit this 2x2 Korean early states game atlas. User wants natural living environments, no artifact displays. REMOVE upper-right rectangular mat displaying sword and sickle; remove lower-right giant brush/sickle and small dedicated exhibit bench; remove upper-left artifact mat within enclosure and any signboards. Fill removed areas with matching grass/earth. Keep ordinary tools only if naturally part of a workplace, no oversized tools, no lined-up samples, no object showcase, no explanatory text. Preserve dolmen and palisade Gojoseon, open Buyeo plain/Goguryeo valley, two modest east-coast hamlets with natural grass boundary not stone wall, Samhan rice and small clay furnace. Keep no flags/emblems, no waterwheel, no royal architecture. EXACT same 2x2 positions and broad playable paths. No characters or UI. NPCs will supply artifact teaching, do not add any new objects for teaching.

### game-map-3-v2

Edit this four-quadrant Korean kingdoms RPG game atlas. User rejects artifact display boards. REMOVE the entire huge rectangular sword display panel in upper-right Baekje quadrant, and REMOVE the entire rectangular crown/iron-plate display board in lower-right Gaya quadrant. Replace those areas with natural dirt/grass and ordinary cargo baskets near work shelter, without artifacts on display. Do NOT add replacement showcases, mats, signs or teaching props anywhere. Keep existing historically corrected rough Goguryeo monolith and irregular Jinheung slab as natural standing monuments, plain grassy Silla burial mounds, Baekje harbor, Gaya modest earthen furnace; same 2x2 quadrant composition and open walkable paths, no flags/crests, no characters or text. NPCs teach artifacts, this map is a natural setting. Output full3:2 atlas.

## 미완료 편집

마지막 이미지 호출이 HTTP 429 `usage_limit_reached`로 실패했다. 다른 API/유료 도구로 우회하지 않았다. 아래 프롬프트의 출력은 없으며 앱은 기존 `game-map-4.png`를 사용한다. 그림4도 기존 `exploration-4-v3.png`를 유지한다. 최종 고증 통과를 선언하지 않는다.

입력: `exec-3d241134-4313-4cbd-9590-f3dcbc2de28c.png`.

Precise removal edit to this Korean history 2x2 RPG map atlas. User says no forced artifacts on rectangles; NPC supplies teaching. REMOVE the rectangular two-tile display at bottom of upper-right quadrant. REMOVE rectangular tile/coin exhibit at right of lower-right quadrant. REMOVE lower-left scripture display desk. Replace each with matching natural soil/grass or ordinary courtyard paving, no replacement boards/mats/exhibits. Keep corrected Seokgatap three main roof levels, inland Buddhist temple, early Silla camp, Balhae modest forest settlement, later Balhae axial palace road and ordinary merchants. Keep exact four quadrants, open walkable cross paths, raster textures, no text, no people, no giant teaching objects. Preserve all other details.

탐구4의 다음 편집: `exec-f81290f2-7263-462a-aecf-27a91374170c.png`에서 오른쪽 위 수막새 비교 사각형과 왼쪽 아래 항구 삽입 화면 제거. 불국사는 내륙 산지 장면으로 유지. 문화 유물은 오른쪽 아래 생활 장면의 자연스러운 작업·교류 맥락 안에만 표현하며, 상자나 전시판으로 강조하지 않는다. 문화 비교와 청해진 설명은 NPC 자료로 처리. 은화는 손바닥보다 작은 크기, 교과서 사진의 인물 문양을 참조. 캐릭터 정체성 유지.
