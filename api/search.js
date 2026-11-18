import { getYtClient } from './_lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Parameter "q" wajib diisi' });

  try {
    const yt = await getYtClient();
    const searchResults = await yt.music.search(q, { type: 'song' });
    
    if (!searchResults.songs) {
      return res.status(404).json({ success: false, error: 'Lagu tidak ditemukan' });
    }

    const songs = searchResults.songs.contents.map(item => ({
      videoId: item.id,
      title: item.title,
      artist: item.artists?.map(a => a.name).join(', ') || 'Unknown',
      album: item.album?.name || null,
      duration: item.duration?.text || '0:00',
      thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || null,
    }));

    res.status(200).json({ success: true, data: songs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}