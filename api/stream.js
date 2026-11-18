import { getYtClient } from './_lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ success: false, error: 'ID Video wajib diisi' });

  try {
    const yt = await getYtClient();
    const info = await yt.getInfo(id);
    
    if (!info.streaming_data) {
      throw new Error('Streaming data tidak tersedia. IP Vercel diblokir YouTube.');
    }

    // Cari format audio di adaptive_formats
    const format = info.streaming_data.adaptive_formats.find(
      (f) => f.mime_type.includes('audio')
    );

    if (!format) throw new Error('Format audio tidak ditemukan.');

    const streamUrl = format.decipher(yt.session.player);

    const response = await fetch(streamUrl, {
      headers: {
        'Range': req.headers.range || 'bytes=0-',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`YouTube Error: ${response.status}`);
    }

    res.status(response.status);
    res.setHeader('Content-Type', format.mime_type || 'audio/webm');
    if (response.headers.get('content-range')) res.setHeader('Content-Range', response.headers.get('content-range'));
    if (response.headers.get('content-length')) res.setHeader('Content-Length', response.headers.get('content-length'));
    res.setHeader('Accept-Ranges', 'bytes');

    const reader = response.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) return res.end();
      res.write(value);
      await pump();
    };
    await pump();

  } catch (error) {
    console.error("Stream Error:", error.message);
    if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
    else res.end();
  }
}