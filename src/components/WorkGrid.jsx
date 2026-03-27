import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAuthStore, useDataStore, useUIStore } from '../store'
import { useDebounce } from '../hooks'

const catLabel = (c) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : '')

function WorkCard({ project, isAdmin, onDelete, onDragStart, onDrop, onClick }) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`wcard ${isAdmin ? 'edit-mode' : 'view'} ${dragOver ? 'drag-target' : ''} rv on`}
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
          <button className="w-drag vis">☰</button>
          <button className="w-del vis" onClick={e => { e.stopPropagation(); onDelete(project) }}>✕</button>
        </div>
      )}

      <div className="wm">
        {project.media_url ? (
          project.media_type === 'video' ? (
            <video key={project.id} src={project.media_url} muted loop playsInline preload="metadata" />
          ) : (
            <img key={project.id} src={project.media_url} alt={project.title} loading="lazy" />
          )
        ) : (
          <div className="wph">{project.emoji || '🎨'}</div>
        )}
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

export function WorkGrid({ onToast }) {
  const isAdmin = useAuthStore(s => s.isAdmin)
  const { projects, deleteProject, reorderProjects } = useDataStore()
  const { activeFilter, openModal } = useUIStore()

  // FIX: Gunakan useMemo agar filtering reaktif terhadap perubahan data Supabase & tombol klik
  const filtered = useMemo(() => {
    const list = projects || []
    if (!activeFilter || activeFilter === 'all') return list
    return list.filter(p => p.category === activeFilter)
  }, [projects, activeFilter])

  const [lightbox, setLightbox] = useState({ open: false, idx: 0 })
  const [dragFrom, setDragFrom] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const debouncedReorder = useDebounce(async (orderedIds) => {
    try {
      await reorderProjects(orderedIds)
      onToast?.('Urutan disimpan!', 'ok', '↕️')
    } catch (e) { onToast?.(e.message, 'err') }
  }, 400)

  const handleDrop = useCallback((toId) => {
    if (!dragFrom || dragFrom === toId) return
    const ids = filtered.map(p => p.id)
    const from = ids.indexOf(dragFrom)
    const to = ids.indexOf(toId)
    const reordered = [...ids]
    reordered.splice(from, 1)
    reordered.splice(to, 0, dragFrom)
    setDragFrom(null)
    debouncedReorder(reordered)
  }, [dragFrom, filtered, debouncedReorder])

  return (
    <>
      <div className="wgrid">
        {/* FIX: Map langsung dari 'filtered' agar re-render terpancing otomatis */}
        {filtered.map((p, i) => (
          <WorkCard
            key={p.id}
            project={p}
            isAdmin={isAdmin}
            onDelete={setConfirm}
            onDragStart={setDragFrom}
            onDrop={handleDrop}
            onClick={() => setLightbox({ open: true, idx: i })}
          />
        ))}

        {/* Jika kosong dan bukan admin, tampilkan pesan kosong agar UI tidak 'patah' */}
        {filtered.length === 0 && !isAdmin && (
          <div className="wgrid-empty" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
             <p>Belum ada karya di kategori ini.</p>
          </div>
        )}

        {isAdmin && (
          <div className="wadd" onClick={() => openModal('upload')}>
            <div className="wadd-c">+</div>
            <span className="wadd-l">Tambah Karya</span>
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
            <div className="ci">🗑️</div>
            <div className="ct">Hapus Karya?</div>
            <div className="cr">
              <button className="btn-c" onClick={() => setConfirm(null)}>Batal</button>
              <button className="btn-d" onClick={async () => {
                try {
                  await deleteProject(confirm.id)
                  onToast?.('Karya dihapus.', '', '🗑️')
                } catch (e) { onToast?.(e.message, 'err') }
                finally { setConfirm(null) }
              }}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

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
      <button className="lb-close" onClick={onClose}>✕</button>
      <div className="lb-content">
        {p.media_type === 'video' ? (
          <video src={p.media_url} controls autoPlay style={{ maxHeight: '80vh' }} />
        ) : (
          <img src={p.media_url} alt={p.title} style={{ maxHeight: '80vh' }} />
        )}
        <div className="lb-info">
          <div className="lb-title">{p.title}</div>
          <div className="lb-sub">{catLabel(p.category)}</div>
        </div>
      </div>
    </div>
  )
}