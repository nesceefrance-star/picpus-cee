import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const useStore = create((set, get) => ({

  // ─── AUTH ────────────────────────────────────────────────
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  // ─── NAVIGATION ──────────────────────────────────────────
  currentModule: null,
  setCurrentModule: (mod) => set({ currentModule: mod }),

  // ─── DOSSIERS ────────────────────────────────────────────
  dossiers: [],
  currentDossier: null,

  fetchDossiers: async () => {
    const { data, error } = await supabase
      .from('dossiers')
      .select(`*, prospects(*)`)
      .order('created_at', { ascending: false })
    if (!error) set({ dossiers: data || [] })
    return { data, error }
  },

  setCurrentDossier: (dossier) => set({ currentDossier: dossier }),

  createDossier: async (payload) => {
    const { data, error } = await supabase
      .from('dossiers')
      .insert([payload])
      .select()
      .single()
    if (!error) {
      set((s) => ({ dossiers: [data, ...s.dossiers] }))
    }
    return { data, error }
  },

  updateDossier: async (id, updates) => {
    const { data, error } = await supabase
      .from('dossiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error) {
      set((s) => ({
        dossiers: s.dossiers.map((d) => (d.id === id ? data : d)),
        currentDossier: s.currentDossier?.id === id ? data : s.currentDossier,
      }))
    }
    return { data, error }
  },

  // ─── PROSPECTS ───────────────────────────────────────────
  prospects: [],

  fetchProspects: async () => {
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) set({ prospects: data || [] })
    return { data, error }
  },

  createProspect: async (payload) => {
    const { data, error } = await supabase
      .from('prospects')
      .insert([payload])
      .select()
      .single()
    if (!error) {
      set((s) => ({ prospects: [data, ...s.prospects] }))
    }
    return { data, error }
  },

  // ─── SIMULATIONS ─────────────────────────────────────────
  createSimulation: async (payload) => {
    const { data, error } = await supabase
      .from('simulations')
      .insert([payload])
      .select()
      .single()
    return { data, error }
  },

  // ─── ACTIVITÉS ───────────────────────────────────────────
  logActivite: async (dossierId, type, contenu) => {
    const { user } = get()
    await supabase.from('activites').insert([{
      dossier_id: dossierId,
      user_id: user?.id,
      type,
      contenu,
    }])
  },

}))

export default useStore
