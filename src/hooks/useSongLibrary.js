import { useCallback, useEffect, useState } from 'react'
import {
  getApiKey,
  getPlaylistInput,
  getSongs,
  setSongs,
  getSongsSource,
  setSongsSource,
} from '../lib/storage'
import { parsePlaylistId, fetchPlaylistSongs } from '../lib/youtube'

// 곡 목록을 관리한다.
// 시작할 때 설정값(.env.local 또는 브라우저 저장값)으로 자동 로드하고,
// 이미 같은 재생목록으로 캐시돼 있으면 다시 부르지 않는다.
export function useSongLibrary() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0) // 곡 목록이 바뀌면 증가 → 화면 갱신

  const refresh = useCallback(async (force = false) => {
    const key = getApiKey()
    const input = getPlaylistInput()
    if (!key || !input) return { ok: false, reason: 'no-config' }

    const id = parsePlaylistId(input)
    // 이미 같은 재생목록으로 불러와 있으면 건너뜀
    if (!force && getSongs().length > 0 && getSongsSource() === id) {
      return { ok: true, count: getSongs().length, cached: true }
    }

    setLoading(true)
    setError(null)
    try {
      const songs = await fetchPlaylistSongs(key, id)
      setSongs(songs)
      setSongsSource(id)
      setVersion((v) => v + 1)
      return { ok: true, count: songs.length }
    } catch (e) {
      setError(e.message)
      return { ok: false, reason: e.message }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh(false)
  }, [refresh])

  return { loading, error, version, refresh }
}
