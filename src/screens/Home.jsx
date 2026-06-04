import { getSongs, getSongStats } from '../lib/storage'
import { IMAGES, getCategories } from '../lib/images'

export default function Home({ go, library }) {
  const songs = getSongs()
  const stats = getSongStats()
  const ready = songs.length >= 4
  const imageReady = IMAGES.length >= 4
  const categories = getCategories()

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">🎧 1초 퀴즈</h1>
        <p className="mt-2 text-neutral-400">노래를 1초만 듣고 제목을 맞춰보세요</p>
      </div>

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={() => go('modeselect')}
          disabled={!ready}
          className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-semibold text-lg transition"
        >
          노래 게임 시작
        </button>
        <button
          onClick={() => go('imagesetup')}
          disabled={!imageReady}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-semibold text-lg transition"
        >
          이미지 게임 시작
        </button>
        <button
          onClick={() => go('teamsetup')}
          disabled={!ready && !imageReady}
          className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-semibold text-lg transition"
        >
          🏆 라운드전 시작
        </button>
        <button
          onClick={() => go('settings')}
          className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 font-medium transition"
        >
          ⚙️ 설정 / 곡 목록
        </button>
      </div>

      <div className="text-sm text-neutral-400 space-y-1">
        {library?.loading ? (
          <p className="text-neutral-300">곡 목록을 불러오는 중…</p>
        ) : library?.error ? (
          <p className="text-red-400">불러오기 실패: {library.error}</p>
        ) : ready ? (
          <p>곡 목록: {songs.length}곡 준비됨</p>
        ) : songs.length > 0 ? (
          <p className="text-amber-400">
            곡이 {songs.length}곡뿐이에요. 4곡 이상이어야 시작할 수 있어요.
          </p>
        ) : (
          <p className="text-amber-400">
            아직 곡이 없어요. <code className="text-amber-300">.env.local</code> 파일에
            API 키·재생목록을 넣거나 설정에서 불러오세요.
          </p>
        )}
        {imageReady ? (
          <p>
            이미지: {IMAGES.length}장 준비됨
            {categories.length > 0 && ` (${categories.map((c) => `${c.name} ${c.count}`).join(' · ')})`}
          </p>
        ) : (
          <p className="text-amber-400">
            이미지 게임은 <code className="text-amber-300">src/images/brand</code>,{' '}
            <code className="text-amber-300">src/images/person</code> 폴더에 사진을 4장 이상
            넣으면 열려요. 파일명이 곧 정답!
          </p>
        )}
        {stats.games > 0 && (
          <p>
            플레이 {stats.games}판 · 한 판 최고 {stats.best}곡 정답
          </p>
        )}
      </div>
    </div>
  )
}
