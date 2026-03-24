// Palette partagée — dossier components
export const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB', nav: '#1E293B',
}

export function Field({ label, value, onChange, type = 'text', placeholder, suffix }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={type} value={value ?? ''} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: suffix ? '9px 44px 9px 12px' : '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMid }}>{suffix}</span>}
      </div>
    </div>
  )
}

export function InfoRow({ label, value, color }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textSoft, width: 110, flexShrink: 0, paddingTop: 1, textTransform: 'uppercase', letterSpacing: .3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: color ? 700 : 400, color: color || C.text }}>{value}</span>
    </div>
  )
}
