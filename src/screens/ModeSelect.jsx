export default function ModeSelect({ go }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10">
      <h2 className="text-2xl font-bold">모드 선택</h2>

      <div className="w-full flex flex-col gap-6">
        <Section title="플레이 방식">
          <div className="grid grid-cols-2 gap-3">
            <ModeCard
              label="싱글"
              desc="혼자 점수 도전"
              icon="🎮"
              onSelect={(rounds) => go('song', { mode: 'single', rounds })}
            />
            <ModeCard
              label="대결"
              desc="먼저 N점 달성 시 우승"
              icon="⚔️"
              onSelect={(rounds) => go('battle', { mode: 'battle', rounds })}
            />
          </div>
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

const ROUND_OPTIONS = [5, 10, 15, 20]

function ModeCard({ label, desc, icon, onSelect }) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-neutral-900 border border-neutral-700">
      <div className="flex flex-col items-center gap-1">
        <span className="text-3xl">{icon}</span>
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-neutral-400">{desc}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ROUND_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className="py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition"
          >
            {n}곡
          </button>
        ))}
      </div>
    </div>
  )
}
