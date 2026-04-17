import { render, screen } from '@testing-library/react'
import App from './App'

test('shows sign in for unauthenticated users', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: /^sign in$/i })).toBeInTheDocument()
})
