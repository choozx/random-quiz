import { useEffect, useRef, useState } from 'react'

// IFrame Player API 스크립트를 한 번만 로드한다.
let apiPromise = null
function loadIframeApi() {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT)
      return
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

// 숨겨진 유튜브 플레이어를 생성한다.
// onStateChange / onError 콜백은 ref로 보관해 최신 함수를 항상 사용한다.
export function useYouTubePlayer({ onStateChange, onError }) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const stateCb = useRef(onStateChange)
  const errorCb = useRef(onError)
  const [ready, setReady] = useState(false)
  useEffect(() => { stateCb.current = onStateChange }, [onStateChange])
  useEffect(() => { errorCb.current = onError }, [onError])

  useEffect(() => {
    let cancelled = false

    loadIframeApi().then((YT) => {
      if (cancelled || !containerRef.current) return
      playerRef.current = new YT.Player(containerRef.current, {
        width: '320',
        height: '180',
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true)
          },
          onStateChange: (e) => {
            if (stateCb.current) stateCb.current(e)
          },
          onError: (e) => {
            if (errorCb.current) errorCb.current(e)
          },
        },
      })
    })

    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy?.()
      } catch {
        // ignore
      }
      playerRef.current = null
    }
  }, [])

  return { containerRef, playerRef, ready }
}
