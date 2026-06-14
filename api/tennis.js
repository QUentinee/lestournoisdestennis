export default async function handler(req, res) {
  const { date } = req.query
  if (!date) return res.status(400).json({ error: 'date manquante' })

  try {
    const response = await fetch(
      `https://api.sofascore.com/api/v1/sport/tennis/scheduled-events/${date}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Referer': 'https://www.sofascore.com/',
          'Origin': 'https://www.sofascore.com',
        }
      }
    )
    const data = await response.json()
    res.setHeader('Cache-Control', 's-maxage=60')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
