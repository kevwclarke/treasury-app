import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CSV_SOURCE_INSTITUTIONS } from '../constants/institutions'
import { supabase } from '../supabase'
import './UploadPage.css'

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"'
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && (ch === ',' || ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1
      row.push(cell)
      cell = ''
      if (ch === '\n' || ch === '\r') {
        rows.push(row)
        row = []
      }
      continue
    }

    cell += ch
  }

  row.push(cell)
  rows.push(row)

  // Trim trailing empty rows
  while (rows.length && rows[rows.length - 1].every((c) => String(c ?? '').trim() === '')) {
    rows.pop()
  }

  return rows
}

function normaliseHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
}

function scoreHeaderForField(header, field) {
  const h = normaliseHeader(header)
  if (!h) return 0

  const has = (s) => h.includes(s)

  if (field === 'date') {
    if (has('date') || has('posted') || has('value date') || has('transaction date')) return 10
    if (has('time') || has('timestamp')) return 6
    return 0
  }

  if (field === 'amount') {
    if (has('amount') || has('amt') || has('value')) return 10
    if (has('debit') || has('credit')) return 8
    if (has('paid') || has('received')) return 7
    return 0
  }

  if (field === 'description') {
    if (has('description') || has('details') || has('narrative')) return 10
    if (has('payee') || has('merchant') || has('counterparty')) return 10
    if (has('reference') || has('memo')) return 7
    return 0
  }

  if (field === 'balance') {
    if (has('balance') || has('running balance')) return 10
    if (has('available') && has('balance')) return 9
    return 0
  }

  return 0
}

function guessMapping(headers) {
  const pickBest = (field) => {
    let best = ''
    let bestScore = 0
    headers.forEach((h) => {
      const s = scoreHeaderForField(h, field)
      if (s > bestScore) {
        bestScore = s
        best = h
      }
    })
    return best
  }

  return {
    date: pickBest('date'),
    amount: pickBest('amount'),
    description: pickBest('description'),
    balance: pickBest('balance'),
  }
}

function isCsvFile(file) {
  const nameOk = /\.csv$/i.test(file?.name ?? '')
  const typeOk = file?.type ? file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' : true
  return Boolean(file) && nameOk && typeOk
}

function parseNumberLike(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null

  const negativeByParens = /^\(.*\)$/.test(s)
  const cleaned = s
    .replace(/[£,\s]/g, '')
    .replace(/^\(/, '')
    .replace(/\)$/, '')
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n)) return null
  return negativeByParens ? -Math.abs(n) : n
}

function parseDateLike(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null

  const direct = new Date(s)
  if (!Number.isNaN(direct.getTime())) return direct.toISOString()

  // Common UK bank CSVs: DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+.*)?$/)
  if (m) {
    const dd = Number(m[1])
    const mm = Number(m[2])
    const yyyy = Number(m[3].length === 2 ? `20${m[3]}` : m[3])
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0))
    if (!Number.isNaN(dt.getTime())) return dt.toISOString()
  }

  return null
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Stable key: calendar day (UTC) + numeric amount + trimmed payee — matches duplicate CSV re-uploads. */
function transactionDedupeKey(dateIso, amount, payee) {
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return null
  const day = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
  const amt = Number(amount)
  if (!Number.isFinite(amt)) return null
  const p = String(payee ?? '').trim()
  return `${day}|${amt}|${p}`
}

