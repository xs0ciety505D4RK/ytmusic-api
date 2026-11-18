import { getYtClient } from './_lib/ytmusic.js';
import translate from 'google-translate-api-x';

function parseLRC(lrcString) {
  if (!lrcString) return [];
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
  return lyrics.sort((a, b) => a.time - b.time);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, translate: shouldTranslate, lang } = req.query;
  if (!id) return res.status(400).json({ success: false, error: 'ID Video wajib diisi' });

  try {
    const yt = await getYtClient();
    const info = await yt.music.getInfo(id);
    
    const title = info.basic_info.title;
    const artist = info.basic_info.author;
    const duration = info.basic_info.duration;

    // 1. Tarik dari LRCLib
    let lrclibRes = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}&duration=${duration}`
    );
    
    let parsedLyrics = [];

    if (lrclibRes.ok) {
      const lrclibData = await lrclibRes.json();
      parsedLyrics = parseLRC(lrclibData.syncedLyrics);
    }

    // 2. Fallback ke YT Music jika LRCLib gagal/kosong
    if (parsedLyrics.length === 0) {
      try {
        const ytLyrics = await yt.music.getLyrics(id);
        if (ytLyrics && ytLyrics.description) {
          // YT Music kadang ngasih plain text, kita bikin time dummy 0
          const textLines = ytLyrics.description.toString().split('\n');
          parsedLyrics = textLines.map(text => ({ time: 0, text: text.trim() })).filter(l => l.text);
        }
      } catch (e) {
        console.error("YT Lyrics Fallback Error:", e.message);
      }
    }

    if (parsedLyrics.length === 0) {
      return res.status(404).json({ success: false, error: 'Lirik tidak ditemukan di database manapun.' });
    }

    // 3. Proses Translate
    if (shouldTranslate === 'true' && lang) {
      const translationPromises = parsedLyrics.map(async (line) => {
        try {
          const result = await translate(line.text, { to: lang });
          return { ...line, text: result.text, originalText: line.text };
        } catch (e) {
          return line; // Return teks asli jika gagal translate
        }
      });
      parsedLyrics = await Promise.all(translationPromises);
    }

    res.status(200).json({
      success: true,
      synced: parsedLyrics.length > 1,
      translated: shouldTranslate === 'true',
      language: lang || 'original',
      lyrics: parsedLyrics
    });

  } catch (error) {
    console.error("Lyrics API Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}