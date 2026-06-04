import { useState } from 'react'
import Home from './screens/Home'
import ModeSelect from './screens/ModeSelect'
import Settings from './screens/Settings'
import SongGame from './screens/SongGame'
import BattleGame from './screens/BattleGame'
import ImageSetup from './screens/ImageSetup'
import ImageBattleGame from './screens/ImageBattleGame'
import TeamSetup from './screens/TeamSetup'
import TournamentSetup from './screens/TournamentSetup'
import TournamentGame from './screens/TournamentGame'
import { useSongLibrary } from './hooks/useSongLibrary'

function App() {
  const [screen, setScreen] = useState('home')
  const [gameOptions, setGameOptions] = useState({ mode: 'single', rounds: 10 })
  const library = useSongLibrary()

  function go(target, options) {
    if (options) setGameOptions((prev) => ({ ...prev, ...options }))
    setScreen(target)
  }

  return (
    <div className="min-h-full bg-neutral-950 text-neutral-100 flex flex-col items-center">
      <div className="w-full max-w-2xl px-6 py-8 flex-1 flex flex-col">
        {screen === 'home' && <Home go={go} library={library} />}
        {screen === 'modeselect' && <ModeSelect go={go} />}
        {screen === 'settings' && <Settings go={go} library={library} />}
        {screen === 'song' && <SongGame go={go} options={gameOptions} />}
        {screen === 'battle' && <BattleGame go={go} options={gameOptions} />}
        {screen === 'imagesetup' && <ImageSetup go={go} />}
        {screen === 'imagebattle' && <ImageBattleGame go={go} options={gameOptions} />}
        {screen === 'teamsetup' && <TeamSetup go={go} />}
        {screen === 'tournamentsetup' && <TournamentSetup go={go} options={gameOptions} />}
        {screen === 'tournament' && <TournamentGame go={go} options={gameOptions} />}
      </div>
    </div>
  )
}

export default App
