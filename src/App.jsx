import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const JOUEUR1 = import.meta.env.VITE_NOM_JOUEUR1 || 'Joueur 1'
const JOUEUR2 = import.meta.env.VITE_NOM_JOUEUR2 || 'Joueur 2'
const BASE = 'https://api.sofascore.com/api/v1'

// Tournois ATP/WTA qu'on veut afficher (filtre les Challengers, ITF, etc.)
const CATEGORIES_OK = [
  'atp', 'wta', 'grand slam', 'masters', 'atp singles', 'wta singles'
]

// Points selon catégorie tournoi × tour
const TOUR_MULTIPLIER = {
  'F': 3, 'SF': 2, 'QF': 1.5, 'R16': 1, 'R32': 1, 'R64': 1, 'R128': 1
}
function getTourPts(categoryName, roundName) {
  const name = categoryName?.toLowerCase() || ''
  let base = 5
  if (name.includes('grand slam')) base = 30
  else if (name.includes('1000') || name.includes('masters')) base = 20
  else if (name.includes('500')) base = 15
  else if (name.includes('250')) base = 10
  const round = roundName?.toUpperCase() || ''
  const mult = Object.entries(TOUR_MULTIPLIER).find(([k]) => round.includes(k))?.[1] ?? 1
  return Math.round(base * mult)
}

