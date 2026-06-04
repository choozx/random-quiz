// 이미지 라이브러리 — src/images/<카테고리>/<정답>.png 구조를 자동으로 읽는다.
// 폴더에 파일을 넣으면 별도 등록 없이 바로 반영된다 (파일명 = 정답).
const modules = import.meta.glob('../images/*/*', { eager: true, query: '?url', import: 'default' })

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i

// 폴더명(영어) → 화면에 보여줄 카테고리 이름. 없는 폴더는 폴더명 그대로 표시.
const CATEGORY_LABELS = {
  brand: '브랜드',
  person: '인물',
}

export const IMAGES = Object.entries(modules)
  .filter(([path]) => IMAGE_EXT.test(path))
  .map(([path, url]) => {
    // 맥은 파일명을 자모 분리(NFD)로 저장하므로 NFC로 정규화한다.
    const parts = path.normalize('NFC').split('/')
    const file = parts[parts.length - 1]
    const dir = parts[parts.length - 2]
    return {
      category: CATEGORY_LABELS[dir] ?? dir,
      answer: file.replace(IMAGE_EXT, ''),
      url,
    }
  })

// 폴더 이름이 곧 카테고리. [{ name, count }]
export function getCategories() {
  const counts = new Map()
  for (const img of IMAGES) {
    counts.set(img.category, (counts.get(img.category) ?? 0) + 1)
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
}

export function getImagesByCategory(category) {
  if (!category || category === '전체') return IMAGES
  return IMAGES.filter((img) => img.category === category)
}
