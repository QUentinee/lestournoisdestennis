import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const TENNIS_API_KEY = import.meta.env.VITE_TENNIS_API_KEY
const JOUEUR1 = import.meta.env.VITE_NOM_JOUEUR1 || 'Joueur 1'
const JOUEUR2 = import.meta.env.VITE_NOM_JOUEUR2 || 'Joueur 2'

// Points selon catégorie de tournoi
const POINTS = {
  'Grand Slam': 100,
  'ATP Masters 1000': 60,
  'WTA 1000': 60,
  'ATP 500': 40,
  'WTA 500': 40,
  'ATP 250': 20,
  'WTA 250': 20,
}

function getPoints(category) {
  for (const [key, val] of Object.entries(POINTS)) {
    if (category?.includes(key) || category?.includes(key.replace('ATP ', '').replace('WTA ', ''))) return val
  }
  return 10
}

export default function App() {
  const [tournaments, setTournaments] = useState([])
  const [paris, setParis] = useState([])
  const [resultats, setResultats] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('tournois')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchTournaments(), fetchParis(), fetchResultats()])
    setLoading(false)
  }

  async function fetchTournaments() {
    try {
      const res = await fetch(
        `https://api.api-tennis.com/tennis/?method=get_tournaments&event_type=ATP&APIkey=${TENNIS_API_KEY}`
      )
      const data = await res.json()
      if (data.success) setTournaments(data.result?.slice(0, 30) || [])
    } catch (e) {
      console.error('Erreur API tennis:', e)
    }
  }

  async function fetchParis() {
    const { data } = await supabase.from('paris').select('*')
    setParis(data || [])
  }

  async function fetchResultats() {
    const { data } = await supabase.from('resultats').select('*')
    setResultats(data || [])
  }

  async function placerPari(tournamentId, tournamentName, joueur, nomParie) {
    const existing = paris.find(p => p.tournament_id === tournamentId && p.joueur === joueur)
    if (existing) {
      await supabase.from('paris').update({ pari: nomParie }).eq('id', existing.id)
    } else {
      await supabase.from('paris').insert({ tournament_id: tournamentId, tournament_name: tournamentName, joueur, pari: nomParie })
    }
    fetchParis()
  }

  function getPari(tournamentId, joueur) {
    return paris.find(p => p.tournament_id === tournamentId && p.joueur === joueur)?.pari || ''
  }

  function getResultat(tournamentId) {
    return resultats.find(r => r.tournament_id === tournamentId)
  }

  function calcScore(joueur) {
    let score = 0
    for (const r of resultats.filter(r => r.statut === 'finished' && r.vainqueur)) {
      const pari = paris.find(p => p.tournament_id === r.tournament_id && p.joueur === joueur)
      if (pari && pari.pari.toLowerCase() === r.vainqueur.toLowerCase()) {
        const t = tournaments.find(t => t.tournament_key === r.tournament_id)
        score += getPoints(t?.tournament_type || '')
      }
    }
    return score
  }

  const score1 = calcScore('joueur1')
  const score2 = calcScore('joueur2')

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>🎾 Tennis Paris</h1>

      {/* Scores */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[{ nom: JOUEUR1, score: score1, joueur: 'joueur1' }, { nom: JOUEUR2, score: score2, joueur: 'joueur2' }].map(j => (
          <div key={j.joueur} style={{ flex: 1, background: score1 !== score2 && ((j.joueur === 'joueur1' && score1 > score2) || (j.joueur === 'joueur2' && score2 > score1)) ? '#e8f5e9' : '#f5f5f5', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#666' }}>{j.nom}</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{j.score}</div>
            <div style={{ fontSize: 11, color: '#999' }}>points</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['tournois', 'classement'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', background: activeTab === tab ? '#1a1a1a' : '#eee', color: activeTab === tab ? '#fff' : '#333', fontSize: 13 }}>
            {tab === 'tournois' ? '📅 Tournois' : '🏆 Classement'}
          </button>
        ))}
      </div>

      {loading ? <p>Chargement...</p> : null}

      {activeTab === 'tournois' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tournaments.map(t => {
            const res = getResultat(t.tournament_key)
            const p1 = getPari(t.tournament_key, 'joueur1')
            const p2 = getPari(t.tournament_key, 'joueur2')
            return (
              <div key={t.tournament_key} style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{t.tournament_name}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, background: '#f0f0f0', borderRadius: 4, padding: '2px 6px' }}>{t.tournament_type}</span>
                  </div>
                  {res?.statut === 'finished' && <span style={{ fontSize: 12, color: '#2e7d32' }}>✓ {res.vainqueur}</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <PariInput label={JOUEUR1} value={p1}
                    onSave={v => placerPari(t.tournament_key, t.tournament_name, 'joueur1', v)} />
                  <PariInput label={JOUEUR2} value={p2}
                    onSave={v => placerPari(t.tournament_key, t.tournament_name, 'joueur2', v)} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'classement' && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tournoi</th>
                <th style={{ padding: '8px 12px' }}>Vainqueur réel</th>
                <th style={{ padding: '8px 12px' }}>{JOUEUR1}</th>
                <th style={{ padding: '8px 12px' }}>{JOUEUR2}</th>
                <th style={{ padding: '8px 12px' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {resultats.filter(r => r.statut === 'finished').map(r => {
                const p1 = getPari(r.tournament_id, 'joueur1')
                const p2 = getPari(r.tournament_id, 'joueur2')
                const t = tournaments.find(t => t.tournament_key === r.tournament_id)
                const pts = getPoints(t?.tournament_type || '')
                return (
                  <tr key={r.tournament_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 12px' }}>{r.tournament_name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.vainqueur}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: p1?.toLowerCase() === r.vainqueur?.toLowerCase() ? '#2e7d32' : '#c62828' }}>{p1 || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: p2?.toLowerCase() === r.vainqueur?.toLowerCase() ? '#2e7d32' : '#c62828' }}>{p2 || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{pts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PariInput({ label, value, onSave }) {
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  return (
    <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{label} :</span>
      <input value={val} onChange={e => setVal(e.target.value)}
        placeholder="Ex: Sinner"
        style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
      <button onClick={() => onSave(val)}
        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
        ✓
      </button>
    </div>
  )
}
