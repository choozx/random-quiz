import { useMemo } from 'react'
import { getRoster } from '../lib/players'
import FaceRaceGame from './FaceRaceGame'

// 얼굴 경마 미니게임을 토너먼트 흐름 없이 단독으로 테스트하는 화면.
// 명단을 임의로 3팀에 나눠 가산점 배지까지 확인할 수 있게 한다.
export default function RaceTest({ go }) {
  const teams = useMemo(() => {
    const roster = getRoster().filter((p) => p.photo)
    const count = Math.min(3, Math.max(1, roster.length))
    const t = Array.from({ length: count }, (_, i) => ({ name: `${i + 1}팀`, colorIdx: i, members: [] }))
    roster.forEach((p, i) => t[i % count].members.push(p.name))
    return t
  }, [])

  return (
    <div className="flex-1 flex flex-col">
      <button onClick={() => go('home')} className="self-start text-neutral-500 hover:text-neutral-300 text-sm transition mb-2">
        ← 홈으로
      </button>
      <FaceRaceGame
        teams={teams}
        rewards={[4, 2, 1]}
        onDone={() => go('home')}
        onQuit={() => go('home')}
      />
    </div>
  )
}
