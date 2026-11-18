import { getYtClient } from './_lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ success: false, error: 'Parameter "id" (Video ID) wajib diisi' });

  try {
    const yt = await getYtClient();
    const info = await yt.getInfo(id);
    
    // Pilih format audio terbaik (opus/mp4)
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    
    if (!format) throw new Error('Format audio tidak tersedia');

    // Dekripsi URL agar bisa diputar
    const streamUrl = format.decipher(yt.session.player);

    res.status(200).json({
      success: true,
      url: streamUrl,
      mimeType: format.mime_type,
      bitrate: format.bitrate,
      title: info.basic_info.title,
      author: info.basic_info.author,
      duration: info.basic_info.duration
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}