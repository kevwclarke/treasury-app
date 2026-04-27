import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { ConnectBankModal } from '../components/ConnectBankModal'

const ConnectBankContext = createContext(null)

export function ConnectBankProvider({ children }) {
  const [open, setOpen] = useState(false)
  const openConnectBankModal = useCallback(() => setOpen(true), [])
  const closeConnectBankModal = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ openConnectBankModal, closeConnectBankModal }),
    [openConnectBankModal, closeConnectBankModal],
  )

  return (
    <ConnectBankContext.Provider value={value}>
      {children}
      <ConnectBankModal open={open} onClose={closeConnectBankModal} />
    </ConnectBankContext.Provider>
  )
}

export function useConnectBankModal() {
  const ctx = useContext(ConnectBankContext)
  if (!ctx) {
    throw new Error('useConnectBankModal must be used within ConnectBankProvider')
  }
  return ctx
}
