# 주제별 캐릭터 제작 기록

사용 도구: 기본 image_gen. 사용자 지시: 주제별 학생·NPC 외형 변경, 대머리 고정 해제, **3D 로우폴리 스타일 유지**. 역사 인물 사용은 선택 사항으로 받아들여 현재는 이름·역할이 다른 가상 인물 32명을 배정했다. 복식은 교육용 단순화이며 완전한 역사 복원이라고 주장하지 않는다.

학생: 4장, 각 장은 주제 4개(열) × 방향별 두 걸음(8행). 아래·왼쪽·오른쪽·뒤 방향 순서. NPC: 대화 인물 16명과 자료를 함께 살피는 직업 인물 16명, 각각 4×4 배치. 직업과 대사는 `lib/history/characters.mjs`에 있다.

## 로우폴리 최종 시안 원본

원본 폴더: `C:/Users/user/.codex/generated_images/01a09a7b-7518-7703-b398-d505dd16c803/`

| 용도 | 원본 파일 |
|---|---|
| 학생 1 | exec-64c014cc-ed63-439e-8e1f-bf751163fe43.png |
| 학생 2 | exec-69fbed8f-3d72-434d-af6c-a10ca6e8433f.png |
| 학생 3 | exec-275cbbcd-d920-4117-ba6c-48d361b8b406.png |
| 학생 4 | exec-7944a964-65f5-46a7-a842-ef73780bc588.png |
| 대화 NPC | exec-90366f15-43c0-440a-8e42-1403e3f6be6b.png |
| 직업 NPC | exec-f956bc70-36ea-436d-b390-c985e2fbbdb1.png |

## 후처리 및 적용 완료

사용자가 코드로 배경 제거·프레임 정렬을 명시적으로 허용했다. `scripts/process-history-sprites.py`로 로컬 U2NetP 분리 마스크를 적용하고 가장 큰 캐릭터 영역을 남겼다. 원래 로우폴리 색·형태를 다시 그리지 않는다. 회색 머리·의상이 보존되는지 샘플과 전체 정면 모음을 확인했다. 청동기 농부에 생성기가 추가한 금속 낫은 이전 로우폴리 후보에서 곡식만 든 프레임을 선택하여 피했다.

최종 파일: `public/history/players-1-v1.png`~`players-4-v1.png`(각 768×1536), `npc-companions-v1.png`, `npc-experts-v1.png`(각 768×768). 학생은 192px 정사각 프레임, 4열·8행으로 통일했다. NPC는 4열·4행이다. 학생 한 명의 모든 자세는 같은 배율과 발 기준선을 사용한다. 잘린 뒷모습(1·4묶음)과 두 번째 오른쪽 걸음이 없는 2묶음은 온전한 같은 방향 프레임을 반복한다. 따라서 해당 방향은 완전한 두 걸음 애니메이션이 아니다.

원본은 `assets/history/characters-source/`에 보존한다. 임시 처리 도구·모델은 `tmp/`의 제외된 폴더에만 설치되며 앱 의존성에 추가하지 않았다. 최종 PNG에 실제 알파 채널과 투명 픽셀이 있는지 테스트한다. 애니메이션풍 시안은 게임 파일에서 교체했다.

## 최종 스타일 교정 프롬프트

학생 이미지와 기존 `character-walk.png`를 각각 편집 대상과 스타일 기준으로 제공했다.

> STYLE CORRECTION of first image sprite atlas. Second image is authoritative 3D LOW POLY mascot style. Keep first image EXACT 4 columns x 8 rows and each costume, hairstyle, pose direction and gait in its exact cell. Convert ALL 32 figures to the second image's HUGE geometric faceted heads, tiny squat bodies, small simple dark DOT eyes, triangular cheek and nose planes, matte polygonal surfaces and flat-shaded 3D modeling. Hair must ALSO be chunky polygonal 3D shapes, never strands. Keep HAIR and period costumes from first image, NOT bald. No anime eyes, no manga, no drawn outlines, no painted textures, no glossy cartoon eyes, no 2D illustration. Transparent PNG background with real alpha, no checkerboard. Every cell complete figure inside with at least 8% safe padding, same 4x8 grid, NO labels. This is a rendered low polygon 3D game asset.

NPC는 같은 스타일 지시와 함께 4×4 배치, 역할·얼굴·나이·성별 유지, 사절의 과장된 왕관을 낮은 천 모자로 변경하도록 지시했다.
