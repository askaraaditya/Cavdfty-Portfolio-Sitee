import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAuthStore, useDataStore, useUIStore } from '../store'
import { useDebounce } from '../hooks'

/* ── WorkCard — Professional Adaptive Grid ────────────────── */
function WorkCard({ project, isAdmin, onDelete, onDragStart, onDrop, onClick }) {
  const [dragOver, setDragOver] = useState(false)
  const [imgRatio, setImgRatio] = useState(null)

  const handleLoad = useCallback((e) => {
    const { naturalWidth: w, naturalHeight: h } = e.target
    if (w && h) setImgRatio(h / w)
  }, [])

  const handleVideoLoad = useCallback((e) => {
    const { videoWidth: w, videoHeight: h } = e.target
    if (w && h) setImgRatio(h / w)
    else setImgRatio(9/16)
  }, [])

  const ratioStyle = imgRatio
    ? { paddingTop: `${imgRatio * 100}%`, height: 0 }
    : { paddingTop: '75%', height: 0 } 

  return (
    <div
      className={`wcard ${isAdmin ? 'edit-mode' : 'view'} ${dragOver ? 'drag-target' : ''} rv`}
      draggable={isAdmin}
      onDragStart={() => onDragStart(project.id)}
      onDragEnd={() => setDragOver(false)}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(project.id) }}
      onClick={e => {
        if (e.target.closest('.w-del,.w-drag')) return
        if (!isAdmin) onClick(project)
      }}
    >
      {isAdmin && (
        <div className="w-controls">
          <button className="w-drag vis" title="Geser untuk urutan">☰</button>
          <button className="w-del vis" onClick={e => { e.stopPropagation(); onDelete(project) }}>✕</button>
        </div>
      )}

      <div className="wm" style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
        <div style={ratioStyle} />
        <div style={{ position:'absolute', inset:0 }}>
          {project.media_url ? (
            project.media_type === 'video'
              ? <video
                  src={project.media_url}
                  muted loop playsInline preload="metadata"
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onLoadedMetadata={handleVideoLoad}
                />
              : <img
                  src={project.media_url}
                  alt={project.title}
                  loading="lazy"
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onLoad={handleLoad}
                />
          ) : (
            <div className="wph">{project.emoji || '🎨'}</div>
          )}
        </div>
        <div className="wov">
          <div>
            <div className="wov-t">{project.title}</div>
            <div className="wov-c">{catLabel(project.category)}</div>
          </div>
        </div>
      </div>

      <div className="wmeta">
        <div className="wmt">{project.title}</div>
        <span className="wmb">{catLabel(project.category)}</span>
      </div>
    </div>
  )
}

