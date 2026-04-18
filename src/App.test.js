import { render, screen } from '@testing-library/react'
import App from './App'

test('shows landing page for unauthenticated users', async () => {
  render(<App />)
  expect(
    await screen.findByRole('heading', {
      name: /your cash is losing money/i,
    })
  ).toBeInTheDocument()
})
