# 규칙의 나라 (Class Republic)

규칙의 나라는 Next.js와 React Three Fiber(R3F)를 기반으로 구축된 **3D 학급 경영 및 게이미피케이션 플랫폼**입니다. 교사와 학생이 입법(국회), 행정(정부), 경제 활동을 3D 메타버스 환경에서 직접 체험하고 만들어갈 수 있도록 설계되었습니다.

## 🚀 Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **UI & 3D Rendering:** React, React Three Fiber (R3F), Three.js, Drei
- **State Management:** Zustand
- **Database & Auth:** Supabase (PostgreSQL, RPC, Auth)
- **Styling:** CSS Modules, Inline Styles (Glassmorphism UI)

---

## 🏗️ Core Features & Architecture

### 1. 3D World & Editor (메타버스 및 맵 에디터)
- **`Map3D`**: 메인 3D 월드 화면으로, 인게임 플레이어(`Character`)와 상호작용 가능한 요소들이 배치되는 뷰어입니다.
- **`MapEditor` / `MapEditorLegacy`**: 
  - **지형 생성 (Terrain):** 지형의 높낮이 조절, 물(Water) 배치, 브러시를 이용한 페인팅이 가능합니다.
  - **에셋 및 커스텀 아이템 배치 (AssetManager):** 나무, 바위, 집, NPC, 그리고 **직접 만든 커스텀 3D 모델(GLTF/GLB)** 을 맵에 배치할 수 있습니다. 
  - *최근 업데이트:* 커스텀 아이템 배치 시 바닥면(Bounding Box)을 계산해 지면에 정확히 맞닿도록 보정(`GenericGLTFAsset`)하는 기능이 추가되었습니다.
  - **구역 및 퀘스트 설정 (BoundaryManager):** 특정 구역에 접근 시 퀘스트가 발동되거나 메시지가 뜨도록 설정할 수 있습니다.
- **`VoxelEditor`**: 마인크래프트처럼 블록을 쌓거나 파내고 색칠하여 자신만의 지형이나 커스텀 에셋을 디자인할 수 있는 3D 에디터입니다.

### 2. Assembly (국회)
학급의 법(규칙)을 제정하고 건의하는 공간입니다.
- **`LawForm` / `LawsTab`:** 새로운 법안을 발의하고 투표를 통해 통과시킬 수 있습니다.
- **`PetitionsTab`:** 학생들의 건의사항(청원)을 작성하고 관리합니다.
- **`RulebookTab`:** 제정된 학급 규칙(법률)을 열람합니다.

### 3. Government (정부)
국가를 운영하는 행정부의 역할을 담당하며, 경제 정책을 총괄합니다.
- **`EconomyGridTab` / `TaxTab` / `FinanceTab`:** 
  - 세금, 복지 비용, 직업별 월급 등을 설정하고 국가 예산을 관리합니다.
- **`DecreeForm` / `DecreesTab`:** 정부의 행정 명령(포고령)을 공포합니다.
- **`ReceivedLawsTab`:** 국회에서 넘어온 법안을 확인하고 처리합니다.

### 4. Economy (경제 시스템)
학생들이 경제 활동을 통해 재화를 획득하고 소비하는 시스템입니다. Supabase RPC를 통해 무결성이 보장된 트랜잭션으로 처리됩니다.
- **`BankTab`:** 예금, 출금, 이자 수익 관리.
- **`ShopTab`:** 맵 에디터용 커스텀 에셋이나 소모품 구매.
- **`StockTab`:** 주식(모의 투자) 시스템을 통한 자산 증식.

### 5. Teacher Dashboard (교사 전용)
교사가 학급 전체의 활동을 모니터링하고 제어하는 관리자 페이지입니다.
- **`ActivityLogsTab`:** 학생들의 경제 활동, 법안 발의, 퀘스트 달성 등 모든 활동 로그를 실시간으로 확인합니다.
- **`EconomyAdminTab`:** 경제 시스템의 밸런스를 조정하거나 특정 학생에게 재화를 지급/차감합니다.
- **`QuestLogsTab`:** 학생들의 퀘스트 진행 상황을 모니터링합니다.

---

## 📂 Directory Structure

```text
📦 규칙의나라 (class-republic)
 ┣ 📂 app
 ┃ ┣ 📂 api         # API 라우트
 ┃ ┣ 📂 assembly    # 국회 페이지
 ┃ ┣ 📂 economy     # 경제 페이지
 ┃ ┣ 📂 government  # 정부 페이지
 ┃ ┣ 📂 teacher     # 교사 페이지
 ┃ ┣ 📜 page.js     # 메인 3D 월드 (Map3D) 진입점
 ┃ ┗ 📜 layout.js   # 전역 레이아웃 및 폰트 설정
 ┣ 📂 components
 ┃ ┣ 📂 Assembly    # 법안 발의, 청원, 법전 UI
 ┃ ┣ 📂 Economy     # 은행, 상점, 주식 UI
 ┃ ┣ 📂 Government  # 세금, 복지, 행정 UI
 ┃ ┣ 📂 Teacher     # 활동 로그, 관리자 패널 UI
 ┃ ┣ 📂 MapEditor   # 3D 맵 에디터 컴포넌트 모음 (지형, 에셋 매니저 등)
 ┃ ┣ 📂 VoxelEditor # 복셀 빌딩 시스템 컴포넌트
 ┃ ┗ 📜 AuthProvider.jsx # 전역 인증 및 권한 관리 (Supabase Auth)
 ┣ 📂 store
 ┃ ┣ 📜 useMapStore.js      # 3D 맵 상태 관리
 ┃ ┣ 📜 useVoxelStore.js    # 복셀 에디터 상태 관리
 ┃ ┗ 📜 useInventoryStore.js # 유저 인벤토리 및 퀘스트 상태 관리
 ┣ 📂 supabase
 ┃ ┗ 📜 economy_init.sql # 데이터베이스 스키마 및 트랜잭션 RPC 스크립트
 ┗ 📜 package.json
```

---

## 🛠️ State Management & Data Flow
- 3D 렌더링에 필요한 무거운 상태(예: 지형 배열, 배치된 에셋 목록)는 **Zustand**를 사용하여 렌더링 최적화를 진행했습니다.
- 유저 데이터, 법안, 경제 내역 등 영구 저장이 필요한 데이터는 **Supabase PostgreSQL**에 실시간(Realtime) 연동 또는 RPC 프로시저를 통해 동기화됩니다.

---

## 💻 Getting Started (개발 서버 실행)

```bash
# 패키지 설치
npm install

# 환경변수 설정 (.env.local)
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# 개발 서버 실행
npm run dev
```
