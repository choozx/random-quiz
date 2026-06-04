import { useState } from 'react'
import { IMAGES, getCategories } from '../lib/images'

const ROUND_OPTIONS = [5, 10, 15, 20]

const REVEAL_MODES = [
  { key: 'blur', label: '🌫 블러 공개', desc: '흐린 이미지부터 단계별로 선명하게' },
  { key: 'direct', label: '👁 바로 공개', desc: '원본을 바로 보여주는 스피드전' },
]

export default function ImageSetup({ go }) {
  const categories = getCategories()
  const [category, setCategory] = useState('전체')
  const [reveal, setReveal] = useState('blur')

  const count =
    category === '전체'
      ? IMAGES.length
      : categories.find((c) => c.name === category)?.count ?? 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10">
      <h2 className="text-2xl font-bold">이미지 게임 설정</h2>

      <div className="w-full flex flex-col gap-6">
        <Section title="카테고리">
          <div className="flex flex-wrap gap-2">
            <Chip
              active={category === '전체'}
              onClick={() => setCategory('전체')}
              label={`전체 섞기 (${IMAGES.length})`}
            />
            {categories.map((c) => (
              <Chip
                key={c.name}
                active={category === c.name}
                onClick={() => setCategory(c.name)}
                label={`${c.name} (${c.count})`}
              />
            ))}
          </div>
        </Section>

        <Section title="공개 방식">
          <div className="grid grid-cols-2 gap-3">
            {REVEAL_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setReveal(m.key)}
                className={`flex flex-col items-center gap-1 p-4 rounded-2xl border transition ${
                  reveal === m.key
                    ? 'bg-neutral-900 border-violet-500'
                    : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500'
                }`}
              >
                <span className="font-semibold">{m.label}</span>
                <span className="text-xs text-neutral-400">{m.desc}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="목표 점수 (선택 시 시작)">
          {count < 4 ? (
            <p className="text-amber-400 text-sm">
              이 카테고리에 이미지가 {count}장뿐이에요. 4장 이상 넣어야 시작할 수 있어요.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {ROUND_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => go('imagebattle', { mode: 'battle', category, reveal, rounds: n })}
                  className="py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold transition"
                >
                  {n}점
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>

      <button
        onClick={() => go('home')}
        className="text-neutral-500 hover:text-neutral-300 text-sm transition"
      >
        ← 홈으로
      </button>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-neutral-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

function Chip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
        active
          ? 'bg-violet-600 text-white'
          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:border-neutral-500'
      }`}
    >
      {label}
    </button>
  )
}
