// localStorage 래퍼 — 모든 데이터는 맥 브라우저 안에만 저장된다.
import { ENV_API_KEY, ENV_PLAYLIST } from './config'

const PREFIX = 'quiz.'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 저장 실패는 조용히 무시 (용량 초과 등)
  }
}

// --- 유튜브 Data API 키 ---
// 브라우저에 저장된 값이 있으면 우선, 없으면 .env.local 값을 쓴다.
export const getApiKey = () => read('apiKey', '') || ENV_API_KEY
export const setApiKey = (v) => write('apiKey', v)

// --- 재생목록 원본 입력값 (URL 또는 ID) ---
export const getPlaylistInput = () => read('playlistInput', '') || ENV_PLAYLIST
export const setPlaylistInput = (v) => write('playlistInput', v)

// --- 곡 목록: [{ id, title }] ---
export const getSongs = () => read('songs', [])
export const setSongs = (songs) => write('songs', songs)

// 캐시된 곡 목록이 어떤 재생목록 ID에서 만들어졌는지 기록 (자동 갱신 판단용)
export const getSongsSource = () => read('songsSource', '')
export const setSongsSource = (id) => write('songsSource', id)

// --- 노래 게임 누적 기록 ---
// { games, totalCorrect, totalRounds, best } (best = 한 판 최고 정답수)
export const getSongStats = () =>
  read('songStats', { games: 0, totalCorrect: 0, totalRounds: 0, best: 0 })
export const setSongStats = (s) => write('songStats', s)
