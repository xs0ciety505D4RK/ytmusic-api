// api/stream.js
import { getYtClient } from './_lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ success: false, error: 'Video ID required' });

  try {
    const yt = await getYtClient();
    
    // 1. Ambil info audio dengan client alternatif (misal ANDROID_VR atau WEB_REMIX)
    const info = await yt.getInfo(id, { client: 'ANDROID_VR' }); // Atau 'WEB_REMIX'
    
    // 2. Pilih format audio terbaik
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    if (!format) throw new Error('No audio format found');

    // 3. Dekripsi URL (butuh JS Player)
    const streamUrl = format.decipher(yt.session.player);

    // 4. Ambil data audio dari URL tersebut dan teruskan ke client
    const audioRes = await fetch(streamUrl);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);

    // 5. Set header yang sesuai
    res.setHeader('Content-Type', format.mime_type || 'audio/webm');
    res.setHeader('Content-Length', audioRes.headers.get('content-length') || '');

    // 6. Kirim stream audio ke client
    const reader = audioRes.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(value);
      await pump();
    };
    await pump();

  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}