import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function useVeille() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false) // trigger RSS fetch
  const [newCount, setNewCount] = useState(0)

  const fetchItems = useCallback(async ({ categorie = null, onlySaved = false, onlyUnread = false } = {}) => {
    setLoading(true)
    try {
      let q = supabase
        .from('veille_items')
        .select('*')
        .order('date_publication', { ascending: false })
        .limit(100)

      if (categorie) q = q.eq('source_categorie', categorie)
      if (onlySaved) q = q.eq('est_sauvegarde', true)
      if (onlyUnread) q = q.eq('est_lu', false)

      const { data, error } = await q
      if (error) throw error
      setItems(data || [])
      setNewCount((data || []).filter(i => !i.est_lu).length)
    } catch (e) {
      console.error('useVeille fetchItems:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const markLu = useCallback(async (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, est_lu: true } : i))
    setNewCount(prev => Math.max(0, prev - 1))
    await supabase.from('veille_items').update({ est_lu: true }).eq('id', id)
  }, [])

  const toggleSauvegarde = useCallback(async (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, est_sauvegarde: !i.est_sauvegarde } : i))
    const item = items.find(i => i.id === id)
    if (item) await supabase.from('veille_items').update({ est_sauvegarde: !item.est_sauvegarde }).eq('id', id)
  }, [items])

  const triggerFetch = useCallback(async () => {
    setFetching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ action: 'veille-fetch' }),
      })
      const result = await r.json()
      if (result.items_processed > 0) await fetchItems()
      return result
    } catch (e) {
      console.error('triggerFetch:', e)
    } finally {
      setFetching(false)
    }
  }, [fetchItems])

  const generateSummary = useCallback(async (itemId) => {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: 'veille-summarize', item_id: itemId }),
    })
    const result = await r.json()
    if (result.resume_ia) {
      setItems(prev => prev.map(i => i.id === itemId
        ? { ...i, resume_ia: result.resume_ia, points_cles: result.points_cles, fiches_impactees: result.fiches_impactees }
        : i
      ))
    }
    return result
  }, [])

  return { items, loading, fetching, newCount, fetchItems, markLu, toggleSauvegarde, triggerFetch, generateSummary }
}
