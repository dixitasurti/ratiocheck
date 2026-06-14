import { useState, useRef, useCallback } from 'react'
import './App.css'

interface AnalysisResult {
  survival_score: number
  survival_rationale: string
  who_loves: { audience: string; reason: string }
  who_hates: { audience: string; reason: string }
  who_cancels: { audience: string; angle: string }
  rewrites: Array<{ title: string; content: string }>
  image_description?: string
}

interface HistoryItem {
  id: string
  result: AnalysisResult
  label: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function scoreColor(score: number): string {
  if (score <= 30) return '#ef4444'
  if (score <= 55) return '#f97316'
  if (score <= 75) return '#eab308'
  return '#10b981'
}

function scoreVerdict(score: number): string {
  if (score <= 15) return 'Dead on arrival'
  if (score <= 30) return "Getting ratio'd instantly"
  if (score <= 45) return 'High risk of backlash'
  if (score <= 60) return 'Controversial but survivable'
  if (score <= 75) return 'Probably fine'
  if (score <= 88) return 'The internet will approve'
  return 'Universally loved'
}

function canvasWrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth) {
      if (line) lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function generateShareCard(result: AnalysisResult): string {
  const canvas = document.createElement('canvas')
  const W = 1080, H = 1080
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const color = scoreColor(result.survival_score)
  const font = '"Helvetica Neue", Helvetica, Arial, sans-serif'

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0f0f1e')
  bg.addColorStop(1, '#080812')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Accent bar
  const bar = ctx.createLinearGradient(0, 0, W, 0)
  bar.addColorStop(0, 'rgba(124,106,248,0.9)')
  bar.addColorStop(0.5, 'rgba(167,139,250,0.9)')
  bar.addColorStop(1, 'rgba(96,165,250,0.9)')
  ctx.fillStyle = bar
  ctx.fillRect(0, 0, W, 7)

  // Logo
  ctx.textAlign = 'center'
  ctx.font = `bold 44px ${font}`
  ctx.fillStyle = '#b49aff'
  ctx.fillText('RatioCheck', W / 2, 84)

  // Score ring
  const cx = W / 2, cy = 360, r = 168
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, 2 * Math.PI)
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 18
  ctx.stroke()

  if (result.survival_score > 0) {
    const startA = -Math.PI / 2
    const endA = startA + (result.survival_score / 100) * 2 * Math.PI
    ctx.beginPath()
    ctx.arc(cx, cy, r, startA, endA)
    ctx.strokeStyle = color
    ctx.lineWidth = 18
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // Score number
  ctx.fillStyle = color
  ctx.font = `bold 128px ${font}`
  ctx.fillText(String(result.survival_score), cx, cy + 44)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = `36px ${font}`
  ctx.fillText('/100', cx, cy + 92)

  // Verdict
  ctx.font = `bold 50px ${font}`
  ctx.fillStyle = color
  ctx.fillText(scoreVerdict(result.survival_score), cx, 598)

  // Rationale (up to 2 lines)
  ctx.font = `28px ${font}`
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  const rLines = canvasWrap(ctx, result.survival_rationale, W - 160)
  rLines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, cx, 648 + i * 38))

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(80, 730)
  ctx.lineTo(W - 80, 730)
  ctx.stroke()

  // Sentiment rows
  const rows = [
    { dot: '#10b981', label: 'Loves it:', text: result.who_loves.audience },
    { dot: '#ef4444', label: 'Hates it:', text: result.who_hates.audience },
    { dot: '#f97316', label: 'Cancels it:', text: result.who_cancels.audience },
  ]
  ctx.textAlign = 'left'
  rows.forEach((row, i) => {
    const y = 800 + i * 70
    ctx.beginPath()
    ctx.arc(90, y - 8, 9, 0, 2 * Math.PI)
    ctx.fillStyle = row.dot
    ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `26px ${font}`
    ctx.fillText(row.label, 114, y)
    const labelW = ctx.measureText(row.label).width

    ctx.fillStyle = '#e8e8f4'
    ctx.font = `26px ${font}`
    const avail = W - 200 - labelW
    let txt = row.text
    while (txt.length > 4 && ctx.measureText(txt).width > avail) txt = txt.slice(0, -1)
    if (txt !== row.text) txt += '…'
    ctx.fillText(txt, 114 + labelW + 8, y)
  })

  // Footer
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = `26px ${font}`
  ctx.fillText('ratiocheck.app', W / 2, H - 44)

  return canvas.toDataURL('image/png')
}

