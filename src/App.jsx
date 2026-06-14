import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const API_KEY = import.meta.env.VITE_TENNIS_API_KEY
const JOUEUR1 = import.meta.env.VITE_NOM_JOUEUR1 || 'Joueur 1'
const JOUEUR2 = import.meta.env.VITE_NOM_JOUEUR2 || 'Joueur 2'
const BASE_URL = 'https://tennis.bzzoiro.com/api'
const HEADERS = { 'Authorization': `Token ${API_KEY}` }
import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// IDs des tournois ATP/WTA principaux sur Sofascore
// ATP: 2480=Australian Open, 2481=Roland Garros, 2482=Wimbledon, 2483=US Open
// ATP 1000: 2484=Indian Wells, 2485=Miami, 2486=Madrid, 2487=Rome,
//           2488=Canada, 2489=Cincinnati, 2490=Shanghai, 2491=Paris, 2492=Monte Carlo
// ATP 500: 2493=Dubaï, 2494=Barcelone, 2495=Halle, 2496=Queen's, 2497=Vienne, 2498=Bâle, 2499=Rotterdam, 2500=Washington
// WTA 1000: 2606=Indian Wells, 2607=Miami, 2608=Madrid, 2609=Rome, 2610=Canada, 2611=Cincinnati, 2612=Pékin
// WTA 500: 2620=Dubaï, 2621=Stuttgart, 2622=Berlin

const TOURNAMENTS_CONFIG = [
  // Grand Chelems
  { id: 2480, name: 'Australian Open', category: 'Grand Chelem', circuit: 'ATP/WTA', pts: 100 },
  { id: 2481, name: 'Roland Garros', category: 'Grand Chelem', circuit: 'ATP/WTA', pts: 100 },
  { id: 2482, name: 'Wimbledon', category: 'Grand Chelem', circuit: 'ATP/WTA', pts: 100 },
  { id: 2483, name: 'US Open', category: 'Grand Chelem', circuit: 'ATP/WTA', pts: 100 },
  // ATP Masters 1000
  { id: 2484, name: 'Indian Wells (ATP)', category: 'ATP Masters 1000', circuit: 'ATP', pts: 60 },
  { id: 2485, name: 'Miami (ATP)', category: 'ATP Masters 1000', circuit: 'ATP', pts: 60 },
  { id: 2492, name: 'Monte Carlo', category: 'ATP Masters 1000', circuit: 'ATP', pts: 60 },
  { id: 2486, name: 'Madrid (ATP)', category: 'ATP Masters 1000', circuit: 'ATP', pts: 60 },
  { id: 2487, name: 'Rome (ATP)', category: 'ATP Masters 1000', circuit: 'ATP', pts: 60 },
  { id: 2488, name: 'Canada (ATP)', category: 'ATP Masters 1000', circuit: 'ATP', pts: 60 },
  { id: 2489, name: 'Cincinnati (ATP)', category: 'ATP Masters 1000', circuit: 'ATP', pts: 60 },
  { id: 2490, name: 'Shanghai', category: 'ATP Masters 1000', circuit: 'ATP', pts: 60 },
  { id: 2491, name: 'Paris Bercy', category: 'ATP Masters 1000', circuit: 'ATP', pts: 60 },
  // ATP 500
  { id: 2493, name: 'Dubaï (ATP)', category: 'ATP 500', circuit: 'ATP', pts: 40 },
  { id: 2494, name: 'Barcelone', category: 'ATP 500', circuit: 'ATP', pts: 40 },
  { id: 2499, name: 'Rotterdam', category: 'ATP 500', circuit: 'ATP', pts: 40 },
  { id: 2500, name: 'Washington', category: 'ATP 500', circuit: 'ATP', pts: 40 },
  { id: 2495, name: 'Halle', category: 'ATP 500', circuit: 'ATP', pts: 40 },
  { id: 2496, name: "Queen's Club", category: 'ATP 500', circuit: 'ATP', pts: 40 },
  { id: 2497, name: 'Vienne', category: 'ATP 500', circuit: 'ATP', pts: 40 },
  { id: 2498, name: 'Bâle', category: 'ATP 500', circuit: 'ATP', pts: 40 },
  // WTA 1000
  { id: 2606, name: 'Indian Wells (WTA)', category: 'WTA 1000', circuit: 'WTA', pts: 60 },
  { id: 2607, name: 'Miami (WTA)', category: 'WTA 1000', circuit: 'WTA', pts: 60 },
  { id: 2608, name: 'Madrid (WTA)', category: 'WTA 1000', circuit: 'WTA', pts: 60 },
  { id: 2609, name: 'Rome (WTA)', category: 'WTA 1000', circuit: 'WTA', pts: 60 },
  { id: 2610, name: 'Canada (WTA)', category: 'WTA 1000', circuit: 'WTA', pts: 60 },
  { id: 2611, name: 'Cincinnati (WTA)', category: 'WTA 1000', circuit: 'WTA', pts: 60 },
  { id: 2612, name: 'Pékin (WTA)', category: 'WTA 1000', circuit: 'WTA', pts: 60 },
  // WTA 500
  { id: 2620, name: 'Dubaï (WTA)', category: 'WTA 500', circuit: 'WTA', pts: 40 },
  { id: 2621, name: 'Stuttgart (WTA)', category: 'WTA 500', circuit: 'WTA', pts: 40 },
  { id: 2622, name: 'Berlin (WTA)', category: 'WTA 500', circuit: 'WTA', pts: 40 },
]

