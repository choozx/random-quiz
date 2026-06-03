// YouTube Data API v3 로 재생목록의 곡들을 불러온다.

// 입력값(URL 또는 ID)에서 재생목록 ID를 뽑아낸다.
export function parsePlaylistId(input) {
  if (!input) return ''
  const trimmed = input.trim()
  // URL이면 list= 파라미터 추출
  const match = trimmed.match(/[?&]list=([^&]+)/)
  if (match) return match[1]
  // 아니면 입력값 자체를 ID로 간주 (PL..., UU..., LL... 등)
  // 끝에 붙은 &si=... 같은 공유 추적 파라미터는 떼어낸다.
  return trimmed.split(/[&?]/)[0]
}

const API = 'https://www.googleapis.com/youtube/v3/playlistItems'
const VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos'

// 재생목록의 모든 곡을 [{ id, title }] 로 반환. 비공개/삭제된 영상은 제외.
export async function fetchPlaylistSongs(apiKey, playlistId) {
  if (!apiKey) throw new Error('API 키가 없습니다.')
  if (!playlistId) throw new Error('재생목록 ID를 찾을 수 없습니다.')

  const songs = []
  let pageToken = ''

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      maxResults: '50',
      playlistId,
      key: apiKey,
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`${API}?${params.toString()}`)
    const data = await res.json()

    if (!res.ok) {
      const reason = data?.error?.message || `HTTP ${res.status}`
      throw new Error(reason)
    }

    for (const item of data.items || []) {
      const title = item?.snippet?.title
      const videoId = item?.snippet?.resourceId?.videoId
      if (!videoId) continue
      if (title === 'Deleted video' || title === 'Private video') continue
      songs.push({ id: videoId, title })
    }

    pageToken = data.nextPageToken || ''
  } while (pageToken)

  return songs
}

// 50개씩 videos.list 로 status.embeddable 확인 → 재생 가능한 곡만 반환.
// onProgress(checked, total) 콜백으로 진행 상황 전달.
export async function filterEmbeddableSongs(apiKey, songs, onProgress) {
  const result = []
  for (let i = 0; i < songs.length; i += 50) {
    const batch = songs.slice(i, i + 50)
    const ids = batch.map((s) => s.id).join(',')
    const params = new URLSearchParams({ part: 'status', id: ids, key: apiKey })
    const res = await fetch(`${VIDEOS_API}?${params}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
    const okIds = new Set(
      (data.items || [])
        .filter((item) => item.status?.embeddable)
        .map((item) => item.id),
    )
    result.push(...batch.filter((s) => okIds.has(s.id)))
    onProgress?.(Math.min(i + 50, songs.length), songs.length)
  }
  return result
}
