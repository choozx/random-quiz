import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSongs, getSongStats, setSongStats } from '../lib/storage'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'

const TOTAL_ROUNDS = 10
const LISTEN_MS = 1000 // 정확히 1초

// YT.PlayerState 숫자 상수
const ENDED = 0
const PLAYING = 1
const PAUSED = 2
const CUED = 5

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

export default function SongGame({ go }) {
  const songs = useMemo(() => getSongs(), [])
  const order = useRef(shuffle(songs)) // 곡 출제 순서 큐
  const orderIdx = useRef(0)
  const roundRef = useRef(null) // { id, start, midSet, timer }

  const [roundNo, setRoundNo] = useState(0) // 1..TOTAL_ROUNDS
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
      if (!r.midSet) {
        const dur = player.getDuration?.() || 0
        const start = dur > 6 ? Math.min(dur * 0.3, dur - 3) : 0
        r.midSet = true
        r.start = start
        if (start > 0) {
          // 가운데 지점으로 다시 cue → 그 지점을 미리 버퍼링
          player.cueVideoById({ videoId: r.id, startSeconds: start })
          return
        }
      }
      setPhase('ready')
    } else if (e.data === PLAYING) {
      if (!r.timer) {
        r.timer = setTimeout(() => {
          try {
            player.pauseVideo()
          } catch {
            // ignore
          }
          r.timer = null
        }, LISTEN_MS)
      }
    } else if (e.data === PAUSED || e.data === ENDED) {
      setPhase((p) => (p === 'revealed' ? p : 'answer'))
    }
  }, [])

  const { containerRef, playerRef, ready } = useYouTubePlayer({
    onStateChange: onState,
  })

  // 한 라운드 준비
  const startRound = useCallback(
    (n) => {
      const t = nextSong()
      const r = roundRef.current
      if (r?.timer) clearTimeout(r.timer)
      roundRef.current = { id: t.id, start: 0, midSet: false, timer: null }
      setTarget(t)
      setChoices(buildChoices(t, songs))
      setSelected(null)
      setRoundNo(n)
      setPhase('loading')
      try {
        playerRef.current?.cueVideoById(t.id)
      } catch {
        // ignore
      }
    },
    [nextSong, songs, playerRef],
  )

  // 플레이어 준비되면 첫 라운드 시작
  useEffect(() => {
    if (ready && phase === 'init') startRound(1)
  }, [ready, phase, startRound])

  // 1초 듣기 (첫 재생 + 다시 듣기 공용)
  function listen() {
    const r = roundRef.current
    if (!r) return
    try {
      playerRef.current.seekTo(r.start || 0, true)
      playerRef.current.playVideo()
    } catch {
      // ignore
    }
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
    if (roundNo >= TOTAL_ROUNDS) {
      // 게임 종료 → 기록 저장
      const stats = getSongStats()
      setSongStats({
        games: stats.games + 1,
        totalCorrect: stats.totalCorrect + score,
        totalRounds: stats.totalRounds + TOTAL_ROUNDS,
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
          {score} / {TOTAL_ROUNDS}
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
          {roundNo || 1} / {TOTAL_ROUNDS}
        </span>
        <span className="font-semibold text-violet-400">점수 {score}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        {!ready || phase === 'loading' ? (
          <p className="text-neutral-400">불러오는 중…</p>
        ) : (
          <>
            <button
              onClick={listen}
              disabled={phase === 'playing'}
              className="w-40 h-40 rounded-full bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-700 text-2xl font-bold flex items-center justify-center transition shadow-lg shadow-violet-900/40"
            >
              {phase === 'playing'
                ? '🔊'
                : phase === 'ready'
                  ? '▶ 1초'
                  : '↻ 다시'}
            </button>

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
          {roundNo >= TOTAL_ROUNDS ? '결과 보기' : '다음 곡 →'}
        </button>
      )}
    </div>
  )
}
