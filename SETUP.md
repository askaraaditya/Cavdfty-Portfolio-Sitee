# Setup Guide — Portfolio Aditya + Supabase

## Estimasi waktu: 30 menit

---

## STEP 1 — Buat Supabase Project

1. Buka **https://supabase.com** → Sign Up / Login
2. Klik **New Project**
3. Isi:
   - **Name**: `portfolio-aditya`
   - **Database Password**: buat password yang kuat (simpan!)
   - **Region**: pilih yang terdekat (Singapore untuk Indonesia)
4. Klik **Create New Project** → tunggu ~2 menit

---

## STEP 2 — Jalankan SQL Schema

1. Di Supabase Dashboard → klik **SQL Editor** (icon terminal di sidebar)
2. Klik **New Query**
3. Copy seluruh isi file `supabase/schema.sql`
4. Paste ke SQL Editor
5. Klik **Run** (▶)
6. Pastikan semua query berhasil (tidak ada error merah)

---

## STEP 3 — Buat Storage Bucket

1. Di sidebar → klik **Storage**
2. Klik **New Bucket**
3. Isi:
   - **Name**: `portfolio`
   - **Public bucket**: ✅ ON
4. Klik **Save**

> Storage policies sudah ada di schema.sql, tapi kalau ada error,
> buat manual di: Storage → Policies → New Policy

---

## STEP 4 — Buat Admin User

1. Di sidebar → **Authentication** → **Users**
2. Klik **Add User** → **Create New User**
3. Isi:
   - **Email**: `mhmdadity27@gmail.com` (atau email kamu)
   - **Password**: buat password yang aman
4. Klik **Create User**

> Ini adalah user yang akan login sebagai admin di portfolio.
> Bukan "hardcoded hash" lagi — ini real Supabase Auth.

---

## STEP 5 — Ambil API Credentials

1. Di sidebar → **Project Settings** (icon gear)
2. Klik **API**
3. Copy:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon / public key** → `eyJhbGci...`

> Jangan copy **service_role key** — itu untuk server-side only.
> anon key aman untuk frontend.

---

## STEP 6 — Setup Project

```bash
# 1. Copy .env.example ke .env.local
cp .env.example .env.local

# 2. Edit .env.local dengan credentials dari Step 5
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGci...

# 3. Install dependencies
npm install

# 4. Jalankan development server
npm run dev

# 5. Buka http://localhost:5173
```

---

## STEP 7 — Test Login Admin

1. Buka `http://localhost:5173`
2. Klik tombol **Admin** di navbar
3. Login dengan email + password yang dibuat di Step 4
4. Admin bar muncul di bawah layar
5. Coba upload karya → foto tersimpan di Supabase Storage
6. Buka tab browser baru → karya langsung muncul (real-time!)

---

## STEP 8 — Deploy ke Vercel

```bash
# 1. Push ke GitHub
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/username/portfolio-aditya.git
git push -u origin main

# 2. Buka vercel.com → New Project → Import dari GitHub
# 3. Di Vercel dashboard → Settings → Environment Variables:
#    VITE_SUPABASE_URL = (value dari .env.local)
#    VITE_SUPABASE_ANON_KEY = (value dari .env.local)
# 4. Deploy → selesai!
```

---

## Perbedaan dari versi sebelumnya

| Feature | Versi lama (HTML) | Versi ini (Supabase) |
|---|---|---|
| Upload foto | Lokal (hilang saat refresh) | Supabase Storage (permanen) |
| Edit konten | Lokal (hanya kamu lihat) | Database (semua orang lihat) |
| Login admin | SHA-256 hash (bisa dibypass) | Supabase Auth (JWT, server-side) |
| Data projects | localStorage | PostgreSQL database |
| Real-time | Tidak | ✅ Ya — semua tab sync otomatis |
| Multi-device | Tidak | ✅ Ya |
| Security | Frontend-only | RLS di database level |

---

## Troubleshooting

**"Missing Supabase credentials"**
→ Pastikan `.env.local` sudah dibuat dan diisi

**"Failed to fetch"**
→ Cek URL Supabase di `.env.local` — harus `https://` bukan `http://`

**"new row violates row-level security"**
→ Pastikan kamu sudah login sebagai admin, bukan anonymous

**Upload gagal**
→ Pastikan bucket `portfolio` sudah dibuat dan Public = ON

**Realtime tidak jalan**
→ Pastikan `supabase_realtime` publication sudah aktif (ada di schema.sql)
→ Atau: Supabase Dashboard → Database → Replication → centang semua table

---

## File structure

```
portfolio-supabase/
├── .env.example          ← copy ke .env.local
├── index.html
├── package.json
├── vite.config.js
├── supabase/
│   └── schema.sql        ← jalankan di SQL Editor
└── src/
    ├── main.jsx
    ├── App.jsx           ← semua sections
    ├── index.css         ← semua styles
    ├── lib/
    │   └── supabase.js   ← Supabase client
    ├── services/
    │   └── api.js        ← semua Supabase calls
    ├── store/
    │   └── index.js      ← Zustand stores + realtime
    ├── hooks/
    │   └── index.js      ← reusable hooks
    └── components/
        ├── WorkGrid.jsx  ← drag-drop grid + lightbox
        └── Modals.jsx    ← login, upload, editor, socials
```
