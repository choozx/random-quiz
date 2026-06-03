// .env.local 에 적어둔 설정값을 읽어온다.
// (Vite는 VITE_ 로 시작하는 환경변수만 앱에 노출한다.)
export const ENV_API_KEY = (import.meta.env.VITE_YT_API_KEY || '').trim()
export const ENV_PLAYLIST = (import.meta.env.VITE_YT_PLAYLIST || '').trim()

// 설정 파일에 두 값이 모두 채워져 있으면 true
export const hasEnvConfig = Boolean(ENV_API_KEY && ENV_PLAYLIST)
