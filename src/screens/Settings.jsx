import { useState } from 'react'
import {
  getApiKey,
  setApiKey,
  getPlaylistInput,
  setPlaylistInput,
  getSongs,
  setSongs,
  setSongsSource,
} from '../lib/storage'
import { hasEnvConfig } from '../lib/config'

export default function Settings({ go, library }) {
  const [apiKey, setKey] = useState(getApiKey())
  const [playlist, setPlaylist] = useState(getPlaylistInput())
  const [songs, setSongList] = useState(getSongs())
  const [msg, setMsg] = useState(null) // { type:'ok'|'err', text }

  async function load() {
    // 입력값을 이 브라우저에 저장 (.env.local 값보다 우선)
    setApiKey(apiKey.trim())
    setPlaylistInput(playlist.trim())
    setMsg(null)
    const result = await library.refresh(true)
    if (result.ok) {
      setSongList(getSongs())
      setMsg({ type: 'ok', text: `${result.count}곡을 불러왔어요!` })
    } else if (result.reason === 'no-config') {
      setMsg({ type: 'err', text: 'API 키와 재생목록을 모두 입력하세요.' })
    } else {
      setMsg({ type: 'err', text: `불러오기 실패: ${result.reason}` })
    }
  }

  function clearSongs() {
    setSongs([])
    setSongsSource('')
    setSongList([])
    setMsg({ type: 'ok', text: '곡 목록을 비웠어요.' })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => go('home')}
          className="text-neutral-400 hover:text-neutral-100"
        >
          ← 뒤로
        </button>
        <h2 className="text-2xl font-bold">설정</h2>
      </div>

      <p className="text-sm text-neutral-400 bg-neutral-900 rounded-xl p-3 leading-relaxed">
        💡 API 키와 재생목록은 프로젝트의{' '}
        <code className="text-neutral-200">.env.local</code> 파일에 적어두면
        자동으로 채워져요. 아래에 직접 입력하면 이 브라우저에만 저장되고 파일
        값보다 우선합니다.
        {hasEnvConfig && (
          <span className="block mt-1 text-emerald-400">
            ✓ 설정 파일(.env.local)에서 값을 읽었어요.
          </span>
        )}
      </p>

      <label className="flex flex-col gap-2">
        <span className="font-medium">YouTube Data API 키</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza..."
          className="px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-700 focus:border-violet-500 outline-none"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-medium">재생목록 URL 또는 ID</span>
        <input
          type="text"
          value={playlist}
          onChange={(e) => setPlaylist(e.target.value)}
          placeholder="https://www.youtube.com/playlist?list=PL..."
          className="px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-700 focus:border-violet-500 outline-none"
        />
      </label>

      <button
        onClick={load}
        disabled={!apiKey.trim() || !playlist.trim() || library.loading}
        className="py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-semibold transition"
      >
        {library.loading ? '불러오는 중…' : '곡 불러오기 / 새로고침'}
      </button>

      {msg && (
        <p className={msg.type === 'err' ? 'text-red-400' : 'text-emerald-400'}>
          {msg.text}
        </p>
      )}

      {songs.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">불러온 곡 {songs.length}곡</span>
            <button
              onClick={clearSongs}
              className="text-sm text-red-400 hover:text-red-300"
            >
              비우기
            </button>
          </div>
          <ul className="max-h-60 overflow-y-auto text-sm text-neutral-400 bg-neutral-900 rounded-xl p-3 space-y-1">
            {songs.map((s, i) => (
              <li key={s.id} className="truncate">
                {i + 1}. {s.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
