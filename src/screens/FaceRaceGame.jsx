import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { getRoster } from '../lib/players'
import { teamColor } from '../lib/teams'

// 우승 빵빠레 — 화면 하단 양쪽 꼭지점에서 발사
function fireFanfare() {
  const opts = {
    particleCount: 110,
    spread: 70,
    startVelocity: 58,
    ticks: 240,
    gravity: 1.1,
    scalar: 1.1,
    colors: ['#fbbf24', '#f43f5e', '#8b5cf6', '#10b981', '#0ea5e9', '#ffffff'],
  }
  confetti({ ...opts, angle: 60, origin: { x: 0, y: 1 } })
  confetti({ ...opts, angle: 120, origin: { x: 1, y: 1 } })
}

// 결승 직전 운빨 미니게임 — 참가자 얼굴이 말이 되어 랜덤 레이스.
// 순위(1등~꼴등)만 산출하고 onDone(order)로 넘긴다. 보상 연결은 나중에.

const FINISH = 100 // 결승선(정규화 위치)

// 레인 색상 — Tailwind 정적 클래스라 통째로 정의
const LANE_COLORS = [
  { ring: 'ring-violet-400', bar: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-400' },
  { ring: 'ring-rose-400', bar: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-400' },
  { ring: 'ring-emerald-400', bar: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-400' },
  { ring: 'ring-amber-400', bar: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-400' },
  { ring: 'ring-sky-400', bar: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-400' },
  { ring: 'ring-fuchsia-400', bar: 'bg-fuchsia-500/15', text: 'text-fuchsia-300', border: 'border-fuchsia-400' },
  { ring: 'ring-lime-400', bar: 'bg-lime-500/15', text: 'text-lime-300', border: 'border-lime-400' },
  { ring: 'ring-orange-400', bar: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-400' },
]

const MEDAL = ['🥇', '🥈', '🥉']

// 돌발 이벤트 — 레이스 중 랜덤 선수에게 발동.
// 위치를 순간이동시키지 않고 임펄스(속도)를 줘서 가감속이 부드럽게 퍼지도록 한다.
// (c = { pos, slow, impulse, ts })
const EVENTS = [
  { emoji: '🌪', label: '돌풍에 휩쓸렸다!', apply: (c, i) => { c.impulse[i] -= KNOCKBACK } },
  { emoji: '🟤', label: '진흙탕에 빠졌다!', apply: (c, i) => { c.slow[i] = c.ts + 1600 } },
  { emoji: '🍌', label: '바나나에 미끄덩!', apply: (c, i) => { c.slow[i] = c.ts + 900 } },
]

// 포토피니시 발동 조건 — 아무도 미완주 + 선두가 결승선 코앞 + 접전
const PHOTO_TRIGGER_DIST = 4 // 선두가 결승선에서 이 거리(칸) 이내일 때 발동
const PHOTO_GAP = 6 // 1·2위 격차가 이보다 작아야 접전으로 인정

// 속도 배율 (박진감 — 너무 느리지 않게). VISIBLE_WORLD와 비율이 같으면 화면 속도감은 유지된다.
const RACE_SPEED = 0.4
// 기믹 임펄스 — 속도에 한 번 더해진 뒤 매 프레임 감쇠해 부드럽게 가감속.
// 총 이동량 ≈ IMPULSE * RACE_SPEED / (1 - IMPULSE_DECAY). 대략 ±13칸을 0.4초에 걸쳐 퍼뜨린다.
const KNOCKBACK = 2.8 // 돌풍 — 뒤로 밀림
const IMPULSE_DECAY = 0.88 // 1프레임(60fps)당 임펄스 감쇠율

// 레인에 깔리는 기믹 아이템 — 말이 밟으면 발동.
// 등장 가능 구간은 출발지 기준 [20~30%], [60~70%] 두 곳. 구간당 최대 1개.
const ITEM_ZONES = [
  [20, 30], // 1차
  [45, 55], // 2차 — 1차와 필살기(75%)의 중간
]
const ITEM_SPAWN_CHANCE = 0.5 // 각 구간에 기믹이 등장할 확률

// 한 레인의 아이템 목록 생성 (구간마다 확률적으로 0~1개)
function genLaneItems() {
  const items = []
  ITEM_ZONES.forEach(([lo, hi], z) => {
    if (Math.random() > ITEM_SPAWN_CHANCE) return
    items.push({
      id: z,
      evIdx: Math.floor(Math.random() * EVENTS.length),
      pos: lo + Math.random() * (hi - lo),
      hit: false,
    })
  })
  return items
}

// 필살기 — 선두가 이 위치를 통과하면 꼴찌에게 한 번 '지속 속도업 버프'.
// 2차 기믹 구간(60~70%) 뒤에 오도록 75%로 둔다. (스타트→1차→2차→필살기→결승)
// 임펄스(순간 가속)가 아니라 일정 시간 속도 배율을 줘서 선두권까지 부드럽게 따라붙게 한다.
const ULTIMATE_AT = 75
const ULTIMATE_BUFF = 1.5 // 버프 동안 속도 배율
const ULTIMATE_MS = 3200 // 버프 지속 시간(ms)
const FREEZE_MS = 1500 // 필살기 컷인 동안 화면 정지 시간(ms)
// 카메라(뷰포트)가 한 번에 보여주는 월드 폭. 작을수록 트랙이 길게 느껴지고 스크롤이 빨라진다
const VISIBLE_WORLD = 20
// 선두를 뷰포트의 몇 % 지점에 둘지 (앞쪽 여백을 남겨 결승선이 보이게)
const LEADER_ANCHOR = 0.62
// 트랙 배경 스크롤 — 월드 1당 px (속도감 연출용)
const SCROLL_PX_PER_WORLD = 13
// 우측 상단 토스트 최대 표시 개수
const MAX_TOASTS = 6

export default function FaceRaceGame({ teams = [], rewards = [], onDone, onQuit }) {
  const players = useMemo(() => getRoster().filter((p) => p.photo), [])
  const n = players.length

  const teamOf = (name) => teams.findIndex((tm) => tm.members?.includes(name))

  const [phase, setPhase] = useState('ready') // ready | countdown | racing | done
  const [count, setCount] = useState(3)
  const [positions, setPositions] = useState(() => players.map(() => 0))
  const [order, setOrder] = useState([]) // 완주 순서(플레이어 인덱스)
  const [toasts, setToasts] = useState([]) // 우측 상단 이벤트 토스트 [{id,emoji,label,name}]
  const [camLeft, setCamLeft] = useState(0) // 카메라 좌측 월드 좌표(보간된 값)
  const [cutIn, setCutIn] = useState(null) // 필살기 컷인 {name, photo}
  const [buffedIdx, setBuffedIdx] = useState(null) // 필살기 버프 중인 말 인덱스
  const [items, setItems] = useState(() => players.map(() => genLaneItems())) // 레인별 기믹 아이템

  const posRef = useRef(players.map(() => 0))
  const spdRef = useRef(players.map(() => 0)) // 관성(부드러운 가속/감속)
  const impulseRef = useRef(players.map(() => 0)) // 기믹 임펄스(감쇠하는 추가 속도)
  const orderRef = useRef([])
  const slowUntilRef = useRef(players.map(() => 0)) // 진흙탕/바나나 감속 만료 시각
  const itemsRef = useRef(items) // 루프에서 읽고/소비하는 아이템 (items state와 동기화)
  const timeScaleRef = useRef(1) // 포토피니시 슬로모용 시간 배율
  const photoRef = useRef(false)
  const toastIdRef = useRef(0)
  const toastTimersRef = useRef([])
  const camRef = useRef(0) // 카메라 보간용
  const ultimateFiredRef = useRef(false) // 필살기 1회 발동 플래그
  const buffUntilRef = useRef(players.map(() => 0)) // 필살기 속도업 버프 만료 시각
  const freezeRef = useRef(false) // 필살기 컷인 동안 레이스 정지

  // 루프가 읽는 itemsRef를 items state와 동기화 (setState 없이 ref만 갱신)
  useEffect(() => { itemsRef.current = items }, [items])

  // 전원 완주 → 우승 빵빠레 (두 번 연달아 터뜨림)
  useEffect(() => {
    if (phase !== 'done') return
    fireFanfare()
    const t = setTimeout(fireFanfare, 600)
    return () => clearTimeout(t)
  }, [phase])

  // 카운트다운 3 → 2 → 1 → 레이스 (setState는 타이머 콜백 안에서만)
  useEffect(() => {
    if (phase !== 'countdown') return
    let c = 3
    const id = setInterval(() => {
      c -= 1
      if (c <= 0) {
        clearInterval(id)
        setPhase('racing')
      } else {
        setCount(c)
      }
    }, 800)
    return () => clearInterval(id)
  }, [phase])

  // 레이스 루프 — rAF 자기참조를 피하려 effect 내부 지역 함수로 정의
  useEffect(() => {
    if (phase !== 'racing') return
    let raf
    let lastTs = null
    const pos = posRef.current
    const spd = spdRef.current
    const slow = slowUntilRef.current
    const impulse = impulseRef.current
    camRef.current = 0
    impulse.fill(0)
    ultimateFiredRef.current = false
    buffUntilRef.current.fill(0)
    freezeRef.current = false

    const loop = (ts) => {
      if (lastTs == null) lastTs = ts
      // 필살기 컷인 동안엔 화면(말)이 멈춘다 — 시간만 흘려보내고 위치는 그대로
      if (freezeRef.current) {
        lastTs = ts
        raf = requestAnimationFrame(loop)
        return
      }
      const dt = Math.min(50, ts - lastTs) // 탭 전환 등 큰 점프 방지
      lastTs = ts
      const frames = (dt / 16.67) * timeScaleRef.current // 포토피니시 땐 느리게

      const leaderPos = Math.max(...pos)

      const racers = []
      for (let i = 0; i < pos.length; i++) if (pos[i] < FINISH) racers.push(i)

      // 필살기 — 레이스 중반, 현재 꼴찌에게: 화면 정지 + 컷인 → 지속 속도업 버프 1회
      if (!ultimateFiredRef.current && leaderPos >= ULTIMATE_AT && racers.length >= 2) {
        ultimateFiredRef.current = true
        let last = -1
        let min = Infinity
        for (const i of racers) if (pos[i] < min) { min = pos[i]; last = i }
        if (last >= 0) {
          freezeRef.current = true
          setCutIn({ name: players[last].name, photo: players[last].photo })
          const tid = setTimeout(() => {
            freezeRef.current = false
            setCutIn(null)
            buffUntilRef.current[last] = performance.now() + ULTIMATE_MS // 컷인 끝난 뒤부터 버프
            setBuffedIdx(last)
            const tid2 = setTimeout(() => setBuffedIdx(null), ULTIMATE_MS)
            toastTimersRef.current.push(tid2)
          }, FREEZE_MS)
          toastTimersRef.current.push(tid)
          raf = requestAnimationFrame(loop)
          return // 이번 프레임부터 정지
        }
      }

      let itemsChanged = false
      let orderChanged = false
      for (let i = 0; i < pos.length; i++) {
        if (pos[i] >= FINISH) continue
        // 고무줄: 뒤처질수록 가속(막판 역전 유도) — 목표 속도에 반영해
        // 관성으로 서서히 붙게 한다(급가속이 아니라 가속도가 붙는 느낌)
        const rubber = 1 + Math.min((leaderPos - pos[i]) * 0.013, 0.65)
        const targetSpd = (0.05 + Math.random() * 0.35) * rubber
        spd[i] += (targetSpd - spd[i]) * 0.08
        let step = spd[i]
        // 진흙탕/바나나 감속
        if (slow[i] > ts) step *= 0.32
        // 필살기 속도업 버프
        if (buffUntilRef.current[i] > ts) step *= ULTIMATE_BUFF
        // 기믹 임펄스를 속도에 합산(돌풍은 음수→뒤로 밀림) 후 감쇠 → 부드러운 가감속
        pos[i] += (step + impulse[i]) * frames * RACE_SPEED
        impulse[i] *= Math.pow(IMPULSE_DECAY, frames)
        if (pos[i] < 0) pos[i] = 0 // 돌풍 임펄스로 출발선 뒤로는 못 감
        // 레인에 깔린 기믹 아이템을 밟으면 발동
        const laneItems = itemsRef.current[i]
        if (laneItems) {
          for (const it of laneItems) {
            if (!it.hit && pos[i] >= it.pos) {
              it.hit = true
              itemsChanged = true
              const ev = EVENTS[it.evIdx]
              ev.apply({ pos, slow, impulse, ts }, i)
              const id = ++toastIdRef.current
              setToasts((prev) => [...prev, { id, emoji: ev.emoji, label: ev.label, name: players[i].name }])
              const tid = setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2200)
              toastTimersRef.current.push(tid)
            }
          }
        }
        if (pos[i] >= FINISH) {
          pos[i] = FINISH
          orderRef.current.push(i)
          orderChanged = true
        }
      }
      if (itemsChanged) setItems(itemsRef.current.map((l) => l.map((it) => ({ ...it }))))
      if (orderChanged) setOrder([...orderRef.current])

      // 포토피니시: 1등 우승 접전일 때만 발동(아직 아무도 완주 X) + 선두권 결승 임박 + 접전.
      // 슬로모는 2등 통과까지 유지해 둘이 나란히 라인 통과하는 연출.
      const desc = [...pos].sort((a, b) => b - a)
      const gap = desc[0] - (desc[1] ?? 0)
      const close = desc[0] >= FINISH - PHOTO_TRIGGER_DIST && gap < PHOTO_GAP
      if (orderRef.current.length === 0 && !photoRef.current && close) {
        photoRef.current = true
        timeScaleRef.current = 0.35
      } else if (photoRef.current && (orderRef.current.length >= 2 || gap > PHOTO_GAP * 2)) {
        // 2등까지 통과했거나 선두가 다시 멀어지면 슬로모 해제
        photoRef.current = false
        timeScaleRef.current = 1
      }

      // 카메라 — 선두를 목표 지점으로 두되 부드럽게 보간 (위치 점프 흡수)
      const targetCam = Math.max(0, Math.min(leaderPos - VISIBLE_WORLD * LEADER_ANCHOR, FINISH - VISIBLE_WORLD))
      camRef.current += (targetCam - camRef.current) * Math.min(1, 0.1 * frames)
      setCamLeft(camRef.current)

      setPositions([...pos])

      if (orderRef.current.length >= pos.length) {
        timeScaleRef.current = 1
        setToasts([])
        setPhase('done')
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      toastTimersRef.current.forEach(clearTimeout)
      toastTimersRef.current = []
    }
  }, [phase, players])

  // 현재 순위표(라이브) — 위치 내림차순
  const liveRank = useMemo(
    () => players.map((_, i) => i).sort((a, b) => positions[b] - positions[a]),
    [players, positions]
  )

  // 팀별 가산점 — 1·2·3등 완주자의 소속 팀에 rewards[순위]를 더한다 (같은 팀이면 누적)
  const teamAwards = useMemo(() => {
    const a = teams.map(() => 0)
    order.forEach((idx, r) => {
      const pts = rewards[r]
      if (!pts) return
      const t = teams.findIndex((tm) => tm.members?.includes(players[idx]?.name))
      if (t >= 0) a[t] += pts
    })
    return a
  }, [order, players, teams, rewards])
  const anyAward = teamAwards.some((p) => p > 0)

  if (n < 2) {
    // 참가자 사진이 부족하면 바로 통과
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
        <p className="text-neutral-400">참가자 얼굴이 부족해서 미니게임을 건너뛰어요.</p>
        <button onClick={() => onDone?.([])} className="py-3 px-8 rounded-2xl bg-amber-600 hover:bg-amber-500 font-bold transition">
          결승 시작 →
        </button>
      </div>
    )
  }

  const hitNames = new Set(toasts.map((t) => t.name))

  // 카메라 — 루프에서 보간된 camLeft 사용. leaderPos는 격차 표시용
  const leaderPos = positions.length ? Math.max(...positions) : 0
  const finishFrac = (FINISH - camLeft) / VISIBLE_WORLD // 결승선의 화면상 위치(0~1)

  return (
    <div className="relative flex-1 flex flex-col gap-3 py-2">
      {/* 필살기 컷인 — 화면 정지 + 문구 부각 */}
      {cutIn && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-hidden">
          <div className="ultimate-focus absolute inset-0" />
          <div className="ultimate-cutin relative flex flex-col items-center gap-4 px-6">
            <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-amber-400 shadow-[0_0_70px_rgba(251,191,36,0.85)]">
              <img src={cutIn.photo} alt={cutIn.name} className="w-full h-full object-cover" />
            </div>
            <p className="text-4xl sm:text-5xl font-black text-amber-300 tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              ⚡ 필살기 발동! ⚡
            </p>
            <p className="text-2xl font-bold text-white drop-shadow">{cutIn.name} 폭주 가속 🔥</p>
          </div>
        </div>
      )}

      {/* 우측 상단 이벤트 토스트 스택 */}
      <div className="absolute top-1 right-1 z-30 flex flex-col gap-1.5 items-end pointer-events-none">
        {toasts.slice(-MAX_TOASTS).reverse().map((t) => {
          const idx = players.findIndex((p) => p.name === t.name)
          const tc = LANE_COLORS[(idx < 0 ? 0 : idx) % LANE_COLORS.length]
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900/95 border border-neutral-700 shadow-lg text-sm"
            >
              <span className="text-base">{t.emoji}</span>
              <span className={`font-bold ${tc.text}`}>{t.name}</span>
              <span className="text-neutral-300">{t.label}</span>
            </div>
          )
        })}
      </div>

      <div className="text-center">
        <p className="text-amber-400 text-sm font-semibold tracking-wide">🏁 결승 직전 미니게임</p>
        <h2 className="text-2xl font-bold mt-1">얼굴 경마 레이스</h2>
        <p className="text-neutral-500 text-xs mt-1">순수 운빨! 누가 먼저 결승선을 통과할까?</p>
      </div>

      {/* 트랙 — 모든 레인이 한 화면에 들어오게 컴팩트. 가로는 1.5배로 넓혀 길이감 ↑ */}
      <div className="relative flex flex-col gap-1.5 w-[150%] -mx-[25%]">
        {players.map((p, i) => {
          const c = LANE_COLORS[i % LANE_COLORS.length]
          const pos = positions[i]
          const finished = pos >= FINISH
          const rank = order.indexOf(i)
          const hit = hitNames.has(p.name)
          const frac = (pos - camLeft) / VISIBLE_WORLD // 화면상 위치(0~1), 음수면 화면 밖(뒤처짐)
          const offMap = frac < -0.01
          const behind = Math.round(leaderPos - pos) // 선두와의 격차(월드 단위)
          const buffed = buffedIdx === i // 필살기 버프 중
          return (
            <div
              key={p.name + i}
              className={`relative h-9 rounded-lg border overflow-hidden ${c.bar} ${hit ? 'border-amber-400' : 'border-neutral-800'}`}
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 40px)',
                backgroundPositionX: `${-camLeft * SCROLL_PX_PER_WORLD}px`,
              }}
            >
              {/* 결승선 — 멀리 오른쪽 밖에서부터 카메라가 다가오며 서서히 밀려 들어온다 */}
              {finishFrac <= 2.5 && (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-[repeating-linear-gradient(45deg,#fff_0_4px,#000_4px_8px)] opacity-50 rounded"
                  style={{ left: `calc((100% - 2rem) * ${Math.max(finishFrac, 0)})` }}
                />
              )}
              {/* 레인에 깔린 기믹 아이템 — 카메라에 들어온 미발동 아이템만 */}
              {items[i]?.map((it) => {
                if (it.hit) return null
                const f = (it.pos - camLeft) / VISIBLE_WORLD
                // f >= 1 이면 화면 오른쪽 끝(또는 밖) — 출발 화면에 1차 기믹이 붙어 보이지 않게 숨김
                if (f < -0.02 || f >= 1) return null
                return (
                  <span
                    key={it.id}
                    className="absolute top-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-neutral-950/80 border border-neutral-600 text-sm shadow"
                    style={{ left: `calc((100% - 2rem) * ${Math.min(Math.max(f, 0), 1)} + 1rem)`, transform: 'translate(-50%, -50%)' }}
                  >
                    {EVENTS[it.evIdx].emoji}
                  </span>
                )
              })}
              {/* 이름 / 완주 메달 / 화면 밖 인디케이터 — 왼쪽 끝 */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5">
                <span className={`text-[11px] font-bold ${c.text}`}>{p.name}</span>
                {finished && <span className="text-xs">{MEDAL[rank] ?? `${rank + 1}위`}</span>}
                {!finished && offMap && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-neutral-900/90 border ${buffed ? 'border-amber-400 text-amber-300 animate-pulse' : `${c.border} ${c.text}`}`}>
                    {buffed && '🔥'} ◀ {behind}m
                  </span>
                )}
              </div>
              {/* 말(얼굴) — 화면 안에 있을 때만 */}
              {!offMap && (
                <div
                  className="absolute top-1/2"
                  style={{
                    left: `calc((100% - 2rem) * ${Math.min(Math.max(frac, 0), 1)})`,
                    transform: 'translateY(-50%)',
                  }}
                >
                  {/* 필살기 버프 중 — 뒤로 끌리는 불꽃 + 속도선 */}
                  {buffed && (
                    <>
                      <span className="ultimate-trail absolute right-7 top-1/2 text-lg pointer-events-none">🔥</span>
                      <span className="absolute right-8 top-1/2 -translate-y-1/2 w-6 h-0.5 bg-gradient-to-l from-amber-400/90 to-transparent pointer-events-none" />
                    </>
                  )}
                  <div className={`w-8 h-8 rounded-full overflow-hidden ring-2 bg-neutral-900 ${buffed ? 'ring-amber-300 shadow-[0_0_14px_rgba(251,146,60,0.95)]' : `${c.ring} shadow`}`}>
                    <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 컨트롤 / 상태 */}
      <div className="mt-auto flex flex-col items-center gap-3 pt-2">
        {phase === 'ready' && (
          <>
            <p className="text-neutral-400 text-sm">출발선에 모두 정렬 완료!</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => { setCount(3); setPhase('countdown') }}
                className="py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 font-bold text-lg transition"
              >
                🏇 레이스 시작!
              </button>
              <button onClick={onQuit} className="py-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-sm transition">
                그만두기
              </button>
            </div>
          </>
        )}

        {phase === 'countdown' && (
          <p className="text-6xl font-black text-amber-400 animate-pulse">
            {count > 0 ? count : '출발!'}
          </p>
        )}

        {phase === 'racing' && (
          <div className="flex flex-wrap justify-center items-center gap-2 text-xs">
            <span className="text-neutral-500">선두</span>
            {liveRank.slice(0, 3).map((idx, r) => (
              <span key={idx} className="px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200">
                {MEDAL[r]} {players[idx].name}
              </span>
            ))}
            <span className="text-neutral-600">· 완주 {order.length}/{n}</span>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-4 w-full">
            {/* 우승자 — 큰 얼굴 + 이름 + 빵빠레 */}
            {order.length > 0 && (
              <div className="ultimate-cutin flex flex-col items-center gap-2">
                <p className="text-amber-400 font-black tracking-widest text-sm">🎉 WINNER 🎉</p>
                <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.8)]">
                  <img src={players[order[0]].photo} alt={players[order[0]].name} className="w-full h-full object-cover" />
                </div>
                <p className="text-3xl font-black text-amber-300">🏆 {players[order[0]].name}</p>
              </div>
            )}
            <h3 className="text-lg font-bold text-neutral-300 mt-1">레이스 결과</h3>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {order.map((idx, r) => {
                const p = players[idx]
                const pts = rewards[r]
                const t = teamOf(p.name)
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${
                      r === 0 ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 bg-neutral-900'
                    }`}
                  >
                    <span className="text-lg w-7 text-center">{MEDAL[r] ?? `${r + 1}`}</span>
                    <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-neutral-700">
                      <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <span className={`font-semibold ${r === 0 ? 'text-amber-300' : 'text-neutral-200'}`}>{p.name}</span>
                    {pts > 0 && (
                      <span className="ml-auto flex items-center gap-2 text-sm">
                        {t >= 0 && <span className={teamColor(teams[t].colorIdx).text}>{teams[t].name}</span>}
                        <span className="font-bold text-emerald-400">+{pts}</span>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {/* 팀별 합산 가산점 */}
            {anyAward ? (
              <div className="flex flex-wrap justify-center gap-2">
                {teamAwards.map((pts, i) =>
                  pts > 0 ? (
                    <div
                      key={i}
                      className={`px-4 py-2 rounded-2xl border ${teamColor(teams[i].colorIdx).border} bg-neutral-900`}
                    >
                      <span className={`font-bold ${teamColor(teams[i].colorIdx).text}`}>🎁 {teams[i].name}</span>
                      <span className="text-neutral-100 font-semibold"> +{pts}점</span>
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <p className="text-neutral-500 text-sm">입상자가 팀 소속이 아니라 가산점은 없어요.</p>
            )}
            <button
              onClick={() => onDone?.(teamAwards)}
              className="py-4 px-10 rounded-2xl bg-amber-600 hover:bg-amber-500 font-bold text-lg transition"
            >
              결승 시작 →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
