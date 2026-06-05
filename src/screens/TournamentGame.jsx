import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSongs } from '../lib/storage'
import { getImagesByCategory } from '../lib/images'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'
import { teamColor } from '../lib/teams'

const DEFAULT_TEAMS = [
  { name: 'Player 1', colorIdx: 0, members: [] },
  { name: 'Player 2', colorIdx: 1, members: [] },
]

const START_SECONDS = 30
const CUE_RETRY_MS = 4000

const DURATIONS = [
  { ms: 1000,    label: '1초' },
  { ms: 5000,    label: '5초' },
  { ms: Infinity, label: '전체' },
]

const BLUR_LEVELS = [
  { px: 20, label: '많이 흐리게' },
  { px: 7, label: '조금 흐리게' },
  { px: 0, label: '원본' },
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

function stageLabel(stage) {
  if (stage.kind === 'song') return '🎵 음악 맞추기'
  return stage.category === '전체' ? '🖼 이미지 전체 섞기' : `🖼 ${stage.category} 맞추기`
}

// phase: 'intro' | 'play' | 'done'
export default function TournamentGame({ go, options = {} }) {
  const stages = useMemo(() => options.stages ?? [], [options.stages])
  const teams = useMemo(
    () => (options.teams?.length ? options.teams : DEFAULT_TEAMS),
    [options.teams]
  )
  const songs = useMemo(() => getSongs(), [])

  // 곡은 전체 라운드에서 이어서 소진, 이미지는 카테고리별 풀 유지
  const songOrder = useRef(shuffle(songs))
  const songIdx = useRef(0)
  const imagePools = useRef({})

  const [stageIdx, setStageIdx] = useState(0)
  const [qNo, setQNo] = useState(1)
  const [scores, setScores] = useState(() => teams.map(() => 0))
  const [phase, setPhase] = useState('intro')
  const [target, setTarget] = useState(null)

  // 음악 문제 상태
  const [songPhase, setSongPhase] = useState('loading') // 'loading' | 'ready'
  const [hasPlayed, setHasPlayed] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playDuration, setPlayDuration] = useState(1000)
  const playDurationRef = useRef(1000)
  const qRef = useRef(null)
  const startQuestionRef = useRef(null)

  // 이미지 문제 상태
  const [blurPx, setBlurPx] = useState(null) // null = 아직 공개 안 함
  const [showAnswer, setShowAnswer] = useState(false)

  const stage = stages[stageIdx]
  const isLast = stageIdx === stages.length - 1
  const pts = isLast ? 2 : 1
  const isSong = stage?.kind === 'song'
  const revealMode = stage?.reveal ?? 'blur' // 이미지 공개 방식 — 라운드마다 설정

  const nextSong = useCallback(() => {
    if (songIdx.current >= songOrder.current.length) {
      songOrder.current = shuffle(songs)
      songIdx.current = 0
    }
    return songOrder.current[songIdx.current++]
  }, [songs])

  const nextImage = useCallback((category) => {
    let pool = imagePools.current[category]
    if (!pool) {
      pool = imagePools.current[category] = { order: shuffle(getImagesByCategory(category)), idx: 0 }
    }
    if (pool.idx >= pool.order.length) {
      pool.order = shuffle(getImagesByCategory(category))
      pool.idx = 0
    }
    return pool.order[pool.idx++]
  }, [])

  const onState = useCallback((e) => {
    const q = qRef.current
    if (!q) return
    const player = e.target

    if (e.data === CUED) {
      clearTimeout(q.retryTimer)
      q.retryTimer = null
      q.cued = true
      setSongPhase('ready')
    } else if (e.data === PLAYING) {
      setIsPlaying(true)
      setHasPlayed(true)
      if (!q.timer && playDurationRef.current !== Infinity) {
        q.timer = setTimeout(() => {
          try { player.pauseVideo() } catch { /* 무시 */ }
          q.timer = null
        }, playDurationRef.current)
      }
    } else if (e.data === PAUSED || e.data === ENDED) {
      setIsPlaying(false)
    }
  }, [])

  const onError = useCallback(() => {
    const q = qRef.current
    if (q) startQuestionRef.current?.(q.stageIdx, q.qNo)
  }, [])

  const { containerRef, playerRef, ready } = useYouTubePlayer({ onStateChange: onState, onError })

  const clearQuestion = useCallback(() => {
    const q = qRef.current
    if (q?.timer) clearTimeout(q.timer)
    if (q?.retryTimer) clearTimeout(q.retryTimer)
    qRef.current = null
    try { playerRef.current?.pauseVideo() } catch { /* 무시 */ }
  }, [playerRef])

  const startQuestion = useCallback((si, n) => {
    const st = stages[si]
    clearQuestion()
    setStageIdx(si)
    setQNo(n)
    setHasPlayed(false)
    setIsPlaying(false)
    setBlurPx(null)
    setShowAnswer(false)

    if (st.kind === 'song') {
      const t = nextSong()
      const q = { id: t.id, start: START_SECONDS, timer: null, retryTimer: null, cued: false, stageIdx: si, qNo: n }
      qRef.current = q
      setTarget(t)
      setSongPhase('loading')

      function cueVideo() {
        if (qRef.current !== q) return
        try { playerRef.current?.cueVideoById(q.id) } catch { /* 무시 */ }
        q.retryTimer = setTimeout(() => {
          if (qRef.current === q && !q.cued) {
            try { playerRef.current?.cueVideoById(q.id) } catch { /* 무시 */ }
          }
        }, CUE_RETRY_MS)
      }
      cueVideo()
    } else {
      const t = nextImage(st.category)
      setTarget(t)
      // 다음 이미지 미리 불러오기
      const pool = imagePools.current[st.category]
      const peek = pool?.order[pool.idx]
      if (peek) {
        const img = new Image()
        img.src = peek.url
      }
    }
  }, [stages, clearQuestion, nextSong, nextImage, playerRef])

  useEffect(() => {
    startQuestionRef.current = startQuestion
  }, [startQuestion])

  function play(ms) {
    const q = qRef.current
    if (!q) return
    if (isPlaying && playDurationRef.current === ms) {
      if (q.timer) { clearTimeout(q.timer); q.timer = null }
      try { playerRef.current.pauseVideo() } catch { /* 무시 */ }
      return
    }
    if (q.timer) { clearTimeout(q.timer); q.timer = null }
    playDurationRef.current = ms
    setPlayDuration(ms)
    try {
      playerRef.current.seekTo(q.start || 0, true)
      playerRef.current.playVideo()
    } catch { /* 무시 */ }
  }

  // teamIdx === -1 이면 아무도 못 맞힘
  function award(teamIdx) {
    setScores((prev) => prev.map((s, i) => (i === teamIdx ? s + pts : s)))
    if (qNo < stage.count) {
      startQuestion(stageIdx, qNo + 1)
    } else if (stageIdx + 1 < stages.length) {
      clearQuestion()
      setStageIdx(stageIdx + 1)
      setPhase('intro')
    } else {
      clearQuestion()
      setPhase('done')
    }
  }

  function restart() {
    clearQuestion()
    songOrder.current = shuffle(songs)
    songIdx.current = 0
    imagePools.current = {}
    setScores(teams.map(() => 0))
    setStageIdx(0)
    setPhase('intro')
  }

  // YouTube 플레이어는 항상 DOM에 유지
  const playerContainer = (
    <div style={{ position: 'fixed', left: '-9999px', top: 0 }} aria-hidden>
      <div ref={containerRef} />
    </div>
  )

  const scoreboard = (
    <div className="flex flex-wrap justify-center gap-4">
      {teams.map((t, i) => {
        const c = teamColor(t.colorIdx)
        return (
          <div key={i} className="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl border-2 border-neutral-800">
            <span className={`text-sm ${c.text}`}>{t.name}</span>
            <span className={`text-3xl font-bold ${c.text}`}>{scores[i]}</span>
            {t.members.length > 0 && (
              <span className="text-[10px] text-neutral-500">{t.members.join(' · ')}</span>
            )}
          </div>
        )
      })}
    </div>
  )

  // --- 라운드 인트로 ---
  if (phase === 'intro') {
    const needsPlayer = stage?.kind === 'song' && !ready
    return (
      <div className="flex-1 flex flex-col gap-6">
        {playerContainer}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
          <p className="text-neutral-500 text-sm">라운드 {stageIdx + 1} / {stages.length}</p>
          <h2 className="text-3xl font-bold">{stageLabel(stage)}</h2>
          <p className="text-neutral-400">
            {stage.count}문제 · 문제당 <span className={isLast ? 'text-amber-400 font-bold' : ''}>{pts}점{isLast && ' ⚡'}</span>
          </p>
          {stageIdx > 0 && scoreboard}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => { setPhase('play'); startQuestion(stageIdx, 1) }}
              disabled={needsPlayer}
              className="py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-bold text-lg transition"
            >
              {needsPlayer ? '플레이어 준비 중…' : '라운드 시작'}
            </button>
            <button onClick={() => go('home')} className="py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 transition">
              그만두기
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- 최종 결과 ---
  if (phase === 'done') {
    const top = Math.max(...scores)
    const winners = teams.filter((_, i) => scores[i] === top)
    const draw = winners.length > 1
    return (
      <div className="flex-1 flex flex-col gap-6">
        {playerContainer}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
          <h2 className="text-3xl font-bold">🏆 라운드전 종료!</h2>
          {scoreboard}
          <p className={`text-2xl font-bold ${draw ? 'text-neutral-300' : teamColor(winners[0].colorIdx).text}`}>
            {draw ? `무승부! (${winners.map((t) => t.name).join(' · ')})` : `${winners[0].name} 승리!`}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={restart} className="py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 font-semibold transition">
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

  // --- 문제 진행 ---
  const hasRevealed = blurPx !== null
  const canAward = isSong ? hasPlayed && !isPlaying : hasRevealed

  return (
    <div className="flex-1 flex flex-col gap-4">
      {playerContainer}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={() => go('home')} className="text-neutral-400 hover:text-neutral-100 text-sm">
          ← 그만두기
        </button>
        <span className="text-neutral-500 text-xs">
          R{stageIdx + 1}/{stages.length} · 문제 {qNo}/{stage.count}
          {isLast && <span className="text-amber-400"> · ⚡2점</span>}
        </span>
        <div className="flex flex-wrap justify-end gap-2 text-xs font-semibold max-w-[45%]">
          {teams.map((t, i) => (
            <span key={i} className={teamColor(t.colorIdx).text}>
              {t.name} {scores[i]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3">

        {isSong ? (
          /* 음악: 재생 버튼 */
          songPhase === 'loading' ? (
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
          )
        ) : (
          /* 이미지: 이미지 영역 + 공개 버튼 */
          <>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              {target && hasRevealed ? (
                <img
                  src={target.url}
                  alt=""
                  className="w-full h-full object-contain transition-[filter,transform] duration-300"
                  style={{
                    filter: blurPx ? `blur(${blurPx}px)` : 'none',
                    transform: blurPx ? 'scale(1.08)' : 'none',
                  }}
                />
              ) : (
                <span className="text-6xl text-neutral-700 font-bold">?</span>
              )}
            </div>
            {revealMode === 'blur' ? (
              <div className="flex gap-3">
                {BLUR_LEVELS.map(({ px, label }) => {
                  const isActive = hasRevealed && blurPx === px
                  return (
                    <button
                      key={label}
                      onClick={() => setBlurPx(px)}
                      disabled={isActive}
                      className={`flex-1 py-4 rounded-2xl text-base font-bold transition ${
                        isActive
                          ? 'bg-violet-500 text-white shadow-lg shadow-violet-900/30'
                          : 'bg-violet-600 hover:bg-violet-500'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <button
                onClick={() => setBlurPx(0)}
                disabled={hasRevealed}
                className={`w-full py-4 rounded-2xl text-base font-bold transition ${
                  hasRevealed
                    ? 'bg-neutral-800 text-neutral-500'
                    : 'bg-violet-600 hover:bg-violet-500'
                }`}
              >
                {hasRevealed ? '공개됨' : '👁 이미지 공개'}
              </button>
            )}
          </>
        )}

        {/* 채점 버튼 */}
        <div className="flex flex-col gap-3 mt-2">
          <p className="text-center text-neutral-500 text-sm">
            {canAward
              ? `누가 맞혔나요? (+${pts}점)`
              : isSong ? '재생 후 선택하세요' : '이미지 공개 후 선택하세요'}
          </p>
          <div className={`grid gap-3 ${teams.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {teams.map((t, i) => {
              const c = teamColor(t.colorIdx)
              return (
                <button
                  key={i}
                  onClick={() => award(i)}
                  disabled={!canAward}
                  className={`w-full ${teams.length > 2 ? 'py-4 text-base' : 'py-5 text-lg'} rounded-2xl ${c.bg} ${c.bgHover} disabled:bg-neutral-800 disabled:text-neutral-600 font-bold transition`}
                >
                  {t.name} 정답 🎉
                </button>
              )
            })}
          </div>
          <button
            onClick={() => award(-1)}
            disabled={!canAward}
            className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 disabled:text-neutral-700 text-neutral-400 transition"
          >
            아무도 못 맞힘
          </button>
        </div>

        {/* 정답 — 음악은 항상 표시, 이미지는 클릭 전까지 가림 */}
        <div className="mt-auto pt-4 border-t border-neutral-800 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">정답</p>
          {isSong ? (
            <p className="text-lg font-bold text-emerald-400">{target?.title ?? '—'}</p>
          ) : showAnswer ? (
            <p className="text-lg font-bold text-emerald-400">{target?.answer ?? '—'}</p>
          ) : (
            <button
              onClick={() => setShowAnswer(true)}
              className="text-sm text-neutral-400 hover:text-neutral-200 underline underline-offset-4"
            >
              정답 보기
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