function isAtpWta(event) {
  const cat = (
    event?.tournament?.uniqueTournament?.primaryColorHex ||
    event?.tournament?.category?.sport?.name || ''
  ).toLowerCase()
  const name = (event?.tournament?.name || '').toLowerCase()
  const uniqueName = (event?.tournament?.uniqueTournament?.name || '').toLowerCase()
  // Garde seulement les tournois ATP/WTA principaux
  if (name.includes('challenger') || name.includes('itf') || name.includes('doubles')) return false
  if (uniqueName.includes('challenger') || uniqueName.includes('itf') || uniqueName.includes('doubles')) return false
  return true
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function dateLabel(offset) {
  if (offset === 0) return "Aujourd'hui"
  if (offset === -1) return 'Hier'
  if (offset === 1) return 'Demain'
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function App() {
  const [dateOffset, setDateOffset] = useState(0)
  const [matches, setMatches] = useState([]) // matchs du jour groupés par tournoi
  const [paris, setParis] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('matchs')
  const [refreshing, setRefreshing] = useState(false)

  const currentDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + dateOffset)
    return formatDate(d)
  })()

  const loadMatches = useCallback(async (date) => {
    try {
      const res = await fetch(`/api/tennis?date=${date}`)
      const data = await res.json()
      const events = (data.events || []).filter(isAtpWta)
      setMatches(events)
      // Sauvegarde les résultats terminés en base
      await saveResults(events)
    } catch (e) {
      console.warn('Erreur chargement matchs:', e.message)
    }
  }, [])

  async function saveResults(events) {
    const finished = events.filter(e => e.status?.type === 'finished')
    for (const e of finished) {
      const winner = e.winnerCode === 1 ? e.homeTeam?.name : e.awayTeam?.name
      if (!winner) continue
      try {
        const { data: existing } = await supabase.from('resultats').select('id').eq('tournament_id', String(e.id)).maybeSingle()
        if (existing) {
          await supabase.from('resultats').update({ vainqueur: winner, statut: 'finished' }).eq('tournament_id', String(e.id))
        } else {
          await supabase.from('resultats').insert({
            tournament_id: String(e.id),
            tournament_name: `${e.homeTeam?.name} vs ${e.awayTeam?.name}`,
            vainqueur: winner,
            statut: 'finished'
          })
        }
      } catch {}
    }
  }

  async function loadParis() {
    const { data } = await supabase.from('paris').select('*')
    setParis(data || [])
  }

  async function refresh() {
    setRefreshing(true)
    await Promise.all([loadMatches(currentDate), loadParis()])
    setRefreshing(false)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadMatches(currentDate), loadParis()]).then(() => setLoading(false))
    const iv = setInterval(() => loadMatches(currentDate), 60000)
    return () => clearInterval(iv)
  }, [currentDate, loadMatches])

  async function placerPari(matchId, matchLabel, joueur, nomParie) {
    const existing = paris.find(p => p.tournament_id === String(matchId) && p.joueur === joueur)
    if (existing) {
      await supabase.from('paris').update({ pari: nomParie }).eq('id', existing.id)
    } else {
      await supabase.from('paris').insert({
        tournament_id: String(matchId),
        tournament_name: matchLabel,
        joueur,
        pari: nomParie
      })
    }
    loadParis()
  }

  function getPari(matchId, joueur) {
    return paris.find(p => p.tournament_id === String(matchId) && p.joueur === joueur)?.pari || ''
  }

  function getWinner(event) {
    if (event.status?.type !== 'finished') return null
    return event.winnerCode === 1 ? event.homeTeam?.name : event.awayTeam?.name
  }

  // Grouper les matchs par tournoi
  const byTournament = matches.reduce((acc, m) => {
    const tName = m.tournament?.uniqueTournament?.name || m.tournament?.name || 'Autre'
    const tId = m.tournament?.uniqueTournament?.id || m.tournament?.id || 0
    if (!acc[tId]) acc[tId] = { name: tName, category: m.tournament?.uniqueTournament?.category?.name || '', matches: [] }
    acc[tId].matches.push(m)
    return acc
  }, {})

  // Calcul scores
  function calcScore(joueur) {
    let score = 0
    for (const m of matches) {
      const winner = getWinner(m)
      if (!winner) continue
      const pari = getPari(m.id, joueur)
      if (pari.toLowerCase().trim() === winner.toLowerCase().trim()) {
        score += getTourPts(
          m.tournament?.uniqueTournament?.name || '',
          m.roundInfo?.name || ''
        )
      }
    }
    return score
  }

  // Score total depuis Supabase (tous les matchs passés)
  const [totalScore1, setTotalScore1] = useState(0)
  const [totalScore2, setTotalScore2] = useState(0)
  useEffect(() => {
    async function calcTotal() {
      const { data: resultats } = await supabase.from('resultats').select('*').eq('statut', 'finished')
      if (!resultats) return
      let s1 = 0, s2 = 0
      for (const r of resultats) {
        const p1 = paris.find(p => p.tournament_id === r.tournament_id && p.joueur === 'joueur1')
        const p2 = paris.find(p => p.tournament_id === r.tournament_id && p.joueur === 'joueur2')
        if (p1?.pari?.toLowerCase().trim() === r.vainqueur?.toLowerCase().trim()) s1 += 5
        if (p2?.pari?.toLowerCase().trim() === r.vainqueur?.toLowerCase().trim()) s2 += 5
      }
      setTotalScore1(s1)
      setTotalScore2(s2)
    }
    calcTotal()
  }, [paris])

  const score1today = calcScore('joueur1')
  const score2today = calcScore('joueur2')

  const CAT_COLOR = (name = '') => {
    const n = name.toLowerCase()
    if (n.includes('grand slam') || n.includes('australian') || n.includes('roland') || n.includes('wimbledon') || n.includes('us open')) return { bg: '#fff3e0', color: '#e65100' }
    if (n.includes('1000') || n.includes('masters')) return { bg: '#e3f2fd', color: '#0d47a1' }
    if (n.includes('500')) return { bg: '#e8f5e9', color: '#1b5e20' }
    if (n.includes('wta')) return { bg: '#fce4ec', color: '#880e4f' }
    return { bg: '#f3e5f5', color: '#4a148c' }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto', padding: '1rem 1.25rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🎾 Tennis Paris</h1>
        <button onClick={refresh} disabled={refreshing}
          style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
          {refreshing ? '...' : '🔄 Actualiser'}
        </button>
      </div>

      {/* Scores totaux */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { nom: JOUEUR1, total: totalScore1, today: score1today, id: 'joueur1' },
          { nom: JOUEUR2, total: totalScore2, today: score2today, id: 'joueur2' }
        ].map(j => {
          const lead = (j.id === 'joueur1' && totalScore1 > totalScore2) || (j.id === 'joueur2' && totalScore2 > totalScore1)
          return (
            <div key={j.id} style={{
              flex: 1, borderRadius: 14, padding: '14px 18px', textAlign: 'center',
              background: lead ? '#e8f5e9' : '#f5f5f5',
              border: lead ? '2px solid #66bb6a' : '1px solid #e0e0e0'
            }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{j.nom}</div>
              <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{j.total}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                pts totaux {j.today > 0 && <span style={{ color: '#43a047' }}>(+{j.today} aujourd'hui)</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { id: 'matchs', label: '🎾 Matchs' },
          { id: 'classement', label: '🏆 Classement' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              background: activeTab === tab.id ? '#1a1a1a' : '#eee',
              color: activeTab === tab.id ? '#fff' : '#444' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Navigation dates */}
      {activeTab === 'matchs' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <button onClick={() => setDateOffset(d => d - 1)}
            style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 14 }}>‹</button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: 15 }}>
            {dateLabel(dateOffset)}
            <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>{currentDate}</span>
          </div>
          <button onClick={() => setDateOffset(d => d + 1)}
            style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 14 }}>›</button>
        </div>
      )}

      {/* Onglet Matchs */}
      {activeTab === 'matchs' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>🎾</div>
              Chargement des matchs...
            </div>
          ) : Object.keys(byTournament).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>📅</div>
              Aucun match ATP/WTA ce jour
            </div>
          ) : Object.entries(byTournament).map(([tId, t]) => {
            const catStyle = CAT_COLOR(t.name)
            return (
              <div key={tId} style={{ marginBottom: 20 }}>
                {/* Header tournoi */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</span>
                  <span style={{ fontSize: 11, borderRadius: 4, padding: '2px 7px', background: catStyle.bg, color: catStyle.color, fontWeight: 500 }}>{t.category}</span>
                </div>
                {/* Matchs du tournoi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {t.matches.map(m => {
                    const winner = getWinner(m)
                    const isLive = m.status?.type === 'inprogress'
                    const p1 = getPari(m.id, 'joueur1')
                    const p2 = getPari(m.id, 'joueur2')
                    const p1ok = winner && p1.toLowerCase().trim() === winner.toLowerCase().trim()
                    const p2ok = winner && p2.toLowerCase().trim() === winner.toLowerCase().trim()
                    const pts = getTourPts(t.name, m.roundInfo?.name)
                    const homeScore = m.homeScore
                    const awayScore = m.awayScore
                    return (
                      <div key={m.id} style={{
                        border: `1px solid ${isLive ? '#ffcdd2' : winner ? '#c8e6c9' : '#e0e0e0'}`,
                        borderRadius: 10, padding: '12px 14px',
                        background: isLive ? '#fff8f8' : winner ? '#f9fff9' : '#fff'
                      }}>
                        {/* Infos match */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                          <div style={{ flex: 1 }}>
                            {/* Tour */}
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>
                              {m.roundInfo?.name || 'Match'}
                              {' · '}{pts} pts
                              {isLive && <span style={{ marginLeft: 6, color: '#e53935', fontWeight: 600 }}>● EN DIRECT</span>}
                            </div>
                            {/* Joueurs + score */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: m.winnerCode === 1 ? 700 : 400, marginBottom: 3 }}>
                                  {m.firstToServe === 1 && <span style={{ fontSize: 10, marginRight: 4 }}>🎾</span>}
                                  {m.homeTeam?.name}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: m.winnerCode === 2 ? 700 : 400 }}>
                                  {m.firstToServe === 2 && <span style={{ fontSize: 10, marginRight: 4 }}>🎾</span>}
                                  {m.awayTeam?.name}
                                </div>
                              </div>
                              {/* Score sets */}
                              {(isLive || winner) && homeScore && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                  {/* Sets joués */}
                                  {[1,2,3,4,5].map(s => {
                                    const h = homeScore[`period${s}`]
                                    const a = awayScore?.[`period${s}`]
                                    if (h == null) return null
                                    return (
                                      <div key={s} style={{ textAlign: 'center', minWidth: 22 }}>
                                        <div style={{ fontSize: 14, fontWeight: h > a ? 700 : 400 }}>{h}</div>
                                        <div style={{ fontSize: 14, fontWeight: a > h ? 700 : 400 }}>{a}</div>
                                      </div>
                                    )
                                  })}
                                  {/* Score sets total */}
                                  <div style={{ textAlign: 'center', minWidth: 28, borderLeft: '1px solid #eee', paddingLeft: 8 }}>
                                    <div style={{ fontSize: 16, fontWeight: 800 }}>{homeScore.current ?? 0}</div>
                                    <div style={{ fontSize: 16, fontWeight: 800 }}>{awayScore?.current ?? 0}</div>
                                  </div>
                                </div>
                              )}
                              {!isLive && !winner && m.startTimestamp && (
                                <div style={{ fontSize: 13, color: '#888' }}>
                                  {new Date(m.startTimestamp * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Zone paris */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
                          <PariInput
                            label={JOUEUR1}
                            value={p1}
                            disabled={!!winner || isLive}
                            correct={p1ok}
                            wrong={!!winner && !!p1 && !p1ok}
                            placeholder={`Ex: ${m.homeTeam?.name?.split(' ')[0] || 'Joueur'}`}
                            onSave={v => placerPari(m.id, `${m.homeTeam?.name} vs ${m.awayTeam?.name}`, 'joueur1', v)}
                          />
                          <PariInput
                            label={JOUEUR2}
                            value={p2}
                            disabled={!!winner || isLive}
                            correct={p2ok}
                            wrong={!!winner && !!p2 && !p2ok}
                            placeholder={`Ex: ${m.awayTeam?.name?.split(' ')[0] || 'Joueur'}`}
                            onSave={v => placerPari(m.id, `${m.homeTeam?.name} vs ${m.awayTeam?.name}`, 'joueur2', v)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Onglet Classement */}
      {activeTab === 'classement' && (
        <ClassementTab paris={paris} JOUEUR1={JOUEUR1} JOUEUR2={JOUEUR2} />
      )}
    </div>
  )
}

function ClassementTab({ paris, JOUEUR1, JOUEUR2 }) {
  const [resultats, setResultats] = useState([])
  useEffect(() => {
    supabase.from('resultats').select('*').eq('statut', 'finished').order('updated_at', { ascending: false })
      .then(({ data }) => setResultats(data || []))
  }, [])

  let s1 = 0, s2 = 0
  return (
    <div>
      {resultats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🏆</div>
          Aucun match terminé avec un pari pour l'instant
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Match</th>
              <th style={{ padding: '9px 10px', textAlign: 'center' }}>Vainqueur</th>
              <th style={{ padding: '9px 10px', textAlign: 'center' }}>{JOUEUR1}</th>
              <th style={{ padding: '9px 10px', textAlign: 'center' }}>{JOUEUR2}</th>
            </tr>
          </thead>
          <tbody>
            {resultats.map(r => {
              const p1 = paris.find(p => p.tournament_id === r.tournament_id && p.joueur === 'joueur1')?.pari || ''
              const p2 = paris.find(p => p.tournament_id === r.tournament_id && p.joueur === 'joueur2')?.pari || ''
              const ok1 = p1.toLowerCase().trim() === r.vainqueur?.toLowerCase().trim()
              const ok2 = p2.toLowerCase().trim() === r.vainqueur?.toLowerCase().trim()
              if (ok1) s1 += 5
              if (ok2) s2 += 5
              return (
                <tr key={r.tournament_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 10px', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tournament_name}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12 }}>{r.vainqueur}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: ok1 ? '#2e7d32' : p1 ? '#c62828' : '#bbb', fontWeight: ok1 ? 700 : 400 }}>
                    {p1 || '—'} {ok1 ? '✅' : p1 ? '❌' : ''}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: ok2 ? '#2e7d32' : p2 ? '#c62828' : '#bbb', fontWeight: ok2 ? 700 : 400 }}>
                    {p2 || '—'} {ok2 ? '✅' : p2 ? '❌' : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f5f5f5', fontWeight: 700 }}>
              <td colSpan={2} style={{ padding: '10px' }}>Total</td>
              <td style={{ padding: '10px', textAlign: 'center', fontSize: 16 }}>{s1} pts</td>
              <td style={{ padding: '10px', textAlign: 'center', fontSize: 16 }}>{s2} pts</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

function PariInput({ label, value, onSave, disabled, correct, wrong, placeholder }) {
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  const border = correct ? '#a5d6a7' : wrong ? '#ef9a9a' : '#ddd'
  const bg = correct ? '#f1f8f1' : wrong ? '#fff5f5' : '#fff'
  return (
    <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center', minWidth: 180 }}>
      <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', minWidth: 55 }}>{label} :</span>
      <input value={val} onChange={e => setVal(e.target.value)}
        placeholder={disabled ? (value || '—') : placeholder}
        disabled={disabled}
        style={{ flex: 1, padding: '5px 9px', borderRadius: 7, border: `1px solid ${border}`, fontSize: 13, background: disabled ? '#fafafa' : bg, color: disabled ? '#666' : '#000' }} />
      {!disabled && (
        <button onClick={() => val.trim() && onSave(val.trim())}
          style={{ padding: '5px 11px', borderRadius: 7, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 13, cursor: 'pointer' }}>✓</button>
      )}
      {correct && <span>✅</span>}
      {wrong && <span>❌</span>}
    </div>
  )
}
