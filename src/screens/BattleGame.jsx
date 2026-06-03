import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSongs } from '../lib/storage'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'

const DEFAULT_ROUNDS = 10
const START_SECONDS = 30
const CUE_RETRY_MS = 4000

const DURATIONS = [
  { ms: 1000,    label: '1초' },
  { ms: 5000,    label: '5초' },
  { ms: Infinity, label: '전체' },
]

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

// phase: 'init' | 'loading' | 'ready' | 'playing' | 'done'
export default function BattleGame({ go, options = {} }) {
  const ROUNDS = options.rounds ?? DEFAULT_ROUNDS
  const songs = useMemo(() => getSongs(), [])
  const order = useRef(shuffle(songs))
  const orderIdx = useRef(0)
  const roundRef = useRef(null)
  const startRoundRef = useRef(null)

  const [roundNo, setRoundNo] = useState(0)
  const [target, setTarget] = useState(null)
  const [phase, setPhase] = useState('init')
  const [scores, setScores] = useState({ p1: 0, p2: 0 })
  const [hasPlayed, setHasPlayed] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playDuration, setPlayDuration] = useState(1000)
  const playDurationRef = useRef(1000)

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
      setPhase((p) => (p === 'loading' ? 'ready' : p))
    } else if (e.data === PLAYING) {
      setIsPlaying(true)
      setHasPlayed(true)
      if (!r.timer && playDurationRef.current !== Infinity) {
        r.timer = setTimeout(() => {
          try { player.pauseVideo() } catch {}
          r.timer = null
        }, playDurationRef.current)
      }
    } else if (e.data === PAUSED || e.data === ENDED) {
      setIsPlaying(false)
      setPhase((p) => (p === 'playing' ? 'ready' : p))
    }
  }, [])

  const onError = useCallback(() => {
    const n = roundRef.current?.no ?? 1
    startRoundRef.current?.(n)
  }, [])

  const { containerRef, playerRef, ready } = useYouTubePlayer({ onStateChange: onState, onError })

  const startRound = useCallback((n) => {
    const t = nextSong()
    const r = roundRef.current
    if (r?.timer) clearTimeout(r.timer)
    if (r?.retryTimer) clearTimeout(r.retryTimer)
    const round = { id: t.id, start: START_SECONDS, timer: null, retryTimer: null, cued: false, no: n }
    roundRef.current = round
    setTarget(t)
    setRoundNo(n)
    setHasPlayed(false)
    setIsPlaying(false)
    setPhase('loading')

    function cueVideo() {
      if (roundRef.current !== round) return
      try { playerRef.current?.cueVideoById(round.id) } catch {}
      round.retryTimer = setTimeout(() => {
        if (roundRef.current === round && !round.cued) {
          try { playerRef.current?.cueVideoById(round.id) } catch {}
        }
      }, CUE_RETRY_MS)
    }
    cueVideo()
  }, [nextSong, songs, playerRef])

  startRoundRef.current = startRound

  useEffect(() => {
    if (ready && phase === 'init') startRound(1)
  }, [ready, phase, startRound])

  function play(ms) {
    const r = roundRef.current
    if (!r) return
    // 같은 길이 재생 중 → 정지
    if (isPlaying && playDurationRef.current === ms) {
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

  function award(winner) {
    const next = {
      p1: scores.p1 + (winner === 1 ? 1 : 0),
      p2: scores.p2 + (winner === 2 ? 1 : 0),
    }
    setScores(next)
    if (next.p1 >= ROUNDS || next.p2 >= ROUNDS) {
      setPhase('done')
    } else {
      startRound(roundNo + 1)
    }
  }

  // YouTube 플레이어는 항상 DOM에 유지
  const playerContainer = (
    <div style={{ position: 'fixed', left: '-9999px', top: 0 }} aria-hidden>
      <div ref={containerRef} />
    </div>
  )

  // --- 게임 종료 ---
  if (phase === 'done') {
    const draw = scores.p1 === scores.p2
    const winner = scores.p1 > scores.p2 ? 1 : 2
    return (
      <div className="flex-1 flex flex-col gap-6">
        {playerContainer}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
          <h2 className="text-3xl font-bold">게임 종료!</h2>
          <div className="flex gap-8">
            <div className={`flex flex-col items-center gap-1 px-8 py-4 rounded-2xl border-2 ${!draw && winner === 1 ? 'border-violet-500 bg-neutral-900' : 'border-neutral-800'}`}>
              <span className="text-sm text-violet-400">Player 1</span>
              <span className="text-4xl font-bold text-violet-400">{scores.p1}</span>
            </div>
            <div className={`flex flex-col items-center gap-1 px-8 py-4 rounded-2xl border-2 ${!draw && winner === 2 ? 'border-rose-500 bg-neutral-900' : 'border-neutral-800'}`}>
              <span className="text-sm text-rose-400">Player 2</span>
              <span className="text-4xl font-bold text-rose-400">{scores.p2}</span>
            </div>
          </div>
          <p className={`text-2xl font-bold ${draw ? 'text-neutral-300' : winner === 1 ? 'text-violet-400' : 'text-rose-400'}`}>
            {draw ? '무승부!' : `Player ${winner} 승리!`}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => { order.current = shuffle(songs); orderIdx.current = 0; setScores({ p1: 0, p2: 0 }); startRound(1) }}
              className="py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 font-semibold transition"
            >
              다시 하기
            </button>
            <button onClick={() => go('home')} className="py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 transition">
              홈으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- 메인 화면 ---
  return (
    <div className="flex-1 flex flex-col gap-4">
      {playerContainer}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={() => go('home')} className="text-neutral-400 hover:text-neutral-100 text-sm">
          ← 그만두기
        </button>
        <span className="text-neutral-500 text-xs">목표 {ROUNDS}점</span>
        <div className="flex gap-3 text-sm font-semibold">
          <span className="text-violet-400">P1 {scores.p1}</span>
          <span className="text-neutral-600">·</span>
          <span className="text-rose-400">P2 {scores.p2}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3">

        {/* 재생 버튼 */}
        {phase === 'loading' ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-neutral-400">불러오는 중…</p>
          </div>
        ) : (
          <div className="flex gap-3">
            {DURATIONS.map(({ ms, label }) => {
              const isActive = isPlaying && playDuration === ms
              return (
                <button
                  key={label}
                  onClick={() => play(ms)}
                  className={`flex-1 py-4 rounded-2xl text-base font-bold transition ${
                    isActive
                      ? 'bg-violet-500 text-white shadow-lg shadow-violet-900/30'
                      : 'bg-violet-600 hover:bg-violet-500'
                  }`}
                >
                  {isActive ? '⏹ 정지' : `▶ ${label}`}
                </button>
              )
            })}
          </div>
        )}

        {/* 채점 버튼 — 항상 표시, 첫 재생 전엔 비활성 */}
        <div className="flex flex-col gap-3 mt-2">
          <p className="text-center text-neutral-500 text-sm">
            {hasPlayed ? '누가 맞혔나요?' : '재생 후 선택하세요'}
          </p>
          <button
            onClick={() => award(1)}
            disabled={!hasPlayed || isPlaying}
            className="w-full py-5 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-lg font-bold transition"
          >
            Player 1 정답 🎉
          </button>
          <button
            onClick={() => award(2)}
            disabled={!hasPlayed || isPlaying}
            className="w-full py-5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-lg font-bold transition"
          >
            Player 2 정답 🎉
          </button>
          <button
            onClick={() => award(0)}
            disabled={!hasPlayed || isPlaying}
            className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 disabled:text-neutral-700 text-neutral-400 transition"
          >
            아무도 못 맞힘
          </button>
        </div>

        {/* 정답 — 맨 아래 고정 */}
        <div className="mt-auto pt-4 border-t border-neutral-800 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">정답</p>
          <p className="text-lg font-bold text-emerald-400">{target?.title ?? '—'}</p>
        </div>

      </div>
    </div>
  )
}

