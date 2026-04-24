/** Contact for GDPR / privacy requests (override via REACT_APP_PRIVACY_CONTACT_EMAIL). */
export function getPrivacyContactEmail() {
  const raw = process.env.REACT_APP_PRIVACY_CONTACT_EMAIL
  const s = typeof raw === 'string' ? raw.trim() : ''
  return s || 'privacy@treasury.app'
}