function ScoreRing({ score, animated }: { score: number; animated: number }) {
  const r = 72
  const circ = 2 * Math.PI * r
  const offset = circ - (animated / 100) * circ
  const color = scoreColor(score)
  return (
    <div className="score-ring-wrap">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <circle
          cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 90 90)"
          style={{ transition: 'stroke-dashoffset 0.04s linear' }}
          filter="url(#glow)"
        />
      </svg>
      <div className="score-center">
        <span className="score-val" style={{ color }}>{animated}</span>
        <span className="score-denom">/100</span>
      </div>
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState<'text' | 'image' | 'url'>('text')
  const [textInput, setTextInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [fetchedContent, setFetchedContent] = useState<string | null>(null)
  const [fetchedAuthor, setFetchedAuthor] = useState<string | null>(null)
  const [isFetchingUrl, setIsFetchingUrl] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [animatedScore, setAnimatedScore] = useState(0)
  const [showDesc, setShowDesc] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [shareDataUrl, setShareDataUrl] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return }
    setImageFile(file)
    setError(null)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageFile(file)
  }

  const animateScore = (target: number) => {
    const duration = 1400
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setAnimatedScore(Math.round((1 - Math.pow(1 - t, 3)) * target))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return
    setIsFetchingUrl(true)
    setError(null)
    setFetchedContent(null)
    setFetchedAuthor(null)
    try {
      const res = await fetch(`${API_URL}/fetch-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not fetch tweet')
      setFetchedContent(data.content)
      setFetchedAuthor(data.author)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch URL')
    } finally {
      setIsFetchingUrl(false)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)
    setResults(null)
    setAnimatedScore(0)
    setShowDesc(false)

    try {
      let response: Response
      let historyLabel = ''

      if (mode === 'text') {
        if (!textInput.trim()) throw new Error('Please enter some content')
        historyLabel = textInput.slice(0, 38) + (textInput.length > 38 ? '…' : '')
        response = await fetch(`${API_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: textInput.trim() }),
        })
      } else if (mode === 'image') {
        if (!imageFile) throw new Error('Please upload an image')
        historyLabel = '📸 Image'
        const fd = new FormData()
        fd.append('file', imageFile)
        response = await fetch(`${API_URL}/analyze`, { method: 'POST', body: fd })
      } else {
        if (!fetchedContent) throw new Error('Please fetch a tweet first')
        historyLabel = '🔗 ' + fetchedContent.slice(0, 32) + '…'
        response = await fetch(`${API_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: fetchedContent }),
        })
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }))
        throw new Error(err.detail || 'Analysis failed')
      }

      const data: AnalysisResult = await response.json()
      setResults(data)
      animateScore(data.survival_score)
      setHistory(prev => [{ id: Date.now().toString(), result: data, label: historyLabel }, ...prev].slice(0, 5))
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Is the backend running?')
    } finally {
      setIsLoading(false)
    }
  }

  const handleHistorySelect = (item: HistoryItem) => {
    setResults(item.result)
    setAnimatedScore(item.result.survival_score)
    setError(null)
    setShowDesc(false)
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const handleReset = () => {
    setResults(null)
    setAnimatedScore(0)
    setError(null)
    setShowDesc(false)
    if (mode === 'image') { setImageFile(null); setImagePreview(null) }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCopy = async (content: string, idx: number) => {
    await navigator.clipboard.writeText(content)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const handleShare = () => {
    if (!results) return
    setShareDataUrl(generateShareCard(results))
  }

  const isSubmitDisabled = isLoading || (
    mode === 'text' ? !textInput.trim() :
    mode === 'image' ? !imageFile :
    !fetchedContent
  )

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">📊</span>
            <span className="logo-text">RatioCheck</span>
          </div>
          <p className="tagline">Will the internet cancel you? Find out before they do.</p>
        </div>
      </header>

      <main className="main">
        {/* History strip */}
        {history.length > 0 && (
          <div className="history-strip">
            <span className="history-label">Recent:</span>
            <div className="history-chips">
              {history.map(item => (
                <button key={item.id} className="history-chip" onClick={() => handleHistorySelect(item)}>
                  <span className="chip-score" style={{ color: scoreColor(item.result.survival_score) }}>
                    {item.result.survival_score}
                  </span>
                  <span className="chip-label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!results ? (
          <div className="input-section">
            {/* Mode toggle */}
            <div className="mode-toggle">
              <button className={`mode-btn ${mode === 'text' ? 'active' : ''}`}
                onClick={() => { setMode('text'); setError(null) }}>
                ✏️ Paste Text
              </button>
              <button className={`mode-btn ${mode === 'image' ? 'active' : ''}`}
                onClick={() => { setMode('image'); setError(null) }}>
                🖼️ Upload Image
              </button>
              <button className={`mode-btn ${mode === 'url' ? 'active' : ''}`}
                onClick={() => { setMode('url'); setError(null) }}>
                🔗 Tweet URL
              </button>
            </div>

            {/* Text input */}
            {mode === 'text' && (
              <div className="text-input-wrapper">
                <textarea className="text-input"
                  placeholder="Paste your tweet, caption, hot take, opinion, or anything you want to check before you post..."
                  value={textInput} onChange={e => setTextInput(e.target.value)} rows={7} />
                <div className="char-count">{textInput.length} chars</div>
              </div>
            )}

            {/* Image drop zone */}
            {mode === 'image' && (
              <div
                className={`dropzone${isDragging ? ' dragging' : ''}${imagePreview ? ' has-image' : ''}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !imagePreview && fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="image-preview-wrap">
                    <img src={imagePreview} alt="Preview" className="image-preview" />
                    <button className="remove-btn" onClick={e => {
                      e.stopPropagation(); setImageFile(null); setImagePreview(null)
                    }}>✕ Remove</button>
                  </div>
                ) : (
                  <>
                    <span className="dropzone-icon">📸</span>
                    <p className="dropzone-text">Drag & drop a screenshot or image</p>
                    <p className="dropzone-sub">or click to browse</p>
                    <p className="dropzone-hint">JPG · PNG · GIF · WebP</p>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }} />
              </div>
            )}

            {/* URL input */}
            {mode === 'url' && (
              <div className="url-section">
                <div className="url-row">
                  <input type="url" className="url-input"
                    placeholder="https://twitter.com/user/status/..."
                    value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setFetchedContent(null); setFetchedAuthor(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') handleFetchUrl() }}
                  />
                  <button className="fetch-btn" onClick={handleFetchUrl}
                    disabled={!urlInput.trim() || isFetchingUrl}>
                    {isFetchingUrl ? <span className="spinner" /> : 'Fetch'}
                  </button>
                </div>
                {fetchedContent && (
                  <div className="fetched-preview">
                    {fetchedAuthor && <div className="fetched-author">@{fetchedAuthor}</div>}
                    <p className="fetched-text">"{fetchedContent}"</p>
                    <button className="clear-fetched" onClick={() => { setFetchedContent(null); setFetchedAuthor(null) }}>
                      ✕ Clear
                    </button>
                  </div>
                )}
                {!fetchedContent && !isFetchingUrl && (
                  <p className="url-hint">Paste a Twitter or X post URL and click Fetch to extract the tweet text.</p>
                )}
              </div>
            )}

            {error && <div className="error-msg">⚠️ {error}</div>}

            <button className="submit-btn" onClick={handleSubmit} disabled={isSubmitDisabled}>
              {isLoading ? (
                <span className="loading-inner"><span className="spinner" />Analyzing...</span>
              ) : '🔍 Check My Ratio'}
            </button>
          </div>
        ) : (
          <div className="results" ref={resultsRef}>
            {/* Score block */}
            <div className="score-block">
              <ScoreRing score={results.survival_score} animated={animatedScore} />
              <div className="score-info">
                <div className="score-verdict" style={{ color: scoreColor(results.survival_score) }}>
                  {scoreVerdict(results.survival_score)}
                </div>
                <p className="score-why">{results.survival_rationale}</p>
                {results.image_description && (
                  <>
                    <div className="image-desc-toggle" onClick={() => setShowDesc(v => !v)}>
                      {showDesc ? '▾' : '▸'} What Claude saw in the image
                    </div>
                    {showDesc && <div className="image-desc-text">{results.image_description}</div>}
                  </>
                )}
              </div>
            </div>

            {/* Sentiment cards */}
            <div className="sentiment-cards">
              <div className="sent-card love">
                <div className="sent-header"><span className="sent-icon">💚</span><span className="sent-label">Who Will Love It</span></div>
                <div className="sent-audience">{results.who_loves.audience}</div>
                <p className="sent-reason">{results.who_loves.reason}</p>
              </div>
              <div className="sent-card hate">
                <div className="sent-header"><span className="sent-icon">🔴</span><span className="sent-label">Who Will Hate It</span></div>
                <div className="sent-audience">{results.who_hates.audience}</div>
                <p className="sent-reason">{results.who_hates.reason}</p>
              </div>
              <div className="sent-card cancel">
                <div className="sent-header"><span className="sent-icon">🚫</span><span className="sent-label">Who Will Cancel It</span></div>
                <div className="sent-audience">{results.who_cancels.audience}</div>
                <p className="sent-reason">{results.who_cancels.angle}</p>
              </div>
            </div>

            {/* Rewrites with copy buttons */}
            <div className="rewrites-section">
              <h2 className="rewrites-heading">📝 Safer Versions</h2>
              <p className="rewrites-sub">Same idea, less drama</p>
              <div className="rewrites-grid">
                {results.rewrites.map((r, i) => (
                  <div key={i} className="rewrite-card">
                    <div className="rewrite-num">{i + 1}</div>
                    <h4 className="rewrite-title">{r.title}</h4>
                    <p className="rewrite-content">{r.content}</p>
                    <button
                      className={`copy-btn ${copiedIdx === i ? 'copied' : ''}`}
                      onClick={() => handleCopy(r.content, i)}
                    >
                      {copiedIdx === i ? '✓ Copied!' : '⎘ Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="result-actions">
              <button className="share-btn" onClick={handleShare}>
                🎴 Share My Score
              </button>
              <button className="again-btn" onClick={handleReset}>
                🔄 Analyze Something Else
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        RatioCheck — Video and audio analysis coming soon
      </footer>

      {/* Share card modal */}
      {shareDataUrl && (
        <div className="share-overlay" onClick={() => setShareDataUrl(null)}>
          <div className="share-modal" onClick={e => e.stopPropagation()}>
            <h3 className="share-modal-title">Your RatioCheck Card</h3>
            <img src={shareDataUrl} alt="Share card" className="share-preview" />
            <div className="share-modal-actions">
              <a href={shareDataUrl} download="ratiocheck-score.png" className="download-btn">
                ↓ Save PNG
              </a>
              <button className="share-close-btn" onClick={() => setShareDataUrl(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
