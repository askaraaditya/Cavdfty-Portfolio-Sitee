// src/services/api.js — all Supabase calls, single responsibility
import { supabase } from '../lib/supabase'

function assertOk({ data, error }, ctx) {
  if (error) throw new Error(`[${ctx}] ${error.message}`)
  return data
}

// Extract storage path from a full public URL
// e.g. "https://xxx.supabase.co/storage/v1/object/public/portfolio/projects/abc.jpg"
// → "projects/abc.jpg"
function urlToStoragePath(url) {
  if (!url) return null
  try {
    const marker = '/object/public/portfolio/'
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    // Remove query string (cache busters)
    return url.slice(idx + marker.length).split('?')[0]
  } catch { return null }
}

/* ── AUTH ──────────────────────────────────────────────────── */
export const AuthService = {
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    return data
  },
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },
  onAuthChange(cb) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((e, s) => cb(e, s))
    return subscription
  },
}

/* ── PROJECTS ──────────────────────────────────────────────── */
export const ProjectService = {
  async getAll() {
    const data = assertOk(
      await supabase.from('projects').select('*').order('order_index', { ascending: true }),
      'getAll'
    )
    return data ?? []
  },

  async insert(project) {
    return assertOk(
      await supabase.from('projects').insert(project).select().single(),
      'insert'
    )
  },

  // DELETE from DB + Storage in one call
  async delete(id, mediaUrl) {
    // 1. Delete the file from Storage first (best-effort — don't block on failure)
    if (mediaUrl) {
      const storagePath = urlToStoragePath(mediaUrl)
      if (storagePath) {
        const { error } = await supabase.storage.from('portfolio').remove([storagePath])
        if (error) console.warn('[Storage delete]', error.message)
      }
    }
    // 2. Delete the DB row
    assertOk(
      await supabase.from('projects').delete().eq('id', id),
      'delete'
    )
  },

  // Batch reorder — single upsert instead of N updates
  async reorder(items) {
    // items = [{ id, order_index }, ...]
    assertOk(
      await supabase.from('projects').upsert(items, { onConflict: 'id' }),
      'reorder'
    )
  },

  // Upload file → Storage → return { publicUrl, storagePath }
  async uploadMedia(file) {
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `projects/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { data, error } = await supabase.storage
      .from('portfolio')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) throw new Error(`Upload failed: ${error.message}`)

    const { data: { publicUrl } } = supabase.storage
      .from('portfolio')
      .getPublicUrl(data.path)

    return publicUrl
  },

  // Realtime — returns channel (call supabase.removeChannel to unsub)
  subscribe(cb) {
    return supabase
      .channel('projects-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, cb)
      .subscribe()
  },
}

/* ── SOCIALS ───────────────────────────────────────────────── */
export const SocialService = {
  async getAll() {
    return assertOk(
      await supabase.from('socials').select('*').order('order_index', { ascending: true }),
      'socials.getAll'
    ) ?? []
  },
  async insert(s) {
    return assertOk(
      await supabase.from('socials').insert(s).select().single(),
      'socials.insert'
    )
  },
  async delete(id) {
    assertOk(await supabase.from('socials').delete().eq('id', id), 'socials.delete')
  },
  subscribe(cb) {
    return supabase
      .channel('socials-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'socials' }, cb)
      .subscribe()
  },
}

/* ── CONTENT ───────────────────────────────────────────────── */
export const ContentService = {
  async get() {
    return assertOk(
      await supabase.from('content').select('*').single(),
      'content.get'
    )
  },
  async update(patch) {
    return assertOk(
      await supabase.from('content').update(patch).eq('id', 1).select().single(),
      'content.update'
    )
  },
  subscribe(cb) {
    return supabase
      .channel('content-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'content' }, cb)
      .subscribe()
  },
}

/* ── PHOTOS ────────────────────────────────────────────────── */
export const PhotoService = {
  async get() {
    const { data, error } = await supabase.from('photos').select('*').single()
    if (error) return { profile_url: null, school_url: null }
    return data
  },
  async upload(type, file) {
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `photos/${type}.${ext}`
    const { data, error } = await supabase.storage
      .from('portfolio')
      .upload(path, file, { cacheControl: '3600', upsert: true })
    if (error) throw new Error(`Photo upload failed: ${error.message}`)

    const { data: { publicUrl } } = supabase.storage
      .from('portfolio').getPublicUrl(data.path)

    const url = `${publicUrl}?t=${Date.now()}`
    const col = type === 'profile' ? 'profile_url' : 'school_url'
    assertOk(
      await supabase.from('photos').update({ [col]: url }).eq('id', 1),
      'photos.upload'
    )
    return url
  },
}
