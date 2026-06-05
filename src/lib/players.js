// 참가자 명단 — src/players/players.json + 같은 폴더의 사진(파일명 = 이름)을 읽는다.
// 명단과 사진은 깃에 안 올라가므로(개인정보), 파일이 없어도 빌드가 깨지지 않게 glob으로 읽는다.
const rosterModules = import.meta.glob('../players/players.json', { eager: true, import: 'default' })
const rosterRaw = Object.values(rosterModules)[0] ?? []

const photoModules = import.meta.glob('../players/*', { eager: true, query: '?url', import: 'default' })

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i
const GRADES = ['normal', 'rare', 'legend']

const photos = {}
for (const [path, url] of Object.entries(photoModules)) {
  if (!IMAGE_EXT.test(path)) continue
  // 맥은 파일명을 자모 분리(NFD)로 저장하므로 NFC로 정규화한다.
  const file = path.normalize('NFC').split('/').pop()
  photos[file.replace(IMAGE_EXT, '')] = url
}

// 카드 프레임 등 연출용 공용 에셋 — 개인정보가 아니므로 src/assets/reveal/ 에서 깃으로 관리
const frameModules = import.meta.glob('../assets/reveal/card_frame.png', { eager: true, query: '?url', import: 'default' })
export const CARD_FRAME = Object.values(frameModules)[0] ?? null

// [{ name, birthYear, region, nickname, grade, ovr, photo, couple }] — name만 필수
// grade: normal | rare | legend
// couple: 커플 상대 이름 — 랜덤 픽에서 같은 팀에 배정 (한쪽에만 적어도 됨)
export function getRoster() {
  if (!Array.isArray(rosterRaw)) return []
  return rosterRaw
    .filter((p) => p && p.name)
    .map((p) => {
      const name = String(p.name).normalize('NFC').trim()
      return {
        name,
        birthYear: Number(p.birthYear) || null,
        region: p.region ?? '',
        nickname: p.nickname ?? '',
        grade: GRADES.includes(p.grade) ? p.grade : 'normal',
        ovr: Number(p.ovr) || null,
        photo: photos[name] ?? null,
        couple: String(p.couple ?? '').normalize('NFC').trim() || null,
      }
    })
}
