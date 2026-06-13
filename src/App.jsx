import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const API_KEY = import.meta.env.VITE_TENNIS_API_KEY
const JOUEUR1 = import.meta.env.VITE_NOM_JOUEUR1 || 'Joueur 1'
const JOUEUR2 = import.meta.env.VITE_NOM_JOUEUR2 || 'Joueur 2'
const BASE_URL = 'https://tennis.bzzoiro.com/api'
const HEADERS = { 'Authorization': `Token ${API_KEY}` }

const POINTS_MAP = {
  grand_slam: 100,
  masters_1000: 60,
  wta_1000: 60,
  atp_500: 40,
  wta_500: 40,
  atp_250: 20,
  wta_250: 20,
}

function getPoints(category) {
  return POINTS_MAP[category?.toLowerCase()] ?? 10
}

function getCategoryLabel(category) {
  const labels = {
    grand_slam: 'Grand Chelem',
    masters_1000: 'Masters 1000',
    wta_1000: 'WTA 1000',
    atp_500: 'ATP 500',
    wta_500: 'WTA 500',
    atp_250: 'ATP 250',
    wta_250: 'WTA 250',
  }
  return labels[category] ?? category ?? '—'
}

// Récupère toutes les pages d'un endpoint paginé
async function fetchAllPages(url) {
  let results = []
  let next = url
  while (next) {
    const res = await fetch(next, { headers: HEADERS })
    const data = await res.json()
    results = results.concat(data.results || [])
    next = data.next
    if (results.length > 200) break // sécurité
  }
  return results
}

