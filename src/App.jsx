import { useState } from 'react'
import Home from './screens/Home'
import Settings from './screens/Settings'
import SongGame from './screens/SongGame'
import { useSongLibrary } from './hooks/useSongLibrary'

function App() {
  const [screen, setScreen] = useState('home')
  const library = useSongLibrary()

  return (
    <div className="min-h-full bg-neutral-950 text-neutral-100 flex flex-col items-center">
      <div className="w-full max-w-2xl px-6 py-8 flex-1 flex flex-col">
        {screen === 'home' && <Home go={setScreen} library={library} />}
        {screen === 'settings' && <Settings go={setScreen} library={library} />}
        {screen === 'song' && <SongGame go={setScreen} />}
      </div>
    </div>
  )
}

export default App