export function UploadPage() {
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [dedupeSkipped, setDedupeSkipped] = useState(0)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [allRows, setAllRows] = useState([])
  const [mapping, setMapping] = useState({
    date: '',
    amount: '',
    description: '',
    balance: '',
  })
  const [importing, setImporting] = useState(false)
  const [importCelebration, setImportCelebration] = useState(false)
  const [uploadInstitution, setUploadInstitution] = useState('')

  const mappingComplete =
    Boolean(uploadInstitution) &&
    mapping.date &&
    mapping.amount &&
    mapping.description &&
    mapping.balance &&
    headers.length > 0

  const selected = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping])

  useEffect(() => {
    if (!importCelebration) return undefined
    const id = window.setTimeout(() => navigate('/app?treasuryReady=1', { replace: true }), 1700)
    return () => window.clearTimeout(id)
  }, [importCelebration, navigate])

  async function handleFile(file) {
    setError('')
    setImportCelebration(false)
    setFileName('')
    setHeaders([])
    setPreviewRows([])
    setAllRows([])
    setMapping({ date: '', amount: '', description: '', balance: '' })
    setUploadInstitution('')

    if (!file) return
    if (!isCsvFile(file)) {
      setError('Please upload a .csv file.')
      return
    }

    setFileName(file.name)

    const text = await file.text()
    const rows = parseCsv(text)
    if (!rows.length) {
      setError('That CSV looks empty.')
      return
    }

    const [rawHeaders, ...data] = rows
    const cleanedHeaders = rawHeaders.map((h, idx) => {
      const v = String(h ?? '').trim()
      return v || `Column ${idx + 1}`
    })

    const preview = data.slice(0, 5).map((r) => {
      const out = {}
      cleanedHeaders.forEach((h, idx) => {
        out[h] = r?.[idx] ?? ''
      })
      return out
    })

    const all = data.map((r) => {
      const out = {}
      cleanedHeaders.forEach((h, idx) => {
        out[h] = r?.[idx] ?? ''
      })
      return out
    })

    const guess = guessMapping(cleanedHeaders)

    setHeaders(cleanedHeaders)
    setPreviewRows(preview)
    setAllRows(all)
    setMapping({
      date: guess.date,
      amount: guess.amount,
      description: guess.description,
      balance: guess.balance,
    })
  }

  async function handleConfirmImport() {
    if (!mappingComplete || importing) return
    setError('')
    setDedupeSkipped(0)
    setImportCelebration(false)
    setImporting(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Not authenticated.')

      const txs = allRows
        .map((raw) => {
          const dateIso = parseDateLike(raw[mapping.date])
          const amount = parseNumberLike(raw[mapping.amount])
          const balance = parseNumberLike(raw[mapping.balance])
          const payee = String(raw[mapping.description] ?? '').trim()
          if (!dateIso || amount === null) return null

          const id = window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `tx_${Date.now()}_${Math.random().toString(16).slice(2)}`

          return {
            id,
            user_id: user.id,
            date: dateIso,
            amount,
            payee,
            balance,
            running_balance: balance,
            institution: uploadInstitution,
            raw_data: raw,
          }
        })
        .filter(Boolean)

      if (!txs.length) {
        setError('No importable rows found. Check your column mapping and CSV formatting.')
        return
      }

      const seenInUpload = new Set()
      const toInsert = []
      for (const tx of txs) {
        const k = transactionDedupeKey(tx.date, tx.amount, tx.payee)
        if (!k || seenInUpload.has(k)) continue
        seenInUpload.add(k)
        toInsert.push(tx)
      }

      let insertedCount = 0
      for (const batch of chunk(toInsert, 500)) {
        const { data, error: writeError } = await supabase
          .from('transactions')
          .upsert(batch, { onConflict: 'user_id,date,amount,payee', ignoreDuplicates: true })
          .select('id')
        if (writeError) {
          if ((writeError?.message ?? '').toLowerCase().includes('relation') &&
              (writeError?.message ?? '').toLowerCase().includes('does not exist')) {
            throw new Error(
              "Supabase table 'transactions' does not exist yet. Apply the SQL migration in `supabase/migrations/` to create it, then retry."
            )
          }
          throw writeError
        }
        insertedCount += Array.isArray(data) ? data.length : 0
      }

      setDedupeSkipped(Math.max(0, toInsert.length - insertedCount))

      if (toInsert.length > 0) {
        const { data: prof, error: profErr } = await supabase
          .from('company_profiles')
          .select('first_data_upload_at, company_name, funding_stage')
          .eq('user_id', user.id)
          .maybeSingle()

        if (profErr) {
          console.warn('Could not read company_profiles for first_data_upload_at:', profErr)
        } else if (prof && !prof.first_data_upload_at) {
          const { error: upsertErr } = await supabase.from('company_profiles').upsert(
            {
              user_id: user.id,
              company_name: prof.company_name,
              funding_stage: prof.funding_stage,
              first_data_upload_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )
          if (upsertErr) {
            const msg = String(upsertErr.message ?? '').toLowerCase()
            if (!msg.includes('first_data_upload_at') && !msg.includes('column')) {
              console.warn('Could not set first_data_upload_at:', upsertErr)
            }
          }
        }
      }

      setImportCelebration(true)
    } catch (e) {
      setError(e?.message ?? 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <div className={`upload${importCelebration ? ' upload--celebrating' : ''}`}>
      <h1 className="upload__title">Upload Bank Statement</h1>
      <p className="upload__sub">
        Import a CSV export from your bank to power all modules. Supported banks: Barclays, HSBC, Starling, Monzo,
        NatWest and more.
      </p>

      <section className="upload__sample" aria-label="Sample bank statement">
        <a className="upload__sample-btn" href={`${process.env.PUBLIC_URL || ''}/sample-demo.csv`} download="nexus-software-demo-barclays.csv">
          Download sample bank statement
        </a>
        <p className="upload__sample-hint">
          A realistic 6-month Barclays statement for Nexus Software Ltd — use this to explore the product before
          uploading your own data.
        </p>
      </section>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div
        className={`upload__zone${dragActive ? ' upload__zone--active' : ''}`}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') openPicker()
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        aria-label="CSV upload dropzone"
      >
        <p className="upload__zone-text">Drop your bank CSV here or click to browse</p>
        <p className="upload__zone-hint">Accepted: .csv only</p>
      </div>

      {error ? <div className="upload__error">{error}</div> : null}

      {importCelebration ? (
        <div className="upload__celebrate" role="status" aria-live="polite">
          <div className="upload__celebrate-card">
            <div className="upload__celebrate-check" aria-hidden>
              <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
                <circle className="upload__celebrate-ring" cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" />
                <path
                  className="upload__celebrate-tick"
                  d="M14 24.5l7 7 13-14"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="upload__celebrate-title">Import complete</p>
            <p className="upload__celebrate-sub">Taking you to Treasury Autopilot…</p>
            {dedupeSkipped > 0 ? (
              <p
                style={{
                  margin: '0.65rem 0 0',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 13,
                  fontWeight: 400,
                  color: '#6B7280',
                  lineHeight: 1.5,
                }}
              >
                {dedupeSkipped.toLocaleString('en-GB')} duplicate transactions were skipped.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {headers.length ? (
        <>
          <section className="upload__card" aria-label="CSV preview">
            <div className="upload__card-head">
              <h2 className="upload__card-title">Preview (first 5 rows)</h2>
              <span className="upload__file-meta">{fileName}</span>
            </div>
            <div className="upload__table-wrap">
              <table className="upload__table">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, idx) => (
                    <tr key={idx}>
                      {headers.map((h) => (
                        <td key={h}>{String(r[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="upload__card" aria-label="Column mapping">
            <div className="upload__card-head">
              <h2 className="upload__card-title">Column mapping</h2>
              <span className="upload__file-meta">Auto-detected · editable</span>
            </div>

            <div className="upload__map-grid">
              <div className="upload__field" style={{ gridColumn: '1 / -1' }}>
                <span className="upload__label">Bank this CSV is from</span>
                <select
                  className="upload__select"
                  value={uploadInstitution}
                  onChange={(e) => setUploadInstitution(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Select bank…</option>
                  {CSV_SOURCE_INSTITUTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="upload__zone-hint" style={{ marginTop: '0.35rem' }}>
                  All rows in this file are treated as this account — payee names are not used for concentration.
                </p>
              </div>

              <div className="upload__field">
                <span className="upload__label">Transaction Date</span>
                <select
                  className="upload__select"
                  value={mapping.date}
                  onChange={(e) => setMapping((m) => ({ ...m, date: e.target.value }))}
                >
                  <option value="">Select column…</option>
                  {headers.map((h) => (
                    <option key={h} value={h} disabled={selected.has(h) && mapping.date !== h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="upload__field">
                <span className="upload__label">Amount</span>
                <select
                  className="upload__select"
                  value={mapping.amount}
                  onChange={(e) => setMapping((m) => ({ ...m, amount: e.target.value }))}
                >
                  <option value="">Select column…</option>
                  {headers.map((h) => (
                    <option key={h} value={h} disabled={selected.has(h) && mapping.amount !== h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="upload__field">
                <span className="upload__label">Payee/Description</span>
                <select
                  className="upload__select"
                  value={mapping.description}
                  onChange={(e) => setMapping((m) => ({ ...m, description: e.target.value }))}
                >
                  <option value="">Select column…</option>
                  {headers.map((h) => (
                    <option
                      key={h}
                      value={h}
                      disabled={selected.has(h) && mapping.description !== h}
                    >
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="upload__field">
                <span className="upload__label">Running Balance</span>
                <select
                  className="upload__select"
                  value={mapping.balance}
                  onChange={(e) => setMapping((m) => ({ ...m, balance: e.target.value }))}
                >
                  <option value="">Select column…</option>
                  {headers.map((h) => (
                    <option key={h} value={h} disabled={selected.has(h) && mapping.balance !== h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="upload__confirm"
              disabled={!mappingComplete || importing}
              onClick={handleConfirmImport}
            >
              {importing ? 'Importing…' : 'Confirm and Import'}
            </button>
          </section>
        </>
      ) : null}
    </div>
  )
}