export default function App() {
  const [tournaments, setTournaments] = useState([])
  const [paris, setParis] = useState([])
  const [resultats, setResultats] = useState([])
  const [liveMatches, setLiveMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('tournois')
  const [circuitFilter, setCircuitFilter] = useState('ATP')

  useEffect(() => {
    fetchAll()
    // Refresh scores live toutes les 60s
    const interval = setInterval(fetchLive, 60000)
    return () => clearInterval(interval)
  }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchTournaments(), fetchParis(), fetchResultats(), fetchLive()])
    setLoading(false)
  }

  async function fetchTournaments() {
    try {
      // On récupère les matchs des 6 prochains mois pour extraire les tournois
      const today = new Date().toISOString().split('T')[0]
      const in6months = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
      const matches = await fetchAllPages(
        `${BASE_URL}/matches/?date_from=${today}&date_to=${in6months}`
      )
      // Déduplique les tournois
      const seen = new Set()
      const tournois = []
      for (const m of matches) {
        const t = m.tournament
        if (t && !seen.has(t.id)) {
          seen.add(t.id)
          // Date du premier match trouvé
          tournois.push({ ...t, first_match_date: m.date, winner: m.status === 'finished' ? getWinner(m) : null })
        }
      }
      // Trie par date
      tournois.sort((a, b) => new Date(a.first_match_date) - new Date(b.first_match_date))
      setTournaments(tournois)

      // Met à jour les résultats des tournois terminés automatiquement
      await updateResultats(matches)
    } catch (e) {
      console.error('Erreur API bzzoiro:', e)
    }
  }

  function getWinner(match) {
    if (match.status !== 'finished') return null
    if (match.player1_sets > match.player2_sets) return match.player1_obj?.name || match.player1
    if (match.player2_sets > match.player1_sets) return match.player2_obj?.name || match.player2
    return null
  }

  async function updateResultats(matches) {
    // Cherche les finales terminées pour chaque tournoi
    const finishedMatches = matches.filter(m => m.status === 'finished' && m.round === 'F')
    for (const m of finishedMatches) {
      const winner = getWinner(m)
      if (!winner || !m.tournament?.id) continue
      const existing = await supabase.from('resultats').select('id').eq('tournament_id', String(m.tournament.id)).single()
      if (existing.data) {
        await supabase.from('resultats').update({ vainqueur: winner, statut: 'finished' }).eq('tournament_id', String(m.tournament.id))
      } else {
        await supabase.from('resultats').insert({
          tournament_id: String(m.tournament.id),
          tournament_name: m.tournament.name,
          vainqueur: winner,
          statut: 'finished'
        })
      }
    }
    fetchResultats()
  }

  async function fetchLive() {
    try {
      const res = await fetch(`${BASE_URL}/live/`, { headers: HEADERS })
      const data = await res.json()
      setLiveMatches(data.results || [])
    } catch (e) {
      console.error('Erreur live:', e)
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
    const existing = paris.find(p => p.tournament_id === String(tournamentId) && p.joueur === joueur)
    if (existing) {
      await supabase.from('paris').update({ pari: nomParie }).eq('id', existing.id)
    } else {
      await supabase.from('paris').insert({
        tournament_id: String(tournamentId),
        tournament_name: tournamentName,
        joueur,
        pari: nomParie
      })
    }
    fetchParis()
  }

  function getPari(tournamentId, joueur) {
    return paris.find(p => p.tournament_id === String(tournamentId) && p.joueur === joueur)?.pari || ''
  }

  function getResultat(tournamentId) {
    return resultats.find(r => r.tournament_id === String(tournamentId))
  }

  function calcScore(joueur) {
    let score = 0
    for (const r of resultats.filter(r => r.statut === 'finished' && r.vainqueur)) {
      const pari = paris.find(p => p.tournament_id === r.tournament_id && p.joueur === joueur)
      if (!pari) continue
      if (pari.pari.toLowerCase().trim() === r.vainqueur.toLowerCase().trim()) {
        const t = tournaments.find(t => String(t.id) === r.tournament_id)
        score += getPoints(t?.category)
      }
    }
    return score
  }

  const score1 = calcScore('joueur1')
  const score2 = calcScore('joueur2')
  const filteredTournaments = tournaments.filter(t =>
    circuitFilter === 'TOUS' || t.circuit === circuitFilter
  )

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 920, margin: '0 auto', padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🎾 Tennis Paris</h1>
        {liveMatches.length > 0 && (
          <span style={{ fontSize: 12, background: '#ffebee', color: '#c62828', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
            ● {liveMatches.length} en direct
          </span>
        )}
      </div>

      {/* Scores */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { nom: JOUEUR1, score: score1, id: 'joueur1' },
          { nom: JOUEUR2, score: score2, id: 'joueur2' }
        ].map(j => {
          const isLeading = (j.id === 'joueur1' && score1 > score2) || (j.id === 'joueur2' && score2 > score1)
          return (
            <div key={j.id} style={{
              flex: 1, borderRadius: 12, padding: '14px 18px', textAlign: 'center',
              background: isLeading ? '#e8f5e9' : '#f5f5f5',
              border: isLeading ? '2px solid #66bb6a' : '1px solid #e0e0e0'
            }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{j.nom}</div>
              <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{j.score}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>pts</div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { id: 'tournois', label: '📅 Tournois' },
          { id: 'live', label: `🔴 En direct${liveMatches.length ? ` (${liveMatches.length})` : ''}` },
          { id: 'classement', label: '🏆 Classement' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
              background: activeTab === tab.id ? '#1a1a1a' : '#eee',
              color: activeTab === tab.id ? '#fff' : '#333'
            }}>
            {tab.label}
          </button>
        ))}

        {activeTab === 'tournois' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {['ATP', 'WTA', 'TOUS'].map(f => (
              <button key={f} onClick={() => setCircuitFilter(f)}
                style={{
                  padding: '4px 12px', borderRadius: 20, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12,
                  background: circuitFilter === f ? '#1565c0' : '#fff',
                  color: circuitFilter === f ? '#fff' : '#555'
                }}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p style={{ color: '#999', fontSize: 14 }}>Chargement des tournois...</p>}

      {/* Tab : Tournois */}
      {activeTab === 'tournois' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTournaments.length === 0 && <p style={{ color: '#999' }}>Aucun tournoi trouvé.</p>}
          {filteredTournaments.map(t => {
            const res = getResultat(t.id)
            const p1 = getPari(t.id, 'joueur1')
            const p2 = getPari(t.id, 'joueur2')
            const pts = getPoints(t.category)
            return (
              <div key={t.id} style={{
                border: '1px solid #e0e0e0', borderRadius: 10, padding: '12px 16px',
                background: res?.statut === 'finished' ? '#fafff9' : '#fff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, background: '#ede7f6', color: '#4527a0', borderRadius: 4, padding: '1px 6px' }}>
                        {getCategoryLabel(t.category)}
                      </span>
                      <span style={{ fontSize: 11, background: '#f0f0f0', color: '#555', borderRadius: 4, padding: '1px 6px' }}>
                        {t.surface}
                      </span>
                      <span style={{ fontSize: 11, background: '#e3f2fd', color: '#0d47a1', borderRadius: 4, padding: '1px 6px' }}>
                        {t.circuit}
                      </span>
                      <span style={{ fontSize: 11, color: '#888' }}>{t.city}, {t.country}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {res?.statut === 'finished'
                      ? <span style={{ fontSize: 12, color: '#2e7d32', fontWeight: 600 }}>✓ {res.vainqueur}</span>
                      : <span style={{ fontSize: 12, color: '#888' }}>{pts} pts</span>
                    }
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <PariInput label={JOUEUR1} value={p1} disabled={!!res?.statut}
                    onSave={v => placerPari(t.id, t.name, 'joueur1', v)} />
                  <PariInput label={JOUEUR2} value={p2} disabled={!!res?.statut}
                    onSave={v => placerPari(t.id, t.name, 'joueur2', v)} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab : Live */}
      {activeTab === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {liveMatches.length === 0 && <p style={{ color: '#999' }}>Aucun match en direct pour le moment.</p>}
          {liveMatches.map(m => (
            <div key={m.id} style={{ border: '1px solid #ffcdd2', borderRadius: 10, padding: '12px 16px', background: '#fff8f8' }}>
              <div style={{ fontSize: 11, color: '#e53935', fontWeight: 600, marginBottom: 6 }}>
                ● EN DIRECT — {m.tournament?.name} · Set {m.current_set}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: m.player1_sets > m.player2_sets ? 700 : 400 }}>
                    {m.player1_obj?.name || m.player1}
                    {m.serving_player === 1 && <span style={{ marginLeft: 6, fontSize: 10 }}>🎾</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: m.player2_sets > m.player1_sets ? 700 : 400 }}>
                    {m.player2_obj?.name || m.player2}
                    {m.serving_player === 2 && <span style={{ marginLeft: 6, fontSize: 10 }}>🎾</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{m.player1_sets}–{m.player2_sets}</div>
                  {m.current_game_score && (
                    <div style={{ fontSize: 12, color: '#666' }}>{m.current_game_score}</div>
                  )}
                </div>
                {m.sets_detail?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                    {m.sets_detail.map((s, i) => (
                      <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#555' }}>
                        <div>{s.p1}</div>
                        <div>{s.p2}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab : Classement */}
      {activeTab === 'classement' && (
        <div>
          {resultats.filter(r => r.statut === 'finished').length === 0
            ? <p style={{ color: '#999' }}>Aucun tournoi terminé pour l'instant.</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tournoi</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Vainqueur</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>{JOUEUR1}</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>{JOUEUR2}</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {resultats.filter(r => r.statut === 'finished').map(r => {
                    const p1 = getPari(r.tournament_id, 'joueur1')
                    const p2 = getPari(r.tournament_id, 'joueur2')
                    const t = tournaments.find(t => String(t.id) === r.tournament_id)
                    const pts = getPoints(t?.category)
                    const ok = (p) => p?.toLowerCase().trim() === r.vainqueur?.toLowerCase().trim()
                    return (
                      <tr key={r.tournament_id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px 12px' }}>{r.tournament_name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.vainqueur}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: ok(p1) ? '#2e7d32' : p1 ? '#c62828' : '#aaa' }}>
                          {p1 || '—'} {ok(p1) ? `+${pts}` : ''}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: ok(p2) ? '#2e7d32' : p2 ? '#c62828' : '#aaa' }}>
                          {p2 || '—'} {ok(p2) ? `+${pts}` : ''}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#888' }}>{pts}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f5f5f5', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '10px 12px' }}>Total</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 16 }}>{score1}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 16 }}>{score2}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )
          }
        </div>
      )}
    </div>
  )
}

function PariInput({ label, value, onSave, disabled }) {
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  return (
    <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center', minWidth: 180 }}>
      <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{label} :</span>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={disabled ? 'Terminé' : 'Ex: Sinner'}
        disabled={disabled}
        style={{
          flex: 1, padding: '5px 8px', borderRadius: 6,
          border: '1px solid #ddd', fontSize: 13,
          background: disabled ? '#f5f5f5' : '#fff',
          color: disabled ? '#999' : '#000'
        }}
      />
      {!disabled && (
        <button onClick={() => val.trim() && onSave(val.trim())}
          style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
          ✓
        </button>
      )}
    </div>
  )
}
