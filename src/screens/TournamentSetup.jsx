import { useState } from 'react'
import { getSongs } from '../lib/storage'
import { IMAGES, getCategories } from '../lib/images'
import { teamColor } from '../lib/teams'

const COUNT_OPTIONS = [3, 5, 7, 10, 15, 20]
const MAX_STAGES = 6

export default function TournamentSetup({ go, options = {} }) {
  const songs = getSongs()
  const categories = getCategories()

  const typeOptions = [
    { key: 'song', label: '🎵 음악', ok: songs.length >= 4 },
    { key: 'image:전체', label: '🖼 이미지 전체', ok: IMAGES.length >= 4 },
    ...categories.map((c) => ({ key: `image:${c.name}`, label: `🖼 ${c.name}`, ok: c.count >= 4 })),
  ]
  const firstOk = typeOptions.find((t) => t.ok)?.key

  const [stages, setStages] = useState(() => {
    const init = []
    if (songs.length >= 4) init.push({ type: 'song', count: 5 })
    if (IMAGES.length >= 4) init.push({ type: 'image:전체', count: 5 })
    if (!init.length && firstOk) init.push({ type: firstOk, count: 5 })
    return init
  })
  const [reveal, setReveal] = useState('blur')

  const hasImageStage = stages.some((s) => s.type.startsWith('image'))

  function setStage(i, patch) {
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  function addStage() {
    setStages((prev) => [...prev, { type: prev[prev.length - 1]?.type ?? firstOk, count: 5 }])
  }

  function removeStage(i) {
    setStages((prev) => prev.filter((_, idx) => idx !== i))
  }

  function start() {
    const parsed = stages.map(({ type, count }) =>
      type === 'song'
        ? { kind: 'song', count }
        : { kind: 'image', category: type.slice('image:'.length), count }
    )
    go('tournament', { stages: parsed, reveal })
  }

  if (!firstOk) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
        <h2 className="text-2xl font-bold">🏆 라운드전</h2>
        <p className="text-amber-400 text-sm">
          노래(4곡 이상)나 이미지(카테고리당 4장 이상)가 준비돼야 시작할 수 있어요.
        </p>
        <button onClick={() => go('home')} className="text-neutral-500 hover:text-neutral-300 text-sm transition">
          ← 홈으로
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-6 py-4">
      <h2 className="text-2xl font-bold text-center">🏆 라운드전 구성</h2>

      {options.teams?.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {options.teams.map((t, i) => (
            <span
              key={i}
              className={`px-3 py-1 rounded-xl bg-neutral-900 border border-neutral-700 ${teamColor(t.colorIdx).text}`}
              title={t.members.join(', ')}
            >
              {t.name} ({t.members.length}명)
            </span>
          ))}
          <button
            onClick={() => go('teamsetup')}
            className="text-neutral-500 hover:text-neutral-300 text-xs underline underline-offset-2 transition"
          >
            팀 다시 구성
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {stages.map((s, i) => {
          const isLast = i === stages.length - 1
          return (
            <div key={i} className="p-4 rounded-2xl bg-neutral-900 border border-neutral-700 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">
                  라운드 {i + 1}
                  {isLast && <span className="ml-2 text-amber-400">⚡ 문제당 2점</span>}
                </span>
                {stages.length > 1 && (
                  <button
                    onClick={() => removeStage(i)}
                    className="text-neutral-500 hover:text-rose-400 text-sm transition"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setStage(i, { type: t.key })}
                    disabled={!t.ok}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                      s.type === t.key
                        ? 'bg-violet-600 text-white'
                        : t.ok
                          ? 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:border-neutral-500'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-600'
                    }`}
                  >
                    {t.label}
                    {!t.ok && ' (부족)'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">문제 수</span>
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setStage(i, { count: n })}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${
                      s.count === n
                        ? 'bg-violet-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        {stages.length < MAX_STAGES && (
          <button
            onClick={addStage}
            className="py-3 rounded-2xl border border-dashed border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 text-sm font-medium transition"
          >
            + 라운드 추가
          </button>
        )}
      </div>

      {hasImageStage && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900 border border-neutral-700">
          <span className="text-sm font-medium text-neutral-300">이미지 공개 방식</span>
          <div className="flex gap-2">
            {[
              { key: 'blur', label: '🌫 블러' },
              { key: 'direct', label: '👁 바로 공개' },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setReveal(m.key)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                  reveal === m.key
                    ? 'bg-violet-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-auto">
        <p className="text-center text-xs text-neutral-500">
          문제당 1점 합산 · 마지막 라운드는 문제당 2점 ⚡
        </p>
        <button
          onClick={start}
          disabled={!stages.length}
          className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-bold text-lg transition"
        >
          라운드전 시작
        </button>
        <button onClick={() => go('home')} className="text-neutral-500 hover:text-neutral-300 text-sm transition">
          ← 홈으로
        </button>
      </div>
    </div>
  )
}
