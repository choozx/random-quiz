// 참가자 명단 — src/players/players.json + 같은 폴더의 사진(파일명 = 이름)을 읽는다.
// 명단과 사진은 깃에 안 올라가므로(개인정보), 파일이 없어도 빌드가 깨지지 않게 glob으로 읽는다.
const rosterModules = import.meta.glob('../players/players.json', { eager: true, import: 'default' })
const rosterRaw = Object.values(rosterModules)[0] ?? []

const photoModules = import.meta.glob('../players/*', { eager: true, query: '?url', import: 'default' })

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i
const GRADES = ['일반', '레어', '전설']

const photos = {}
for (const [path, url] of Object.entries(photoModules)) {
  if (!IMAGE_EXT.test(path)) continue
  // 맥은 파일명을 자모 분리(NFD)로 저장하므로 NFC로 정규화한다.
  const file = path.normalize('NFC').split('/').pop()
  photos[file.replace(IMAGE_EXT, '')] = url
}

// [{ name, birthYear, region, nickname, grade, ovr, photo }] — 이름만 필수
export function getRoster() {
  if (!Array.isArray(rosterRaw)) return []
  return rosterRaw
    .filter((p) => p && p['이름'])
    .map((p) => {
      const name = String(p['이름']).normalize('NFC').trim()
      return {
        name,
        birthYear: Number(p['출생년도']) || null,
        region: p['지역'] ?? '',
        nickname: p['별명'] ?? '',
        grade: GRADES.includes(p['등급']) ? p['등급'] : '일반',
        ovr: Number(p['OVR']) || null,
        photo: photos[name] ?? null,
      }
    })
}
