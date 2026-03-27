// src/store/index.js
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { AuthService, ProjectService, SocialService, ContentService, PhotoService } from '../services/api'
import { supabase } from '../lib/supabase'

/* ── AUTH ──────────────────────────────────────────────────── */
export const useAuthStore = create(immer((set) => ({
  session: null, isAdmin: false, loading: true, error: null,

  init: async () => {
    const session = await AuthService.getSession()
    set(s => { s.session = session; s.isAdmin = !!session; s.loading = false })
    AuthService.onAuthChange((_, session) => {
      set(s => { s.session = session; s.isAdmin = !!session })
    })
  },

  signIn: async (email, password) => {
    set(s => { s.error = null })
    try {
      const { session } = await AuthService.signIn(email, password)
      set(s => { s.session = session; s.isAdmin = true })
      return true
    } catch (err) {
      set(s => { s.error = err.message })
      return false
    }
  },

  signOut: async () => {
    await AuthService.signOut()
    set(s => { s.session = null; s.isAdmin = false })
  },
})))

/* ── DATA ──────────────────────────────────────────────────── */
export const useDataStore = create(immer((set, get) => ({
  projects: [], socials: [], content: null,
  photos: { profile_url: null, school_url: null },
  loading: false,

  loadAll: async () => {
    set(s => { s.loading = true })
    const [projects, socials, content, photos] = await Promise.all([
      ProjectService.getAll(),
      SocialService.getAll(),
      ContentService.get(),
      PhotoService.get(),
    ])
    set(s => {
      s.projects = projects
      s.socials  = socials
      s.content  = content
      s.photos   = photos ?? { profile_url: null, school_url: null }
      s.loading  = false
    })
  },

  // ── REALTIME — single subscription setup, returns cleanup fn ──
  subscribeRealtime: () => {
    const pCh = ProjectService.subscribe((payload) => {
      const { eventType, new: row, old } = payload
      set(s => {
        if (eventType === 'INSERT') {
          // Avoid duplicates (optimistic update may already have added it)
          if (!s.projects.find(p => p.id === row.id)) {
            s.projects = [...s.projects, row].sort((a,b) => a.order_index - b.order_index)
          }
        } else if (eventType === 'UPDATE') {
          s.projects = s.projects.map(p => p.id === row.id ? row : p)
            .sort((a,b) => a.order_index - b.order_index)
        } else if (eventType === 'DELETE') {
          // This fires when another client deletes — removes from our state
          s.projects = s.projects.filter(p => p.id !== old.id)
        }
      })
    })

    const sCh = SocialService.subscribe(({ eventType, new: row, old }) => {
      set(s => {
        if (eventType === 'INSERT')      s.socials = [...s.socials, row]
        else if (eventType === 'UPDATE') s.socials = s.socials.map(x => x.id === row.id ? row : x)
        else if (eventType === 'DELETE') s.socials = s.socials.filter(x => x.id !== old.id)
      })
    })

    const cCh = ContentService.subscribe(({ new: row }) => {
      set(s => { s.content = row })
    })

    return () => {
      supabase.removeChannel(pCh)
      supabase.removeChannel(sCh)
      supabase.removeChannel(cCh)
    }
  },

  // ── PROJECTS ───────────────────────────────────────────────
  addProject: async (meta, file) => {
    if (!useAuthStore.getState().isAdmin) throw new Error('Unauthorized')
    const mediaUrl  = await ProjectService.uploadMedia(file)
    const mediaType = file.type.startsWith('video') ? 'video' : 'image'
    const row = await ProjectService.insert({
      ...meta, media_url: mediaUrl, media_type: mediaType, order_index: 0,
    })
    // Realtime INSERT will sync to state — but optimistically add now
    set(s => {
      s.projects = [row, ...s.projects.map((p,i) => ({ ...p, order_index: i+1 }))]
    })
    return row
  },

  deleteProject: async (id) => {
    if (!useAuthStore.getState().isAdmin) throw new Error('Unauthorized')
    // Get media_url BEFORE optimistic remove so we can delete from Storage
    const target = get().projects.find(p => p.id === id)
    // Optimistic remove immediately
    set(s => { s.projects = s.projects.filter(p => p.id !== id) })
    try {
      // Deletes DB row + Storage file
      await ProjectService.delete(id, target?.media_url)
    } catch (err) {
      // Rollback: re-fetch from server
      const fresh = await ProjectService.getAll()
      set(s => { s.projects = fresh })
      throw err
    }
  },

  reorderProjects: async (newOrder) => {
    // newOrder = array of { id, order_index }
    if (!useAuthStore.getState().isAdmin) throw new Error('Unauthorized')
    // Optimistic
    set(s => {
      const map = Object.fromEntries(newOrder.map(x => [x.id, x.order_index]))
      s.projects = s.projects
        .map(p => ({ ...p, order_index: map[p.id] ?? p.order_index }))
        .sort((a,b) => a.order_index - b.order_index)
    })
    await ProjectService.reorder(newOrder)
  },

  // ── SOCIALS ────────────────────────────────────────────────
  addSocial: async (data) => {
    if (!useAuthStore.getState().isAdmin) throw new Error('Unauthorized')
    const row = await SocialService.insert({ ...data, order_index: get().socials.length })
    set(s => { s.socials = [...s.socials, row] })
  },

  deleteSocial: async (id) => {
    if (!useAuthStore.getState().isAdmin) throw new Error('Unauthorized')
    const snap = get().socials
    set(s => { s.socials = s.socials.filter(x => x.id !== id) })
    try { await SocialService.delete(id) }
    catch (err) { set(s => { s.socials = snap }); throw err }
  },

  // ── CONTENT ────────────────────────────────────────────────
  updateContent: async (patch) => {
    if (!useAuthStore.getState().isAdmin) throw new Error('Unauthorized')
    const snap = get().content
    set(s => { s.content = { ...s.content, ...patch } })
    try { await ContentService.update(patch) }
    catch (err) { set(s => { s.content = snap }); throw err }
  },

  // ── PHOTOS ─────────────────────────────────────────────────
  uploadPhoto: async (type, file) => {
    if (!useAuthStore.getState().isAdmin) throw new Error('Unauthorized')
    const url = await PhotoService.upload(type, file)
    const col = type === 'profile' ? 'profile_url' : 'school_url'
    set(s => { s.photos[col] = url })
    return url
  },
})))

/* ── UI ────────────────────────────────────────────────────── */
export const useUIStore = create((set, get) => ({
  activeFilter:   'all',
  modal:          null,
  uploading:      false,
  uploadProgress: 0,
  darkMode:       localStorage.getItem('theme') === 'dark' ||
                  (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches),

  setFilter:   (f) => set({ activeFilter: f }),
  openModal:   (m) => set({ modal: m }),
  closeModal:  ()  => set({ modal: null }),
  setUploading:(v,p) => set({ uploading: v, uploadProgress: p ?? 0 }),

  toggleDark: () => {
    const next = !get().darkMode
    set({ darkMode: next })
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
  },

  initTheme: () => {
    const dark = get().darkMode
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  },
}))
