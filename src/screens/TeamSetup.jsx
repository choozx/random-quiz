import { useState } from 'react'
import { getPlayers, setPlayers } from '../lib/storage'
import { MAX_TEAMS, teamColor } from '../lib/teams'

// 스네이크 드래프트: 1→2→3 → 3→2→1 → 1→2→3 …
function teamForPick(p, teamCount) {
  const round = Math.floor(p / teamCount)
  const pos = p % teamCount
  return round % 2 === 0 ? pos : teamCount - 1 - pos
}

// step: 'roster' | 'draft'
export default function TeamSetup({ go }) {
  const [step, setStep] = useState('roster')
  const [names, setNames] = useState(() => getPlayers())
  const [input, setInput] = useState('')
  const [teamCount, setTeamCount] = useState(2)
  const [teamNames, setTeamNames] = useState(() =>
    Array.from({ length: MAX_TEAMS }, (_, i) => `${i + 1}팀`)
  )
  const [history, setHistory] = useState([]) // [{ name, teamIdx }] — 팀 구성은 전부 여기서 파생

  function addName() {
    const n = input.trim()
    setInput('')
    if (!n || names.includes(n)) return
    const next = [...names, n]
    setNames(next)
    setPlayers(next)
  }

  function removeName(name) {
    const next = names.filter((x) => x !== name)
    setNames(next)
    setPlayers(next)
  }

  function setTeamName(i, v) {
    setTeamNames((prev) => prev.map((n, idx) => (idx === i ? v : n)))
  }

  function finish() {
    const teams = teamNames.slice(0, teamCount).map((name, i) => ({
      name: name.trim() || `${i + 1}팀`,
      colorIdx: i,
      members: history.filter((h) => h.teamIdx === i).map((h) => h.name),
    }))
    go('tournamentsetup', { teams })
  }

  // --- 1단계: 참가자 + 팀 설정 ---
  if (step === 'roster') {
    const canDraft = names.length >= teamCount
    return (
      <div className="flex-1 flex flex-col gap-6 py-4">
        <h2 className="text-2xl font-bold text-center">👥 팀 구성</h2>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-neutral-400 uppercase tracking-wider">참가자</p>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addName() }}
              placeholder="이름 입력 후 Enter"
              className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 focus:border-violet-500 outline-none text-sm"
            />
            <button
              onClick={addName}
              className="px-5 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-sm transition"
            >
              추가
            </button>
          </div>
          {names.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {names.map((n) => (
                <span key={n} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-sm">
                  {n}
                  <button onClick={() => removeName(n)} className="text-neutral-500 hover:text-rose-400 transition">✕</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">참가자를 추가하세요. 명단은 자동 저장돼요.</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-neutral-400 uppercase tracking-wider">팀 수</p>
          <div className="flex gap-2">
            {Array.from({ length: MAX_TEAMS - 1 }, (_, i) => i + 2).map((n) => (
              <button
                key={n}
                onClick={() => setTeamCount(n)}
                disabled={n > Math.max(names.length, 2)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  teamCount === n
                    ? 'bg-violet-600 text-white'
                    : n > Math.max(names.length, 2)
                      ? 'bg-neutral-900 border border-neutral-800 text-neutral-600'
                      : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:border-neutral-500'
                }`}
              >
                {n}팀
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-neutral-400 uppercase tracking-wider">팀 이름</p>
          <div className="grid grid-cols-2 gap-2">
            {teamNames.slice(0, teamCount).map((n, i) => {
              const c = teamColor(i)
              return (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border ${c.border}`}>
                  <span className={`text-lg ${c.text}`}>●</span>
                  <input
                    value={n}
                    onChange={(e) => setTeamName(i, e.target.value)}
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold"
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-auto">
          {!canDraft && (
            <p className="text-center text-xs text-amber-400">
              참가자가 팀 수({teamCount}명) 이상이어야 시작할 수 있어요.
            </p>
          )}
          <button
            onClick={() => { setHistory([]); setStep('draft') }}
            disabled={!canDraft}
            className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-bold text-lg transition"
          >
            드래프트 시작 →
          </button>
          <button onClick={() => go('home')} className="text-neutral-500 hover:text-neutral-300 text-sm transition">
            ← 홈으로
          </button>
        </div>
      </div>
    )
  }

  // --- 2단계: 드래프트 (롤 챔피언 픽 스타일) ---
  const pool = names.filter((n) => !history.some((h) => h.name === n))
  const done = pool.length === 0
  const currentIdx = done ? -1 : teamForPick(history.length, teamCount)
  const currentColor = currentIdx >= 0 ? teamColor(currentIdx) : null
  const upcoming = Array.from({ length: Math.min(3, pool.length - 1) }, (_, k) =>
    teamNames[teamForPick(history.length + 1 + k, teamCount)]
  )

  return (
    <div className="flex-1 flex flex-col gap-6 py-4">
      {/* 픽 배너 */}
      <div className="text-center">
        {done ? (
          <h2 className="text-2xl font-bold text-emerald-400">팀 구성 완료!</h2>
        ) : (
          <>
            <p className="text-xs text-neutral-500 mb-1">픽 {history.length + 1} / {names.length}</p>
            <h2 className={`text-2xl font-bold ${currentColor.text}`}>
              {teamNames[currentIdx]} 픽 차례!
            </h2>
            {upcoming.length > 0 && (
              <p className="text-xs text-neutral-500 mt-1">다음: {upcoming.join(' → ')}</p>
            )}
          </>
        )}
      </div>

      {/* 팀 카드 */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(teamCount, 3)}, minmax(0, 1fr))` }}
      >
        {teamNames.slice(0, teamCount).map((tn, i) => {
          const c = teamColor(i)
          const isCurrent = !done && i === currentIdx
          const members = history.filter((h) => h.teamIdx === i).map((h) => h.name)
          return (
            <div
              key={i}
              className={`flex flex-col gap-2 p-3 rounded-2xl bg-neutral-900 border-2 transition ${
                isCurrent ? `${c.border} shadow-lg` : 'border-neutral-800'
              }`}
            >
              <p className={`text-sm font-bold ${c.text}`}>
                {tn} {isCurrent && '⬅'}
              </p>
              <div className="flex flex-col gap-1 min-h-[2rem]">
                {members.length === 0 ? (
                  <span className="text-xs text-neutral-600">—</span>
                ) : (
                  members.map((m) => (
                    <span key={m} className="text-sm text-neutral-200">{m}</span>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 대기 풀 */}
      {!done && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-neutral-400 uppercase tracking-wider">대기 인원 — 클릭해서 픽</p>
          <div className="flex flex-wrap gap-2">
            {pool.map((n) => (
              <button
                key={n}
                onClick={() => setHistory((prev) => [...prev, { name: n, teamIdx: currentIdx }])}
                className={`px-4 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm font-semibold transition hover:text-white ${currentColor.bgHover} hover:border-transparent`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-auto">
        {done && (
          <button
            onClick={finish}
            className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 font-bold text-lg transition"
          >
            라운드 구성으로 →
          </button>
        )}
        <div className="flex justify-center gap-6 text-sm">
          <button
            onClick={() => setHistory((prev) => prev.slice(0, -1))}
            disabled={!history.length}
            className="text-neutral-400 hover:text-neutral-200 disabled:text-neutral-700 transition"
          >
            ↩ 이전 픽 취소
          </button>
          <button onClick={() => setStep('roster')} className="text-neutral-500 hover:text-neutral-300 transition">
            ← 참가자 설정으로
          </button>
        </div>
      </div>
    </div>
  )
}
