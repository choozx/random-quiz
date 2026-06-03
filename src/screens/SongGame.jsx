import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSongs, getSongStats, setSongStats } from '../lib/storage'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'

const DEFAULT_ROUNDS = 10
const START_SECONDS = 30

const DURATIONS = [
  { ms: 1000,    label: '1초' },
  { ms: 5000,    label: '5초' },
  { ms: Infinity, label: '전체' },
]

// YT.PlayerState 숫자 상수
const ENDED = 0
const PLAYING = 1
const PAUSED = 2
const CUED = 5
const CUE_RETRY_MS = 4000 // CUED 이벤트 미수신 시 재시도 간격

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 정답 + 보기 3개(서로 다른 제목)를 섞어서 반환
function buildChoices(target, songs) {
  const others = []
  const seen = new Set([target.title])
  for (const s of shuffle(songs)) {
    if (seen.has(s.title)) continue
    seen.add(s.title)
    others.push(s)
    if (others.length === 3) break
  }
  return shuffle([target, ...others])
}

export default function SongGame({ go, options = {} }) {
  const ROUNDS = options.rounds ?? DEFAULT_ROUNDS
  const songs = useMemo(() => getSongs(), [])
  const order = useRef(shuffle(songs)) // 곡 출제 순서 큐
  const orderIdx = useRef(0)
  const roundRef = useRef(null) // { id, start, timer, retryTimer, no }
  const startRoundRef = useRef(null)

  const [roundNo, setRoundNo] = useState(0)
  const [playDuration, setPlayDuration] = useState(1000)
  const playDurationRef = useRef(1000)
  const [target, setTarget] = useState(null)
  const [choices, setChoices] = useState([])
  const [phase, setPhase] = useState('init') // init|loading|ready|playing|answer|revealed
  const [selected, setSelected] = useState(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const nextSong = useCallback(() => {
    if (orderIdx.current >= order.current.length) {
      order.current = shuffle(songs)
      orderIdx.current = 0
    }
    return order.current[orderIdx.current++]
  }, [songs])

  const onState = useCallback((e) => {
    const r = roundRef.current
    if (!r) return
    const player = e.target

    if (e.data === CUED) {
      clearTimeout(r.retryTimer)
      r.retryTimer = null
      r.cued = true
      setPhase('ready')
    } else if (e.data === PLAYING) {
      if (!r.timer && playDurationRef.current !== Infinity) {
        r.timer = setTimeout(() => {
          try { player.pauseVideo() } catch {}
          r.timer = null
        }, playDurationRef.current)
      }
    } else if (e.data === PAUSED || e.data === ENDED) {
      setPhase((p) => (p === 'revealed' ? p : 'answer'))
    }
  }, [])

  const onError = useCallback(() => {
    // 임베딩 차단(101/150), 영상 없음(100) 등 → 같은 라운드 번호로 다음 곡 시도
    const n = roundRef.current?.no ?? 1
    startRoundRef.current?.(n)
  }, [])

  const { containerRef, playerRef, ready } = useYouTubePlayer({
    onStateChange: onState,
    onError,
  })

  // 한 라운드 준비
  const startRound = useCallback(
    (n) => {
      const t = nextSong()
      const r = roundRef.current
      if (r?.timer) clearTimeout(r.timer)
      if (r?.retryTimer) clearTimeout(r.retryTimer)
      const round = { id: t.id, start: START_SECONDS, timer: null, retryTimer: null, cued: false, no: n }
      roundRef.current = round
      setTarget(t)
      setChoices(buildChoices(t, songs))
      setSelected(null)
      setRoundNo(n)
      setPhase('loading')

      function cueVideo() {
        if (roundRef.current !== round) return
        try {
          // startSeconds 없이 큐 → 빠른 CUED 이벤트, 실제 seek는 listen()에서
          playerRef.current?.cueVideoById(round.id)
        } catch {
          // ignore
        }
        // CUED가 오지 않으면 1회 재시도 (반복 X → 버퍼링 방해 금지)
        round.retryTimer = setTimeout(() => {
          if (roundRef.current === round && !round.cued) {
            try { playerRef.current?.cueVideoById(round.id) } catch {}
          }
        }, CUE_RETRY_MS)
      }
      cueVideo()
    },
    [nextSong, songs, playerRef],
  )

  startRoundRef.current = startRound

  // 플레이어 준비되면 첫 라운드 시작
  useEffect(() => {
    if (ready && phase === 'init') startRound(1)
  }, [ready, phase, startRound])

  function listen(ms) {
    const r = roundRef.current
    if (!r) return
    // 같은 길이 재생 중 → 정지
    if (phase === 'playing' && playDurationRef.current === ms) {
      if (r.timer) { clearTimeout(r.timer); r.timer = null }
      try { playerRef.current.pauseVideo() } catch {}
      return
    }
    // 다른 길이 or 정지 상태 → 처음부터 재생
    if (r.timer) { clearTimeout(r.timer); r.timer = null }
    playDurationRef.current = ms
    setPlayDuration(ms)
    try {
      playerRef.current.seekTo(r.start || 0, true)
      playerRef.current.playVideo()
    } catch {}
    setPhase('playing')
  }

  function choose(title) {
    if (phase === 'revealed' || phase === 'loading') return
    const r = roundRef.current
    if (r?.timer) {
      clearTimeout(r.timer)
      r.timer = null
    }
    try {
      playerRef.current?.pauseVideo()
    } catch {
      // ignore
    }
    setSelected(title)
    setPhase('revealed')
    if (title === target.title) setScore((s) => s + 1)
  }

  function next() {
    if (roundNo >= ROUNDS) {
      // 게임 종료 → 기록 저장
      const stats = getSongStats()
      setSongStats({
        games: stats.games + 1,
        totalCorrect: stats.totalCorrect + score,
        totalRounds: stats.totalRounds + ROUNDS,
        best: Math.max(stats.best, score),
      })
      setDone(true)
    } else {
      startRound(roundNo + 1)
    }
  }

  // --- 렌더 ---
  if (done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <h2 className="text-3xl font-bold">게임 종료!</h2>
        <p className="text-5xl font-bold text-violet-400">
          {score} / {ROUNDS}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              order.current = shuffle(songs)
              orderIdx.current = 0
              setScore(0)
              setDone(false)
              startRound(1)
            }}
            className="py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 font-semibold transition"
          >
            다시 하기
          </button>
          <button
            onClick={() => go('home')}
            className="py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 transition"
          >
            홈으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* 숨겨진 유튜브 플레이어 (화면 밖, 소리만) */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }} aria-hidden>
        <div ref={containerRef} />
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => go('home')}
          className="text-neutral-400 hover:text-neutral-100"
        >
          ← 그만두기
        </button>
        <span className="text-neutral-400">
          {roundNo || 1} / {ROUNDS}
        </span>
        <span className="font-semibold text-violet-400">점수 {score}</span>
      </div>


      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        {!ready || phase === 'loading' ? (
          <p className="text-neutral-400">불러오는 중…</p>
        ) : (
          <>
            <div className="flex gap-3 w-full">
              {DURATIONS.map(({ ms, label }) => {
                const isActive = phase === 'playing' && playDuration === ms
                return (
                  <button
                    key={label}
                    onClick={() => listen(ms)}
                    className={`flex-1 py-4 rounded-2xl text-base font-bold transition ${
                      isActive
                        ? 'bg-violet-500 text-white shadow-lg shadow-violet-900/40'
                        : 'bg-violet-600 hover:bg-violet-500'
                    }`}
                  >
                    {isActive ? '⏹ 정지' : `▶ ${label}`}
                  </button>
                )
              })}
            </div>

            {(phase === 'answer' || phase === 'revealed') && (
              <div className="w-full grid grid-cols-1 gap-3">
                {choices.map((c) => {
                  let cls =
                    'w-full py-4 px-4 rounded-xl text-left font-medium transition border '
                  if (phase === 'revealed') {
                    if (c.title === target.title) {
                      cls += 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                    } else if (c.title === selected) {
                      cls += 'bg-red-600/20 border-red-500 text-red-200'
                    } else {
                      cls += 'bg-neutral-900 border-neutral-800 text-neutral-400'
                    }
                  } else {
                    cls +=
                      'bg-neutral-900 border-neutral-700 hover:border-violet-500'
                  }
                  return (
                    <button
                      key={c.id}
                      onClick={() => choose(c.title)}
                      className={cls}
                    >
                      {c.title}
                    </button>
                  )
                })}
              </div>
            )}

            {phase === 'ready' && (
              <p className="text-neutral-500 text-sm">버튼을 누르면 1초 재생돼요</p>
            )}
          </>
        )}
      </div>

      {phase === 'revealed' && (
        <button
          onClick={next}
          className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 font-semibold text-lg transition"
        >
          {roundNo >= ROUNDS ? '결과 보기' : '다음 곡 →'}
        </button>
      )}
    </div>
  )
}

