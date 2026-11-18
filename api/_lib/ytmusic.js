import { Innertube } from 'youtubei.js';

let cachedClient = null;

export async function getYtClient() {
  try {
    if (cachedClient) return cachedClient;
    
    // Ganti client ke WEB_REMIX yang lebih stabil untuk streaming musik
    const yt = await Innertube.create({
      client_type: 'WEB_REMIX',
      retrieve_player: true,
      generate_session_locally: true
    });
    
    cachedClient = yt;
    return yt;
  } catch (error) {
    console.error("Innertube Init Error:", error);
    throw new Error("Gagal inisialisasi YouTube Engine");
  }
}