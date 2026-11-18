import { Innertube } from 'youtubei.js';

let cachedClient = null;

export async function getYtClient() {
  try {
    if (cachedClient) return cachedClient;
    
    // Paksa pakai client WEB yang paling stabil
    const yt = await Innertube.create({
      client_type: 'WEB',
      generate_session_locally: true
    });
    
    cachedClient = yt;
    return yt;
  } catch (error) {
    console.error("Innertube Init Error:", error);
    throw new Error("Gagal inisialisasi YouTube Engine");
  }
}