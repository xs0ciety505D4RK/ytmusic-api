import { getYtClient } from './_lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ success: false, error: 'ID Video wajib diisi' });

  try {
    const yt = await getYtClient();
    const info = await yt.getInfo(id);
    
    // Pilih format audio
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    if (!format) throw new Error('Format audio tidak tersedia');

    // Decrypt URL menggunakan player
    const streamUrl = format.decipher(yt.session.player);

    // Ambil data stream dari URL YouTube
    const response = await fetch(streamUrl, {
      headers: {
        'Range': req.headers.range || 'bytes=0-',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) {
      throw new Error(`YouTube Error: ${response.status} ${response.statusText}`);
    }

    // Teruskan header status dan Content-Range agar bisa di-seek
    res.status(response.status);
    res.setHeader('Content-Type', format.mime_type || 'audio/webm');
    
    if (response.headers.get('content-range')) {
      res.setHeader('Content-Range', response.headers.get('content-range'));
    }
    if (response.headers.get('content-length')) {
      res.setHeader('Content-Length', response.headers.get('content-length'));
    }
    res.setHeader('Accept-Ranges', 'bytes');

    // Pipe data stream dari YouTube ke Frontend
    const reader = response.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) return res.end();
      res.write(value);
      await pump();
    };
    
    await pump();

  } catch (error) {
    console.error("Stream Proxy Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.end();
    }
  }
}