const JOUEUR1 = import.meta.env.VITE_NOM_JOUEUR1 || 'Joueur 1'
const JOUEUR2 = import.meta.env.VITE_NOM_JOUEUR2 || 'Joueur 2'
const BASE = 'https://api.sofascore.com/api/v1'

const CAT_COLORS = {
  'Grand Chelem': { bg: '#fff3e0', color: '#e65100' },
  'ATP Masters 1000': { bg: '#e3f2fd', color: '#0d47a1' },
  'WTA 1000': { bg: '#fce4ec', color: '#880e4f' },
  'ATP 500': { bg: '#e8f5e9', color: '#1b5e20' },
  'WTA 500': { bg: '#f3e5f5', color: '#4a148c' },
}

export default function App() {
  const [tournamentData, setTournamentData] = useState({}) // { id: { winner, season } }
  const [paris, setParis] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('tournois')
  const [circuitFilter, setCircuitFilter] = useState('TOUS')
  const [liveMatches, setLiveMatches] = useState([])

  useEffect(() => {
    init()
    const iv = setInterval(fetchLive, 60000)
    return () => clearInterval(iv)
  }, [])

  async function init() {
    setLoading(true)
    await Promise.all([loadParis(), fetchAllTournaments(), fetchLive()])
    setLoading(false)
  }

  async function loadParis() {
    const { data } = await supabase.from('paris').select('*')
    setParis(data || [])
  }

  // Récupère saison courante + vainqueur pour chaque tournoi
  async function fetchAllTournaments() {
    const results = {}
    await Promise.all(
      TOURNAMENTS_CONFIG.map(async (t) => {
        try {
          // 1. Récupère les saisons du tournoi
          const res = await fetch(`${BASE}/unique-tournament/${t.id}/seasons/`)
          const data = await res.json()
          const seasons = data.seasons || []
          // Prend la saison 2026 ou la plus récente
          const season = seasons.find(s => s.year === '2026') || seasons[0]
          if (!season) return

          // 2. Récupère les matchs de la saison pour trouver le vainqueur de la finale
          const res2 = await fetch(`${BASE}/unique-tournament/${t.id}/season/${season.id}/events/last/0`)
          const data2 = await res2.json()
          const events = data2.events || []

          // Cherche la finale terminée
          const finale = events.find(e =>
            e.roundInfo?.name?.toLowerCase().includes('final') &&
            !e.roundInfo?.name?.toLowerCase().includes('semi') &&
            !e.roundInfo?.name?.toLowerCase().includes('quarter') &&
            e.status?.type === 'finished'
          )

          let winner = null
          if (finale) {
            winner = finale.winnerCode === 1
              ? finale.homeTeam?.name
              : finale.awayTeam?.name
          }

          results[t.id] = { winner, season, status: finale ? 'finished' : 'upcoming' }

          // Sauvegarde le vainqueur en base si trouvé
          if (winner) {
            const existing = await supabase.from('resultats').select('id').eq('tournament_id', String(t.id)).single()
            if (existing.data) {
              await supabase.from('resultats').update({ vainqueur: winner, statut: 'finished', updated_at: new Date().toISOString() }).eq('tournament_id', String(t.id))
            } else {
              await supabase.from('resultats').insert({ tournament_id: String(t.id), tournament_name: t.name, vainqueur: winner, statut: 'finished' })
            }
          }
        } catch (e) {
          console.warn(`Erreur tournoi ${t.name}:`, e.message)
        }
      })
    )
    setTournamentData(results)
  }

  async function fetchLive() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`${BASE}/sport/tennis/scheduled-events/${today}`)
      const data = await res.json()
      const live = (data.events || []).filter(e => e.status?.type === 'inprogress')
      setLiveMatches(live)
    } catch (e) {
      console.warn('Erreur live:', e.message)
    }
  }

  async function placerPari(tournamentId, tournamentName, joueur, nomParie) {
    const existing = paris.find(p => p.tournament_id === String(tournamentId) && p.joueur === joueur)
    if (existing) {
      await supabase.from('paris').update({ pari: nomParie }).eq('id', existing.id)
    } else {
      await supabase.from('paris').insert({ tournament_id: String(tournamentId), tournament_name: tournamentName, joueur, pari: nomParie })
    }
    loadParis()
  }

  function getPari(tournamentId, joueur) {
    return paris.find(p => p.tournament_id === String(tournamentId) && p.joueur === joueur)?.pari || ''
  }

  function calcScore(joueur) {
    return TOURNAMENTS_CONFIG.reduce((score, t) => {
      const td = tournamentData[t.id]
      if (!td?.winner) return score
      const pari = paris.find(p => p.tournament_id === String(t.id) && p.joueur === joueur)
      if (pari && pari.pari.toLowerCase().trim() === td.winner.toLowerCase().trim()) {
        return score + t.pts
      }
      return score
    }, 0)
  }

  const score1 = calcScore('joueur1')
  const score2 = calcScore('joueur2')

  const filteredTournaments = TOURNAMENTS_CONFIG.filter(t =>
    circuitFilter === 'TOUS' ||
    (circuitFilter === 'ATP' && (t.circuit === 'ATP' || t.circuit === 'ATP/WTA')) ||
    (circuitFilter === 'WTA' && (t.circuit === 'WTA' || t.circuit === 'ATP/WTA'))
  )

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 940, margin: '0 auto', padding: '1rem 1.25rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>🎾 Tennis Paris</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {liveMatches.length > 0 && (
            <span style={{ fontSize: 12, background: '#ffebee', color: '#c62828', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
              ● {liveMatches.length} en direct
            </span>
          )}
          <button onClick={init} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* Scores */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[{ nom: JOUEUR1, score: score1, id: 'joueur1' }, { nom: JOUEUR2, score: score2, id: 'joueur2' }].map(j => {
          const lead = (j.id === 'joueur1' && score1 > score2) || (j.id === 'joueur2' && score2 > score1)
          return (
            <div key={j.id} style={{
              flex: 1, borderRadius: 14, padding: '16px 20px', textAlign: 'center',
              background: lead ? '#e8f5e9' : '#f5f5f5',
              border: lead ? '2px solid #66bb6a' : '1px solid #e0e0e0'
            }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{j.nom}</div>
              <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1 }}>{j.score}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 5 }}>points</div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { id: 'tournois', label: '📅 Tournois' },
          { id: 'live', label: `🔴 En direct${liveMatches.length ? ` (${liveMatches.length})` : ''}` },
          { id: 'classement', label: '🏆 Classement' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? '#1a1a1a' : '#eee', color: activeTab === tab.id ? '#fff' : '#444' }}>
            {tab.label}
          </button>
        ))}
        {activeTab === 'tournois' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
            {['TOUS', 'ATP', 'WTA'].map(f => (
              <button key={f} onClick={() => setCircuitFilter(f)}
                style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12, background: circuitFilter === f ? '#1565c0' : '#fff', color: circuitFilter === f ? '#fff' : '#555' }}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎾</div>
          <div>Chargement des tournois...</div>
        </div>
      )}

      {/* Onglet Tournois */}
      {activeTab === 'tournois' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTournaments.map(t => {
            const td = tournamentData[t.id]
            const winner = td?.winner
            const p1 = getPari(t.id, 'joueur1')
            const p2 = getPari(t.id, 'joueur2')
            const catStyle = CAT_COLORS[t.category] || { bg: '#f5f5f5', color: '#333' }
            const p1ok = winner && p1.toLowerCase().trim() === winner.toLowerCase().trim()
            const p2ok = winner && p2.toLowerCase().trim() === winner.toLowerCase().trim()
            return (
              <div key={t.id} style={{
                border: `1px solid ${winner ? '#c8e6c9' : '#e0e0e0'}`,
                borderRadius: 12, padding: '12px 16px',
                background: winner ? '#f9fff9' : '#fff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, borderRadius: 4, padding: '2px 7px', background: catStyle.bg, color: catStyle.color, fontWeight: 500 }}>{t.category}</span>
                      <span style={{ fontSize: 11, borderRadius: 4, padding: '2px 7px', background: '#f0f0f0', color: '#555' }}>{t.pts} pts</span>
                    </div>
                  </div>
                  {winner ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#666' }}>Vainqueur</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>🏆 {winner}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#aaa', alignSelf: 'center' }}>À venir</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <PariInput
                    label={JOUEUR1}
                    value={p1}
                    disabled={!!winner}
                    correct={p1ok}
                    wrong={!!winner && !!p1 && !p1ok}
                    onSave={v => placerPari(t.id, t.name, 'joueur1', v)}
                  />
                  <PariInput
                    label={JOUEUR2}
                    value={p2}
                    disabled={!!winner}
                    correct={p2ok}
                    wrong={!!winner && !!p2 && !p2ok}
                    onSave={v => placerPari(t.id, t.name, 'joueur2', v)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Onglet Live */}
      {activeTab === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {liveMatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎾</div>
              Aucun match en direct pour le moment
            </div>
          ) : liveMatches.map(m => (
            <div key={m.id} style={{ border: '1px solid #ffcdd2', borderRadius: 12, padding: '12px 16px', background: '#fff8f8' }}>
              <div style={{ fontSize: 11, color: '#e53935', fontWeight: 600, marginBottom: 8 }}>
                ● EN DIRECT — {m.tournament?.name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: m.winnerCode === 1 ? 700 : 400, marginBottom: 4 }}>
                    {m.homeTeam?.name}
                    {m.firstToServe === 1 && <span style={{ marginLeft: 5, fontSize: 11 }}>🎾</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: m.winnerCode === 2 ? 700 : 400 }}>
                    {m.awayTeam?.name}
                    {m.firstToServe === 2 && <span style={{ marginLeft: 5, fontSize: 11 }}>🎾</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 60 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                    {m.homeScore?.current ?? '—'}–{m.awayScore?.current ?? '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>sets</div>
                </div>
                {/* Détail des sets */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(s => {
                    const h = m.homeScore?.[`period${s}`]
                    const a = m.awayScore?.[`period${s}`]
                    if (h == null) return null
                    return (
                      <div key={s} style={{ textAlign: 'center', fontSize: 13 }}>
                        <div style={{ fontWeight: h > a ? 700 : 400 }}>{h}</div>
                        <div style={{ fontWeight: a > h ? 700 : 400 }}>{a}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onglet Classement */}
      {activeTab === 'classement' && (
        <div>
          {TOURNAMENTS_CONFIG.filter(t => tournamentData[t.id]?.winner).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
              Aucun tournoi terminé pour l'instant
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '9px 12px', textAlign: 'left' }}>Tournoi</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center' }}>Catégorie</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center' }}>Vainqueur</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center' }}>{JOUEUR1}</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center' }}>{JOUEUR2}</th>
                </tr>
              </thead>
              <tbody>
                {TOURNAMENTS_CONFIG.filter(t => tournamentData[t.id]?.winner).map(t => {
                  const winner = tournamentData[t.id].winner
                  const p1 = getPari(t.id, 'joueur1')
                  const p2 = getPari(t.id, 'joueur2')
                  const ok1 = p1.toLowerCase().trim() === winner.toLowerCase().trim()
                  const ok2 = p2.toLowerCase().trim() === winner.toLowerCase().trim()
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{t.name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: '#666' }}>{t.category}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{winner}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: ok1 ? '#2e7d32' : p1 ? '#c62828' : '#aaa', fontWeight: ok1 ? 700 : 400 }}>
                        {p1 || '—'} {ok1 && <span style={{ fontSize: 11 }}>+{t.pts}</span>}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: ok2 ? '#2e7d32' : p2 ? '#c62828' : '#aaa', fontWeight: ok2 ? 700 : 400 }}>
                        {p2 || '—'} {ok2 && <span style={{ fontSize: 11 }}>+{t.pts}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f5f5f5', fontWeight: 700 }}>
                  <td colSpan={3} style={{ padding: '10px 12px' }}>Total</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 16 }}>{score1} pts</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 16 }}>{score2} pts</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function PariInput({ label, value, onSave, disabled, correct, wrong }) {
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  const bg = correct ? '#e8f5e9' : wrong ? '#ffebee' : '#fff'
  const border = correct ? '#a5d6a7' : wrong ? '#ef9a9a' : '#ddd'
  return (
    <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center', minWidth: 200 }}>
      <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', minWidth: 60 }}>{label} :</span>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={disabled ? (value || 'Terminé') : 'Ex: Sinner'}
        disabled={disabled}
        style={{ flex: 1, padding: '5px 9px', borderRadius: 7, border: `1px solid ${border}`, fontSize: 13, background: bg, color: disabled ? '#555' : '#000' }}
      />
      {!disabled && (
        <button onClick={() => val.trim() && onSave(val.trim())}
          style={{ padding: '5px 11px', borderRadius: 7, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
          ✓
        </button>
      )}
      {correct && <span style={{ fontSize: 16 }}>✅</span>}
      {wrong && <span style={{ fontSize: 16 }}>❌</span>}
    </div>
  )
}
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
