import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPlayers, setPlayers, getRosterSelected, setRosterSelected } from '../lib/storage'
import { MAX_TEAMS, teamColor } from '../lib/teams'
import { getRoster, CARD_FRAME } from '../lib/players'

// 카드 프레임 위 요소 배치 (프레임 이미지 기준 % 좌표 — 프레임을 바꾸면 여기만 조정)
const FRAME_LAYOUT = {
  photo: { left: '31.5%', top: '6%', width: '37%', height: '53%' },
  photoClip: 'polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)', // 패널 아래쪽 뾰족한 모양
  ovr: { left: '16%', top: '8%' },
  nameTop: '61%',
}

const GRADE_STYLE = {
  '일반': { hex: '#d4d4d4', label: '일반' },
  '레어': { hex: '#a78bfa', label: '레어' },
  '전설': { hex: '#fbbf24', label: '전설 ✨' },
}

// 터널 단계 사이 깊이 간격(px) — 클수록 한 걸음이 길어진다
const TUNNEL_SPACING = 600
// 한 단계 거리를 걷는 데 걸리는 시간(ms) — 등속 주행 속도
const WALK_MS_PER_STAGE = 1600
// 팀 텍스트 노출 시간(ms) — 첫 정보라 다른 힌트보다 길게
const TEAM_EXPOSURE_MS = 1200
// 출발 지점(단계 단위, 음수) — 노출 시간만큼 팀 텍스트에서 떨어진 곳에서 걸어온다
// (0.18 = 텍스트를 지나치며 사라지기 시작하는 거리)
const START_PROGRESS = -(TEAM_EXPOSURE_MS / WALK_MS_PER_STAGE - 0.18)

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
  const [progress, setProgress] = useState(START_PROGRESS) // 팀 텍스트 앞 ~ stages.length-1(카드), 단계 단위
  const [done, setDone] = useState(false)
  const progressRef = useRef(START_PROGRESS)

  const cur = assignment[idx]
  const player = rosterMap.get(cur?.name)
  const stages = useMemo(() => buildStages(player), [player])
  const lastIdx = stages.length - 1
  const arrived = progress >= lastIdx - 0.001
  const tColor = teamColor(cur?.teamIdx ?? 0)
  const grade = GRADE_STYLE[player?.grade ?? '일반']
  const isLegend = player?.grade === '전설'

  // 일정한 속도로 걸어 들어간다 — 카드 앞에 도착하면 멈추고 클릭 대기
  // (progress 리셋은 advance의 다음 사람 분기에서 처리)
  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = now - last
      last = now
      const next = Math.min(progressRef.current + dt / WALK_MS_PER_STAGE, lastIdx)
      progressRef.current = next
      setProgress(next)
      if (next < lastIdx) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [idx, lastIdx])

  const advance = useCallback(() => {
    if (done) return
    if (progressRef.current < lastIdx - 0.001) {
      // 걷는 중 클릭 → 다음 지점으로 건너뛰기
      const next = Math.min(Math.floor(progressRef.current + 1e-6) + 1, lastIdx)
      progressRef.current = next
      setProgress(next)
    } else if (idx < assignment.length - 1) {
      progressRef.current = START_PROGRESS
      setProgress(START_PROGRESS)
      setIdx(idx + 1)
    } else {
      setDone(true)
    }
  }, [done, lastIdx, idx, assignment.length])

  // 터널 색: 기본은 팀 색, 등급 지점 근처에선 등급 색으로
  const tint = stages[Math.min(Math.round(progress), lastIdx)] === 'grade' ? grade.hex : tColor.hex

  // 카메라와의 거리(단계 단위)에 따른 표시 — 바로 앞 하나만 보이게
  function itemOpacity(i) {
    const d = i - progress
    if (d > 1.15) return 0                    // 두 단계 이상 앞 — 아직 안 보임
    if (d > 0.55) return (1.15 - d) / 0.6     // 다가오며 서서히 나타남
    if (d > -0.18) return 1                   // 눈앞
    if (d > -0.5) return (d + 0.5) / 0.32     // 지나치며 사라짐
    return 0
  }

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

      {/* 터널 무대 — 클릭하면 다음 단계. 힌트들이 터널 안에 일렬로 서 있고 카메라가 카드까지 걸어 들어간다 */}
      <div
        onClick={advance}
        className="relative w-full aspect-square sm:aspect-video rounded-3xl overflow-hidden bg-neutral-950 border border-neutral-800 cursor-pointer select-none"
        style={{ perspective: '700px' }}
      >
        {/* key=idx: 다음 사람으로 넘어가면 터널 입구에서 새로 시작 */}
        <div
          key={idx}
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            transform: `translateZ(${progress * TUNNEL_SPACING}px)`,
          }}
        >
          {/* 터널 벽 프레임 — 지나칠 때 시차로 걸어가는 느낌을 만든다 */}
          {Array.from({ length: (stages.length - 1) * 3 + 4 }, (_, k) => (
            <div
              key={k}
              className="absolute rounded-[2.5rem] border-2 pointer-events-none"
              style={{
                inset: '6%',
                borderColor: tint,
                opacity: 0.22,
                transform: `translateZ(${-k * (TUNNEL_SPACING / 3)}px)`,
                transition: 'border-color 0.6s',
              }}
            />
          ))}

          {/* 터널 끝의 빛 — 카드가 기다리는 곳 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translateZ(${-(stages.length - 1) * TUNNEL_SPACING - 80}px)`,
              background: `radial-gradient(circle, ${tint}55 0%, transparent 65%)`,
            }}
          />

          {/* 단계 콘텐츠 — 깊이를 따라 일렬 배치, 바로 앞 것만 보이고 지나치면 사라짐 */}
          {stages.map((name, i) => (
            <div
              key={`${idx}-${i}`}
              className="absolute inset-0 flex items-center justify-center text-center px-6"
              style={{
                transform: `translateZ(${-i * TUNNEL_SPACING}px)`,
                opacity: itemOpacity(i),
              }}
            >
              {stageItem(name)}
            </div>
          ))}
        </div>
      </div>

      {boards}
    </div>
  )

  // 터널의 각 지점에 놓이는 콘텐츠
  function stageItem(name) {
    if (name === 'team') {
      return (
        <div>
          <p className="text-sm text-neutral-400 mb-2">다음 멤버가 합류할 팀은…</p>
          <h2 className={`text-4xl font-bold ${tColor.text}`}>{teamNames[cur.teamIdx]}</h2>
        </div>
      )
    }
    if (name === 'grade') {
      return (
        <div>
          <p className="text-sm text-neutral-400 mb-2">카드 등급</p>
          <h2 className="text-4xl font-bold" style={{ color: grade.hex }}>{grade.label}</h2>
        </div>
      )
    }
    if (name === 'region') {
      return (
        <div>
          <p className="text-sm text-neutral-400 mb-2">출신</p>
          <h2 className="text-3xl font-bold text-neutral-100">{player.region}</h2>
        </div>
      )
    }
    if (name === 'age') {
      return (
        <div>
          <p className="text-sm text-neutral-400 mb-2">나이</p>
          <h2 className="text-3xl font-bold text-neutral-100">
            {Math.floor((player.birthYear % 100) / 10)}X년생
          </h2>
        </div>
      )
    }
    if (name === 'nickname') {
      return (
        <div>
          <p className="text-sm text-neutral-400 mb-2">별명</p>
          <h2 className="text-3xl font-bold text-neutral-100">“{player.nickname}”</h2>
        </div>
      )
    }
    if (name === 'silhouette') {
      return (
        <img
          src={player.photo}
          alt=""
          className="h-52 rounded-2xl object-contain"
          style={{ filter: `brightness(0) drop-shadow(0 0 30px ${tColor.hex})` }}
        />
      )
    }
    // name === 'card'
    return (
      <div className="relative">
        {/* 빛 폭발 — 카메라가 카드 앞에 도착한 순간 */}
        {arrived && (
          <div
            className="card-burst absolute inset-0 m-auto w-40 h-40 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${isLegend ? '#fbbf24' : '#ffffff'} 0%, transparent 70%)` }}
          />
        )}
        {CARD_FRAME ? (
                /* 피파 스타일 카드 프레임 합성 */
                <div
                  className="relative w-64 aspect-square mx-auto"
                  style={{ filter: `drop-shadow(0 0 20px ${isLegend ? '#fbbf24aa' : tColor.hex + '88'})` }}
                >
                  <img src={CARD_FRAME} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                  {player?.photo ? (
                    <img
                      src={player.photo}
                      alt=""
                      className="absolute object-cover"
                      style={{ ...FRAME_LAYOUT.photo, clipPath: FRAME_LAYOUT.photoClip }}
                    />
                  ) : (
                    <div
                      className="absolute flex items-center justify-center text-6xl font-bold text-white/70"
                      style={FRAME_LAYOUT.photo}
                    >
                      {cur.name[0]}
                    </div>
                  )}
                  {player?.ovr && (
                    <span
                      className="absolute text-2xl font-bold"
                      style={{ ...FRAME_LAYOUT.ovr, color: '#ffe9a8', textShadow: '0 1px 4px rgba(0,0,0,.85)' }}
                    >
                      {player.ovr}
                    </span>
                  )}
                  <div className="absolute inset-x-0 text-center" style={{ top: FRAME_LAYOUT.nameTop }}>
                    <p className="text-xl font-bold text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>
                      {cur.name}
                    </p>
                    <p className={`text-sm font-semibold ${tColor.text}`} style={{ textShadow: '0 1px 4px rgba(0,0,0,.9)' }}>
                      {teamNames[cur.teamIdx]}{player ? ` · ${player.grade}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                /* 프레임 이미지가 없을 때의 기본 카드 */
                <div
                  className="relative w-52 mx-auto rounded-2xl overflow-hidden border-2 bg-neutral-900"
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
              )}
        {arrived && (
          <p className="text-xs text-neutral-500 mt-4">클릭해서 계속</p>
        )}
      </div>
    )
  }
}
