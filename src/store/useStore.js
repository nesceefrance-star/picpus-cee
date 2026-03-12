import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const useStore = create((set, get) => ({

  // ─── AUTH ────────────────────────────────────────────────
  user: null,
  session: null,
  profile: null,

  setSession: (session) => set({ session, user: session?.user ?? null }),

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', userId).single()
    set({ profile: data })
    return data
  },

  isAdmin: () => get().profile?.role === 'admin',

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  },

  // ─── NAVIGATION ──────────────────────────────────────────
  currentModule: null,
  setCurrentModule: (mod) => set({ currentModule: mod }),

  // ─── PROFILES / USERS ────────────────────────────────────
  profiles: [],

  fetchProfiles: async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    set({ profiles: data || [] })
    return data
  },

  updateProfile: async (id, updates) => {
    const { data } = await supabase.from('profiles').update(updates).eq('id', id).select().single()
    if (data) set(s => ({ profiles: s.profiles.map(p => p.id === id ? data : p) }))
    return data
  },

  inviteUser: async (email, nom, prenom, role) => {
    // Invitation via Supabase Auth
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({ email }),
    })
    const invited = await res.json()
    if (invited.id) {
      await supabase.from('profiles').upsert({ id: invited.id, email, nom, prenom, role })
    }
    return invited
  },

  // ─── DOSSIERS ────────────────────────────────────────────
  dossiers: [],
  currentDossier: null,

  fetchDossiers: async () => {
    const { user, profile } = get()
    let query = supabase
      .from('dossiers')
      .select(`*, prospects(*)`)
      .order('created_at', { ascending: false })
    if (profile?.role !== 'admin' && user?.id) {
      query = query.eq('assigne_a', user.id)
    }
    const { data, error } = await query
    if (!error) set({ dossiers: data || [] })
    return { data, error }
  },

  setCurrentDossier: (dossier) => set({ currentDossier: dossier }),

  createDossier: async (payload) => {
    const { data, error } = await supabase
      .from('dossiers').insert([payload]).select(`*, prospects(*)`).single()
    if (!error) set(s => ({ dossiers: [data, ...s.dossiers] }))
    return { data, error }
  },

  updateDossier: async (id, updates) => {
    const { data, error } = await supabase
      .from('dossiers').update(updates).eq('id', id).select(`*, prospects(*)`).single()
    if (!error) set(s => ({
      dossiers: s.dossiers.map(d => d.id === id ? data : d),
      currentDossier: s.currentDossier?.id === id ? data : s.currentDossier,
    }))
    return { data, error }
  },

  // ─── PROSPECTS ───────────────────────────────────────────
  prospects: [],

  fetchProspects: async () => {
    const { data } = await supabase.from('prospects').select('*').order('created_at', { ascending: false })
    set({ prospects: data || [] })
    return data
  },

  createProspect: async (payload) => {
    const { data, error } = await supabase.from('prospects').insert([payload]).select().single()
    if (!error) set(s => ({ prospects: [data, ...s.prospects] }))
    return { data, error }
  },

  updateProspect: async (id, updates) => {
    const { data } = await supabase.from('prospects').update(updates).eq('id', id).select().single()
    return data
  },

  // ─── SIMULATIONS ─────────────────────────────────────────
  createSimulation: async (payload) => {
    const { data, error } = await supabase.from('simulations').insert([payload]).select().single()
    return { data, error }
  },

  fetchSimulations: async (dossierId) => {
    const { data } = await supabase.from('simulations').select('*').eq('dossier_id', dossierId).order('created_at', { ascending: false })
    return data || []
  },

  // ─── ACTIVITÉS ───────────────────────────────────────────
  logActivite: async (dossierId, type, contenu) => {
    const { user } = get()
    await supabase.from('activites').insert([{ dossier_id: dossierId, user_id: user?.id, type, contenu }])
  },

}))

export default useStore
