import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPlayers, setPlayers, getRosterSelected, setRosterSelected } from '../lib/storage'
import { MAX_TEAMS, teamColor } from '../lib/teams'
import { getRoster } from '../lib/players'

const GRADE_STYLE = {
  '일반': { hex: '#d4d4d4', label: '일반' },
  '레어': { hex: '#a78bfa', label: '레어' },
  '전설': { hex: '#fbbf24', label: '전설 ✨' },
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 스네이크 드래프트: 1→2→3 → 3→2→1 → 1→2→3 …
function teamForPick(p, teamCount) {
  const round = Math.floor(p / teamCount)
  const pos = p % teamCount
  return round % 2 === 0 ? pos : teamCount - 1 - pos
}

// 인원 균형 랜덤 배정 (팀별 차이 최대 1명, 남는 자리는 랜덤 팀에)
function randomAssignment(names, teamCount) {
  const shuffled = shuffle(names)
  const teamOrder = shuffle(Array.from({ length: teamCount }, (_, i) => i))
  return shuffled.map((name, i) => ({ name, teamIdx: teamOrder[i % teamCount] }))
}

// 터널 공개 단계 — 데이터 있는 항목만 (명단에 없는 사람은 팀 → 카드로 바로)
function buildStages(p) {
  if (!p) return ['team', 'card']
  const stages = ['team', 'grade']
  if (p.region) stages.push('region')
  if (p.birthYear) stages.push('age')
  if (p.nickname) stages.push('nickname')
  if (p.photo) stages.push('silhouette')
  stages.push('card')
  return stages
}

// step: 'roster' | 'draft' | 'reveal'
export default function TeamSetup({ go }) {
  const roster = useMemo(() => getRoster(), [])
  const rosterNames = useMemo(() => roster.map((p) => p.name), [roster])
  const rosterMap = useMemo(() => new Map(roster.map((p) => [p.name, p])), [roster])

  const [step, setStep] = useState('roster')
  const [manualNames, setManualNames] = useState(() => getPlayers())
  const [selected, setSelected] = useState(() => getRosterSelected().filter((n) => rosterNames.includes(n)))
  const [input, setInput] = useState('')
  const [teamCount, setTeamCount] = useState(2)
  const [teamNames, setTeamNames] = useState(() =>
    Array.from({ length: MAX_TEAMS }, (_, i) => `${i + 1}팀`)
  )
  const [history, setHistory] = useState([]) // 드래프트: [{ name, teamIdx }]
  const [assignment, setAssignment] = useState([]) // 랜덤: [{ name, teamIdx }] (공개 순서대로)
  const [revealKey, setRevealKey] = useState(0)

  const names = useMemo(
    () => [...rosterNames.filter((n) => selected.includes(n)), ...manualNames],
    [rosterNames, selected, manualNames]
  )

  function toggleRoster(name) {
    const next = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]
    setSelected(next)
    setRosterSelected(next)
  }

  function addName() {
    const n = input.trim()
    setInput('')
    if (!n || names.includes(n)) return
    const next = [...manualNames, n]
    setManualNames(next)
    setPlayers(next)
  }

  function removeName(name) {
    const next = manualNames.filter((x) => x !== name)
    setManualNames(next)
    setPlayers(next)
  }

  function setTeamName(i, v) {
    setTeamNames((prev) => prev.map((n, idx) => (idx === i ? v : n)))
  }

  const finish = useCallback((picks) => {
    const teams = teamNames.slice(0, teamCount).map((name, i) => ({
      name: name.trim() || `${i + 1}팀`,
      colorIdx: i,
      members: picks.filter((h) => h.teamIdx === i).map((h) => h.name),
    }))
    go('tournamentsetup', { teams })
  }, [teamNames, teamCount, go])

  // --- 1단계: 참가자 + 팀 설정 ---
  if (step === 'roster') {
    const canStart = names.length >= teamCount
    return (
      <div className="flex-1 flex flex-col gap-6 py-4">
        <h2 className="text-2xl font-bold text-center">👥 팀 구성</h2>

        {roster.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
              명단에서 선택 <span className="normal-case text-neutral-600">(players.json)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {roster.map((p) => {
                const on = selected.includes(p.name)
                return (
                  <button
                    key={p.name}
                    onClick={() => toggleRoster(p.name)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition ${
                      on
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500'
                    }`}
                  >
                    {p.name}{p.grade === '전설' && ' ✨'}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-neutral-400 uppercase tracking-wider">직접 추가</p>
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
          {manualNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {manualNames.map((n) => (
                <span key={n} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-sm">
                  {n}
                  <button onClick={() => removeName(n)} className="text-neutral-500 hover:text-rose-400 transition">✕</button>
                </span>
              ))}
            </div>
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
          {!canStart && (
            <p className="text-center text-xs text-amber-400">
              참가자가 팀 수({teamCount}명) 이상이어야 시작할 수 있어요. (현재 {names.length}명)
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setHistory([]); setStep('draft') }}
              disabled={!canStart}
              className="py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-bold transition"
            >
              🫳 직접 픽
            </button>
            <button
              onClick={() => { setAssignment(randomAssignment(names, teamCount)); setRevealKey((k) => k + 1); setStep('reveal') }}
              disabled={!canStart}
              className="py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-bold transition"
            >
              🎲 랜덤 픽
            </button>
          </div>
          <button onClick={() => go('home')} className="text-neutral-500 hover:text-neutral-300 text-sm transition">
            ← 홈으로
          </button>
        </div>
      </div>
    )
  }

  // --- 랜덤 픽: 터널 공개 ---
  if (step === 'reveal') {
    return (
      <RandomReveal
        key={revealKey}
        assignment={assignment}
        teamNames={teamNames}
        teamCount={teamCount}
        rosterMap={rosterMap}
        onFinish={() => finish(assignment)}
        onReshuffle={() => { setAssignment(randomAssignment(names, teamCount)); setRevealKey((k) => k + 1) }}
        onBack={() => setStep('roster')}
      />
    )
  }

  // --- 직접 픽: 드래프트 (롤 챔피언 픽 스타일) ---
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
            onClick={() => finish(history)}
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

// ─── 랜덤 픽 터널 공개 (피파 워크아웃 스타일) ───
function RandomReveal({ assignment, teamNames, teamCount, rosterMap, onFinish, onReshuffle, onBack }) {
  const [idx, setIdx] = useState(0)
  const [stage, setStage] = useState(0)
  const [done, setDone] = useState(false)

  const cur = assignment[idx]
  const player = rosterMap.get(cur?.name)
  const stages = useMemo(() => buildStages(player), [player])
  const stageName = stages[stage]
  const tColor = teamColor(cur?.teamIdx ?? 0)
  const grade = GRADE_STYLE[player?.grade ?? '일반']
  const isLegend = player?.grade === '전설'

  const advance = useCallback(() => {
    if (done) return
    if (stage < stages.length - 1) {
      setStage(stage + 1)
    } else if (idx < assignment.length - 1) {
      setIdx(idx + 1)
      setStage(0)
    } else {
      setDone(true)
    }
  }, [done, stage, stages.length, idx, assignment.length])

  // 힌트 단계는 자동 진행, 카드 단계는 클릭 대기
  useEffect(() => {
    if (done || stageName === 'card') return
    const t = setTimeout(advance, 1300)
    return () => clearTimeout(t)
  }, [done, stageName, advance])

  // 터널 색: 기본은 팀 색, 등급 단계에서 등급 색으로
  const tint = stageName === 'grade' ? grade.hex : tColor.hex

  const boards = (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(teamCount, 3)}, minmax(0, 1fr))` }}
    >
      {teamNames.slice(0, teamCount).map((tn, i) => {
        const c = teamColor(i)
        const members = assignment
          .slice(0, done ? assignment.length : idx)
          .filter((a) => a.teamIdx === i)
          .map((a) => a.name)
        return (
          <div key={i} className="flex flex-col gap-1 p-3 rounded-2xl bg-neutral-900 border border-neutral-800">
            <p className={`text-xs font-bold ${c.text}`}>{tn}</p>
            {members.length === 0 ? (
              <span className="text-xs text-neutral-600">—</span>
            ) : (
              members.map((m) => <span key={m} className="text-sm text-neutral-200">{m}</span>)
            )}
          </div>
        )
      })}
    </div>
  )

  // --- 전원 공개 완료 ---
  if (done) {
    return (
      <div className="flex-1 flex flex-col gap-6 py-4">
        <h2 className="text-2xl font-bold text-center text-emerald-400">팀 구성 완료!</h2>
        {boards}
        <div className="flex flex-col gap-3 mt-auto">
          <button onClick={onFinish} className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 font-bold text-lg transition">
            라운드 구성으로 →
          </button>
          <div className="flex justify-center gap-6 text-sm">
            <button onClick={onReshuffle} className="text-neutral-400 hover:text-neutral-200 transition">
              🎲 다시 섞기
            </button>
            <button onClick={onBack} className="text-neutral-500 hover:text-neutral-300 transition">
              ← 참가자 설정으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>추첨 {idx + 1} / {assignment.length}</span>
        <button onClick={() => setDone(true)} className="hover:text-neutral-300 transition">
          ⏭ 한번에 공개
        </button>
      </div>

      {/* 터널 무대 — 클릭하면 다음 단계 */}
      <div
        onClick={advance}
        className="relative w-full aspect-square sm:aspect-video rounded-3xl overflow-hidden bg-neutral-950 border border-neutral-800 cursor-pointer select-none flex items-center justify-center"
      >
        {/* 터널 링 */}
        {[0, 0.6, 1.2].map((delay) => (
          <div
            key={delay}
            className="ring-fly absolute w-40 h-40 rounded-full border-2 pointer-events-none"
            style={{ borderColor: tint, animationDelay: `${delay}s` }}
          />
        ))}

        {/* 단계 콘텐츠 */}
        <div key={`${idx}-${stage}`} className="relative z-10 text-center px-6">
          {stageName === 'team' && (
            <div className="stage-in">
              <p className="text-sm text-neutral-400 mb-2">다음 멤버가 합류할 팀은…</p>
              <h2 className={`text-4xl font-bold ${tColor.text}`}>{teamNames[cur.teamIdx]}</h2>
            </div>
          )}
          {stageName === 'grade' && (
            <div className="stage-in">
              <p className="text-sm text-neutral-400 mb-2">카드 등급</p>
              <h2 className="text-4xl font-bold" style={{ color: grade.hex }}>{grade.label}</h2>
            </div>
          )}
          {stageName === 'region' && (
            <div className="stage-in">
              <p className="text-sm text-neutral-400 mb-2">출신</p>
              <h2 className="text-3xl font-bold text-neutral-100">{player.region}</h2>
            </div>
          )}
          {stageName === 'age' && (
            <div className="stage-in">
              <p className="text-sm text-neutral-400 mb-2">나이</p>
              <h2 className="text-3xl font-bold text-neutral-100">
                {Math.floor((player.birthYear % 100) / 10)}X년생
              </h2>
            </div>
          )}
          {stageName === 'nickname' && (
            <div className="stage-in">
              <p className="text-sm text-neutral-400 mb-2">별명</p>
              <h2 className="text-3xl font-bold text-neutral-100">“{player.nickname}”</h2>
            </div>
          )}
          {stageName === 'silhouette' && (
            <div className="stage-in">
              <img
                src={player.photo}
                alt=""
                className="h-52 mx-auto rounded-2xl object-contain"
                style={{ filter: `brightness(0) drop-shadow(0 0 30px ${tColor.hex})` }}
              />
            </div>
          )}
          {stageName === 'card' && (
            <div className="relative">
              {/* 빛 폭발 */}
              <div
                className="card-burst absolute inset-0 m-auto w-40 h-40 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${isLegend ? '#fbbf24' : '#ffffff'} 0%, transparent 70%)` }}
              />
              <div
                className="card-in relative w-52 mx-auto rounded-2xl overflow-hidden border-2 bg-neutral-900"
                style={{ borderColor: grade.hex, boxShadow: `0 0 36px ${isLegend ? '#fbbf2466' : tColor.hex + '55'}` }}
              >
                {player?.photo ? (
                  <img src={player.photo} alt="" className="w-full h-52 object-cover" />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center text-5xl font-bold text-neutral-600">
                    {cur.name[0]}
                  </div>
                )}
                <div className="p-3 text-left" style={{ background: `linear-gradient(160deg, ${tColor.hex}33, transparent)` }}>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-lg font-bold text-neutral-50">{cur.name}</span>
                    {player?.ovr && (
                      <span className="text-2xl font-bold" style={{ color: grade.hex }}>{player.ovr}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className={tColor.text}>{teamNames[cur.teamIdx]}</span>
                    {player && <span style={{ color: grade.hex }}>{player.grade}</span>}
                  </div>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-4">클릭해서 계속</p>
            </div>
          )}
        </div>
      </div>

      {boards}
    </div>
  )
}
