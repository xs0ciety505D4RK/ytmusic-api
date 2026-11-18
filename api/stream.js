import { getYtClient } from './_lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ success: false, error: 'ID Video wajib diisi' });

  try {
    const yt = await getYtClient();
    
    // 1. Ambil info dasar dulu untuk efisiensi
    const info = await yt.getBasicInfo(id, { client: 'WEB_CREATOR' }); // Ganti client ke WEB_CREATOR
    
    // 2. Cek status playability (apakah video bisa diputar?)
    if (info.playability_status?.status !== 'OK') {
      throw new Error(`Video tidak dapat diputar: ${info.playability_status?.reason || 'Unknown reason'}`);
    }

    // 3. Pastikan streaming_data ada
    if (!info.streaming_data) {
      throw new Error('Streaming data tidak tersedia dari YouTube.');
    }

    // 4. Cari format audio di adaptive_formats
    const audioFormat = info.streaming_data.adaptive_formats.find(
      (format) => format.mime_type.includes('audio')
    );

    if (!audioFormat) {
      throw new Error('Format audio tidak ditemukan.');
    }

    // 5. Dekripsi URL dan stream
    const streamUrl = audioFormat.decipher(yt.session.player);

    const response = await fetch(streamUrl, {
      headers: {
        'Range': req.headers.range || 'bytes=0-',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`YouTube Error: ${response.status} ${response.statusText}`);
    }

    res.status(response.status);
    res.setHeader('Content-Type', audioFormat.mime_type || 'audio/webm');
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
    console.error("Stream Proxy Error:", error.message);
    if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
    else res.end();
  }
}