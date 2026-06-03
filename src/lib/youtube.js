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
