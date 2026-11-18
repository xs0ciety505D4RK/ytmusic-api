import { getYtClient } from './_lib/ytmusic.js';
import translate from 'google-translate-api-x';

// Fungsi mem-parsing format LRC ke JSON
function parseLRC(lrcString) {
  const lines = lrcString.split('\n');
  const lyrics = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const milliseconds = parseInt(match[3].padEnd(3, '0'));
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      if (text) lyrics.push({ time, text });
    }
  }
  return lyrics;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, translate: shouldTranslate, lang } = req.query;

  if (!id) return res.status(400).json({ success: false, error: 'Parameter "id" wajib diisi' });

  try {
    const yt = await getYtClient();
    const info = await yt.music.getInfo(id);
    
    const title = info.basic_info.title;
    const artist = info.basic_info.author;
    const duration = info.basic_info.duration;

    // 1. Tarik data dari LRCLib (Database lirik sinkron terbesar)
    const lrclibRes = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}&duration=${duration}`
    );
    
    if (!lrclibRes.ok) {
      // Fallback: Jika tidak ada lirik sinkron, ambil teks biasa dari YT Music
      const ytLyrics = await yt.music.getLyrics(id);
      if (ytLyrics && ytLyrics.description) {
        return res.status(200).json({
          success: true,
          synced: false,
          lyrics: [{ time: 0, text: ytLyrics.description.toString() }],
          message: 'Lirik sinkron tidak ditemukan, menggunakan teks biasa.'
        });
      }
      return res.status(404).json({ success: false, error: 'Lirik tidak ditemukan' });
    }

    const lrclibData = await lrclibRes.json();
    let parsedLyrics = parseLRC(lrclibData.syncedLyrics || "");

    // 2. Fitur Translate (On/Off via parameter)
    if (shouldTranslate === 'true' && lang) {
      // Translate semua baris secara paralel agar cepat
      const translationPromises = parsedLyrics.map(async (line) => {
        try {
          const res = await translate(line.text, { to: lang });
          return { 
            ...line, 
            text: res.text, 
            originalText: line.text 
          };
        } catch (e) {
          return line; // Jika gagal translate 1 baris, kembalikan teks asli
        }
      });
      
      parsedLyrics = await Promise.all(translationPromises);
    }

    res.status(200).json({
      success: true,
      synced: true,
      translated: shouldTranslate === 'true',
      language: lang || 'original',
      lyrics: parsedLyrics
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}