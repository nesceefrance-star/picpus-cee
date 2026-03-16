import { supabase } from './supabase'

/** Retourne le préfixe courant, ex: "2026-03-" */
function currentPrefix() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-`
}

/** Valeur initiale synchrone (pour useState) */
export function refDefault() {
  return currentPrefix() + '001'
}

/**
 * Génère la prochaine référence séquentielle en interrogeant Supabase.
 * @param {string} table  - table Supabase à requêter
 * @param {string} col    - colonne contenant la ref
 */
export async function nextRef(table, col) {
  const prefix = currentPrefix()
  const { data } = await supabase
    .from(table)
    .select(col)
    .like(col, `${prefix}%`)
  const num = (data?.length || 0) + 1
  return prefix + String(num).padStart(3, '0')
}
