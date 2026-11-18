import { Innertube } from 'youtubei.js';

let cachedClient = null;

export async function getYtClient() {
  try {
    if (cachedClient) return cachedClient;
    
    // Gunakan ANDROID_VR karena paling stabil dan tanpa PoToken
    const yt = await Innertube.create({
      client_type: 'ANDROID_VR',
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