# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

로컬에서 혼자/여럿이 즐기는 맥용 파티 게임 모음 (`🎲 랜덤게임`). 노래 맞추기, 이미지 맞추기, 팀 라운드전(토너먼트)으로 구성. React 19 + Vite + Tailwind v4. 데이터는 모두 브라우저 localStorage 와 로컬 파일에만 저장된다 — 백엔드 없음.

## Commands

```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 → http://localhost:5173
npm run build        # 프로덕션 빌드 (dist/)
npm run preview      # 빌드 결과 미리보기
npm run lint         # ESLint
```

테스트 프레임워크는 없다.

### 실행 전 필수 설정
`.env.local` (깃 제외)에 두 값을 채워야 노래 게임이 동작한다. `cp .env.example .env.local` 후 입력하거나, 앱의 **설정** 화면에서 입력할 수도 있다.
- `VITE_YT_API_KEY` — YouTube Data API v3 키
- `VITE_YT_PLAYLIST` — 재생목록 URL 또는 ID

## Architecture

### 화면 전환 (라우터 없음)
`src/App.jsx` 가 `useState('home')` 로 현재 화면 문자열 하나를 들고 조건부 렌더링한다. 라우팅 라이브러리 없음. 모든 화면은 `go(target, options?)` 콜백을 받아 이동하며, `options` 는 `App` 의 `gameOptions` 에 머지되어 다음 화면으로 전달된다. 새 화면을 추가하려면 `App.jsx` 의 import + `screen === '...'` 분기를 같이 추가해야 한다.

화면 흐름:
- `home` → `modeselect`(노래) / `imagesetup`(이미지) / `teamsetup`(라운드전) / `racetest` / `settings`
- 노래: `modeselect` → `song`(혼자) 또는 `battle`(대결)
- 이미지: `imagesetup` → `imagebattle`
- 라운드전: `teamsetup` → `tournamentsetup` → `tournament`. `tournament` 는 마지막 라운드 직전 'race' phase 에서 `FaceRaceGame` 미니게임을 인라인 렌더링한다 (별도 화면 아님).

### 데이터 소스 — 빌드 타임 glob
이미지·참가자 명단은 DB나 API가 아니라 `import.meta.glob` 으로 파일시스템에서 빌드 시 읽는다. **폴더에 파일을 넣으면 코드 수정 없이 반영된다.**
- `src/lib/images.js` — `src/images/<카테고리>/<정답>.png`. 파일명 = 정답, 폴더명 = 카테고리. `CATEGORY_LABELS` 에서 영문 폴더명을 한글로 매핑(brand→브랜드, person→인물), 없으면 폴더명 그대로.
- `src/lib/players.js` — `src/players/players.json` + 같은 폴더의 `이름.png` 사진. 명단·사진은 `.gitignore` 처리(개인정보), `players.example.json` 만 커밋. 파일이 없어도 glob 이라 빌드가 깨지지 않는다. `name` 만 필수.

**macOS NFD 주의**: 맥은 한글 파일명을 자모 분리(NFD)로 저장한다. glob 으로 읽은 경로/파일명은 반드시 `.normalize('NFC')` 후 사용한다 — `images.js`, `players.js` 가 이미 그렇게 한다. 새로 파일명을 다루는 코드도 동일하게 해야 매칭이 깨지지 않는다.

### 영속성
`src/lib/storage.js` 가 유일한 localStorage 게이트웨이 (`quiz.` 프리픽스). 모든 read/write 는 이 모듈의 named 함수를 거친다. API 키/재생목록은 **localStorage 값 우선, 없으면 `.env.local` 값** 으로 폴백한다 (`getApiKey`, `getPlaylistInput`).

### YouTube
- `src/lib/youtube.js` — Data API 호출. `fetchPlaylistSongs` 로 곡 목록을 받고 `filterEmbeddableSongs` 로 임베드 가능한 곡만 거른다(삭제/비공개/임베드 불가 제외).
- `src/hooks/useSongLibrary.js` — 곡 목록 상태 관리. 앱 시작 시 자동 로드, 같은 재생목록 ID 면 캐시 재사용(`force=true` 로 강제 갱신). 곡이 바뀌면 `version` 증가로 화면 갱신.
- `src/hooks/useYouTubePlayer.js` — IFrame Player API 스크립트를 전역 1회만 로드(`apiPromise`), 숨겨진 플레이어 생성. 콜백은 ref 로 보관해 항상 최신 함수 사용.

### 팀/색상
`src/lib/teams.js` 의 `TEAM_COLORS` 는 Tailwind 클래스 문자열을 통째로 정의한다 — Tailwind v4 는 정적 클래스만 인식하므로 `bg-${color}` 같은 동적 조합은 동작하지 않는다. 팀 색은 항상 `teamColor(idx)` 로 가져온다. 최대 팀 수(`MAX_TEAMS`)는 색상 개수(6)에 묶여 있다.

## 작성 관례
- UI 텍스트·주석은 한국어. 기존 톤(친근한 설명체)을 따른다.
- 스타일링은 Tailwind 유틸리티 클래스 인라인. 별도 CSS 모듈 거의 없음.
