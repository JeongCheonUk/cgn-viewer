import { useEffect } from 'react'
import ViewerPage from './pages/viewer/ViewerPage'
import './styles/index.css'

function App() {
  useEffect(() => {
    if (window.location.pathname === '/viewer') {
      window.history.replaceState(null, '', '/')
    }
  }, [])

  return <ViewerPage />
}

export default App
