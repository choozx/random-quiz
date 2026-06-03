# 🎧 1초 퀴즈

노래를 1초만 듣고 제목을 맞추는, 맥에서 혼자 즐기는 로컬 웹 게임.
React + Vite + Tailwind + YouTube IFrame Player API.

## 다른 컴퓨터에서 처음 실행하기

```bash
# 1. 클론
git clone <이 저장소 주소>
cd random_quiz

# 2. 의존성 설치
npm install

# 3. 설정 파일 만들기 (.env.local 은 깃에 없으므로 직접 생성)
cp .env.example .env.local
#   그런 다음 .env.local 을 열어 두 값을 채운다:
#   - VITE_YT_API_KEY  : 유튜브 Data API 키
#   - VITE_YT_PLAYLIST : 재생할 유튜브 재생목록 URL 또는 ID

# 4. 실행
npm run dev
```

실행 후 브라우저에서 **http://localhost:5173** 접속. 끝낼 땐 터미널에서 `Ctrl+C`.

## 설정값

| 변수 | 설명 |
| --- | --- |
| `VITE_YT_API_KEY` | 구글 클라우드 콘솔에서 발급한 YouTube Data API v3 키 |
| `VITE_YT_PLAYLIST` | 재생할 재생목록. URL 전체 또는 `list=` 뒤의 ID. 재생목록은 공개/일부공개 상태여야 함 |

설정값은 `.env.local`(권장)에 두거나, 앱의 **설정** 화면에서 직접 입력할 수 있다.
앱 시작 시 설정값으로 곡을 자동으로 불러온다.

## 주의

- `.env.local` 에는 비밀값(API 키)이 들어가므로 **깃에 커밋하지 않는다** (`.gitignore` 로 제외됨).
- 이 저장소가 공개라면 API 키를 구글 클라우드 콘솔에서 **YouTube Data API v3 전용으로 제한**해 두는 것을 권장한다.
