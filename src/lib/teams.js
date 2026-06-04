// 팀 색상 팔레트 — Tailwind는 정적 클래스만 인식하므로 문자열을 통째로 정의한다.
export const TEAM_COLORS = [
  { text: 'text-violet-400', bg: 'bg-violet-600', bgHover: 'hover:bg-violet-500', border: 'border-violet-500', hex: '#8b5cf6' },
  { text: 'text-rose-400', bg: 'bg-rose-600', bgHover: 'hover:bg-rose-500', border: 'border-rose-500', hex: '#f43f5e' },
  { text: 'text-emerald-400', bg: 'bg-emerald-600', bgHover: 'hover:bg-emerald-500', border: 'border-emerald-500', hex: '#10b981' },
  { text: 'text-amber-400', bg: 'bg-amber-600', bgHover: 'hover:bg-amber-500', border: 'border-amber-500', hex: '#f59e0b' },
  { text: 'text-sky-400', bg: 'bg-sky-600', bgHover: 'hover:bg-sky-500', border: 'border-sky-500', hex: '#0ea5e9' },
  { text: 'text-fuchsia-400', bg: 'bg-fuchsia-600', bgHover: 'hover:bg-fuchsia-500', border: 'border-fuchsia-500', hex: '#d946ef' },
]

export const MAX_TEAMS = TEAM_COLORS.length

export function teamColor(idx) {
  return TEAM_COLORS[idx % TEAM_COLORS.length]
}
