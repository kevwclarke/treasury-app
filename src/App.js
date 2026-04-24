import { BrowserRouter } from 'react-router-dom'
import { NavigationShell } from './components/NavigationShell'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <NavigationShell />
    </BrowserRouter>
  )
}
