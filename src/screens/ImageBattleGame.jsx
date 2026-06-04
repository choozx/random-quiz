import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getImagesByCategory } from '../lib/images'

const DEFAULT_ROUNDS = 10

const BLUR_LEVELS = [
  { px: 20, label: '많이 흐리게' },
  { px: 7, label: '조금 흐리게' },
  { px: 0, label: '원본' },
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// phase: 'play' | 'done'
export default function ImageBattleGame({ go, options = {} }) {
  const ROUNDS = options.rounds ?? DEFAULT_ROUNDS
  const revealMode = options.reveal ?? 'blur'
  const images = useMemo(() => getImagesByCategory(options.category), [options.category])
  const order = useRef(shuffle(images))
  const orderIdx = useRef(0)
  const started = useRef(false)

  const [roundNo, setRoundNo] = useState(0)
  const [target, setTarget] = useState(null)
  const [phase, setPhase] = useState('play')
  const [scores, setScores] = useState({ p1: 0, p2: 0 })
  const [blurPx, setBlurPx] = useState(null) // null = 아직 공개 안 함
  const [showAnswer, setShowAnswer] = useState(false)

  const hasRevealed = blurPx !== null

  const nextImage = useCallback(() => {
    if (orderIdx.current >= order.current.length) {
      order.current = shuffle(images)
      orderIdx.current = 0
    }
    return order.current[orderIdx.current++]
  }, [images])

  const startRound = useCallback((n) => {
    setTarget(nextImage())
    setRoundNo(n)
    setBlurPx(null)
    setShowAnswer(false)
  }, [nextImage])

  useEffect(() => {
    if (started.current) return
    started.current = true
    startRound(1)
  }, [startRound])

  // 다음 이미지 미리 불러오기 (공개 시 로딩 지연 방지)
  useEffect(() => {
    const peek = order.current[orderIdx.current]
    if (peek) {
      const img = new Image()
      img.src = peek.url
    }
  }, [target])

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

  // --- 게임 종료 ---
  if (phase === 'done') {
    const draw = scores.p1 === scores.p2
    const winner = scores.p1 > scores.p2 ? 1 : 2
    return (
      <div className="flex-1 flex flex-col gap-6">
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
              onClick={() => { order.current = shuffle(images); orderIdx.current = 0; setScores({ p1: 0, p2: 0 }); setPhase('play'); startRound(1) }}
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

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={() => go('home')} className="text-neutral-400 hover:text-neutral-100 text-sm">
          ← 그만두기
        </button>
        <span className="text-neutral-500 text-xs">{options.category ?? '전체'} · 목표 {ROUNDS}점</span>
        <div className="flex gap-3 text-sm font-semibold">
          <span className="text-violet-400">P1 {scores.p1}</span>
          <span className="text-neutral-600">·</span>
          <span className="text-rose-400">P2 {scores.p2}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3">

        {/* 이미지 영역 */}
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

        {/* 공개 버튼 */}
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

        {/* 채점 버튼 — 항상 표시, 공개 전엔 비활성 */}
        <div className="flex flex-col gap-3 mt-2">
          <p className="text-center text-neutral-500 text-sm">
            {hasRevealed ? '누가 맞혔나요?' : '이미지 공개 후 선택하세요'}
          </p>
          <button
            onClick={() => award(1)}
            disabled={!hasRevealed}
            className="w-full py-5 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-lg font-bold transition"
          >
            Player 1 정답 🎉
          </button>
          <button
            onClick={() => award(2)}
            disabled={!hasRevealed}
            className="w-full py-5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-lg font-bold transition"
          >
            Player 2 정답 🎉
          </button>
          <button
            onClick={() => award(0)}
            disabled={!hasRevealed}
            className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 disabled:text-neutral-700 text-neutral-400 transition"
          >
            아무도 못 맞힘
          </button>
        </div>

        {/* 정답 — 화면을 다 같이 보므로 누르기 전엔 가려둔다 */}
        <div className="mt-auto pt-4 border-t border-neutral-800 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">정답</p>
          {showAnswer ? (
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