/* ── WorkGrid — Fixed Auto-Reveal Logic ─────────────────── */
export function WorkGrid({ onToast }) {
  const isAdmin    = useAuthStore(s => s.isAdmin)
  const { projects, deleteProject, reorderProjects } = useDataStore()
  const { activeFilter, openModal } = useUIStore()
  
  const [lightbox, setLightbox] = useState({ open: false, idx: 0 })
  const [dragFrom, setDragFrom] = useState(null)
  const [confirm,  setConfirm]  = useState(null)

  // FIX: Memastikan filtering terjadi secara reaktif di dalam komponen
  const filtered = useMemo(() => {
    if (!projects) return []
    if (activeFilter === 'all') return projects
    return projects.filter(p => p.category === activeFilter)
  }, [projects, activeFilter])

  const debouncedPersist = useDebounce(async (newOrder) => {
    try { await reorderProjects(newOrder) }
    catch (e) { onToast?.(e.message, 'err') }
  }, 400)

  const handleDrop = useCallback((toId) => {
    if (!dragFrom || dragFrom === toId) return
    const ids = filtered.map(p => p.id)
    const from = ids.indexOf(dragFrom)
    const to = ids.indexOf(toId)
    const next = [...ids]
    next.splice(from, 1); next.splice(to, 0, dragFrom)
    const newOrder = next.map((id, i) => ({ id, order_index: i }))
    setDragFrom(null)
    debouncedPersist(newOrder)
  }, [dragFrom, filtered, debouncedPersist])

  const doDelete = useCallback(async () => {
    if (!confirm) return
    try {
      await deleteProject(confirm.id)
      onToast?.('Karya berhasil dihapus', '', '🗑️')
    } catch (e) {
      onToast?.(e.message, 'err')
    } finally { setConfirm(null) }
  }, [confirm, deleteProject, onToast])

  return (
    <>
      <div className="wgrid">
        {!filtered.length && !isAdmin ? (
          <div className="wgrid-empty" style={{ gridColumn: '1/-1', padding: '100px 0' }}>
            <div style={{ fontSize:48 }}>🎨</div>
            <p>Belum ada karya untuk kategori ini.</p>
          </div>
        ) : (
          filtered.map((p, i) => (
            <WorkCard
              key={p.id}
              project={p}
              isAdmin={isAdmin}
              onDelete={setConfirm}
              onDragStart={setDragFrom}
              onDrop={handleDrop}
              onClick={() => setLightbox({ open: true, idx: i })}
            />
          ))
        )}

        {isAdmin && (
          <div className="wadd" onClick={() => openModal('upload')}>
            <div className="wadd-c">+</div>
            <span className="wadd-l">Tambah Karya Baru</span>
          </div>
        )}
      </div>

      {lightbox.open && (
        <Lightbox
          items={filtered}
          initialIdx={lightbox.idx}
          onClose={() => setLightbox({ open: false, idx: 0 })}
        />
      )}

      {confirm && (
        <div className="mov open" onClick={e => e.target === e.currentTarget && setConfirm(null)}>
          <div className="mb">
            <h3>Hapus Karya?</h3>
            <p>"{confirm.title}" akan dihapus permanen.</p>
            <div className="cr">
              <button className="btn-c" onClick={() => setConfirm(null)}>Batal</button>
              <button className="btn-d" onClick={doDelete}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Filters — Responsive & Realtime ────────────────────── */
export function WorkFilters() {
  const activeFilter = useUIStore(s => s.activeFilter)
  const setFilter    = useUIStore(s => s.setFilter)
  const projects     = useDataStore(s => s.projects) || []

  const counts = useMemo(() => ({
    all: projects.length,
    design: projects.filter(p => p.category === 'design').length,
    photo: projects.filter(p => p.category === 'photo').length,
    video: projects.filter(p => p.category === 'video').length,
  }), [projects])

  return (
    <div className="filters rv on"> {/* Tambahkan class 'on' agar langsung muncul */}
      {['all','design','photo','video'].map(f => (
        <button
          key={f}
          className={`fb ${activeFilter === f ? 'active' : ''}`}
          onClick={() => setFilter(f)}
        >
          {f.charAt(0).toUpperCase() + f.slice(1)}
          {counts[f] > 0 && <span className="fb-count">{counts[f]}</span>}
        </button>
      ))}
    </div>
  )
}

/* ── Lightbox — Professional Gallery ─────────────────────── */
function Lightbox({ items, initialIdx, onClose }) {
  const [idx, setIdx] = useState(initialIdx)
  const p = items[idx]

  useEffect(() => {
    const fn = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + items.length) % items.length)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % items.length)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [items.length, onClose])

  if (!p) return null

  return (
    <div className="lb open" onClick={e => e.target === e.currentTarget && onClose()}>
      <button className="lb-btn lb-x" onClick={onClose}>✕</button>
      <div className="lb-ctr">{idx + 1} / {items.length}</div>
      <div className="lb-in">
        {p.media_url ? (
          p.media_type === 'video' 
            ? <video src={p.media_url} controls autoPlay style={{ maxHeight:'80vh', maxWidth:'90vw' }} />
            : <img src={p.media_url} alt={p.title} style={{ maxHeight:'80vh', maxWidth:'90vw' }} />
        ) : <div style={{ fontSize:100 }}>{p.emoji}</div>}
        <div className="lb-cap">
          <div className="lb-cap-t">{p.title}</div>
          <div className="lb-cap-s">{catLabel(p.category)} {p.description && `· ${p.description}`}</div>
        </div>
      </div>
    </div>
  )
}

function catLabel(c) { return c ? c.charAt(0).toUpperCase() + c.slice(1) : '' }