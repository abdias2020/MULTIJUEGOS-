import fetch from 'node-fetch';
import axios from 'axios';

const userRequests = {};
const TIMEOUT = 20000; // 20 segundos
const API_KEY = 'RrSyVm056GfAhjuM'; // 🔑 API KEY de Ultraplus
const youtubeRegexID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/;

// Headers para evitar bloqueo de Cloudflare
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Referer': 'https://api-nv.ultraplus.click/',
  'Origin': 'https://api-nv.ultraplus.click',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

let handler = async (m, { conn, text, args, usedPrefix, command }) => {
  console.log('🎵 Comando ejecutado:', command);
  console.log('📝 Args:', args);
  console.log('👤 Usuario:', m.sender);

  // Validación de entrada
  if (!args[0]) {
    return m.reply(
      `*🤔 ¿Qué estás buscando?*\n\n` +
      `Ejemplos de uso:\n` +
      `• ${usedPrefix + command} https://youtu.be/ejemplo\n` +
      `• ${usedPrefix + command} Nombre de la canción\n` +
      `• ${usedPrefix + command} 1 (si buscaste antes)\n\n` +
      `_Ingresa el enlace de YouTube o el nombre de la canción_`
    );
  }

  // Control de solicitudes simultáneas
  if (userRequests[m.sender]) {
    return m.reply(
      `⏳ *Espera...* Ya hay una descarga en proceso.\n\n` +
      `Por favor, espera a que termine antes de hacer otra solicitud.`
    );
  }

  userRequests[m.sender] = true;

  try {
    const sendType = command.includes('doc') ? 'document' : 
                     command.includes('mp3') ? 'audio' : 'video';
    
    const isAudio = ['ytmp3', 'fgmp3', 'ytmp3doc', 'dlmp3'].includes(command);
    const isVideo = ['ytmp4', 'fgmp4', 'ytmp4doc'].includes(command);

    // Obtener URL de YouTube
    let youtubeLink = await getYouTubeLink(args, m);
    if (!youtubeLink) {
      return m.reply('❌ No se pudo obtener el enlace de YouTube. Verifica tu búsqueda.');
    }

    console.log('🔗 URL obtenida:', youtubeLink);

    // Buscar información del video
    const videoInfo = await obtenerInfoVideo(youtubeLink);

    if (!videoInfo) {
      return m.reply('❌ No se encontró información del video. Intenta con otro enlace.');
    }

    console.log('📺 Video encontrado:', videoInfo.titulo);

    // Mensajes de proceso
    if (isAudio) {
      await m.reply(
        `🎵 *Descargando Audio*\n\n` +
        `📌 *Título:* ${videoInfo.titulo}\n` +
        `👤 *Canal:* ${videoInfo.canal}\n` +
        `⏱️ *Duración:* ${videoInfo.duracion}\n` +
        `👁️ *Vistas:* ${formatNumber(videoInfo.vistas)}\n\n` +
        `⏳ _Procesando audio, espera un momento..._`
      );
    } else if (isVideo) {
      await m.reply(
        `🎬 *Descargando Video*\n\n` +
        `📌 *Título:* ${videoInfo.titulo}\n` +
        `👤 *Canal:* ${videoInfo.canal}\n` +
        `⏱️ *Duración:* ${videoInfo.duracion}\n` +
        `👁️ *Vistas:* ${formatNumber(videoInfo.vistas)}\n\n` +
        `⏳ _Procesando video, espera un momento..._`
      );
    }

    // Descargar contenido
    if (isAudio) {
      await downloadAudio(conn, m, youtubeLink, videoInfo, sendType);
    } else if (isVideo) {
      await downloadVideo(conn, m, youtubeLink, videoInfo, sendType);
    }

  } catch (error) {
    console.error('❌ Error general:', error);
    await m.reply(
      `🚫 *Ocurrió un error al procesar tu solicitud*\n\n` +
      `*Error:* ${error.message}\n\n` +
      `_Intenta con otro enlace o nombre de canción_`
    );
    m.react('❌');
  } finally {
    delete userRequests[m.sender];
    console.log('🧹 Solicitud limpiada para:', m.sender);
  }
};

// ===============================
// FUNCIONES AUXILIARES
// ===============================

/**
 * Limpia la URL de YouTube removiendo parámetros innecesarios
 */
function cleanYouTubeUrl(url) {
  const videoIdMatch = url.match(youtubeRegexID);
  if (videoIdMatch) {
    return `https://youtu.be/${videoIdMatch[1]}`;
  }
  return url;
}

/**
 * Obtiene el enlace de YouTube desde args
 */
async function getYouTubeLink(args, m) {
  try {
    // Si es un enlace directo
    const videoIdMatch = args[0].match(youtubeRegexID);
    if (videoIdMatch) {
      return `https://youtu.be/${videoIdMatch[1]}`;
    }

    // Si es un número de índice
    const index = parseInt(args[0]) - 1;
    if (!isNaN(index) && index >= 0) {
      if (Array.isArray(global.videoList) && global.videoList.length > 0) {
        const matchingItem = global.videoList.find(item => item.from === m.sender);
        if (matchingItem && matchingItem.urls[index]) {
          return cleanYouTubeUrl(matchingItem.urls[index]);
        }
      }
      throw new Error('No se encontró un enlace para ese número');
    }

    // Si es una búsqueda por nombre
    const searchQuery = args.join(' ');
    const results = await buscarEnYouTube(searchQuery);
    
    if (results && results.length > 0) {
      return cleanYouTubeUrl(results[0].url);
    }

    return null;
  } catch (error) {
    console.error('Error en getYouTubeLink:', error);
    return null;
  }
}

/**
 * Busca videos en YouTube usando API Ultraplus
 */
async function buscarEnYouTube(query) {
  try {
    const url = `https://api-nv.ultraplus.click/api/youtube/search?q=${encodeURIComponent(query)}&key=${API_KEY}`;
    console.log('🔍 Buscando:', url);
    
    const { data } = await axios.get(url, { 
      timeout: TIMEOUT,
      headers: HEADERS,
      validateStatus: (status) => status < 500 // Aceptar 4xx para manejarlos
    });
    
    console.log('📊 Resultado búsqueda:', data);
    
    if (data.status && data.Result && data.Result.length > 0) {
      return data.Result;
    }
    return null;
  } catch (err) {
    console.error('⚠️ Error en búsqueda de YouTube:', err.message);
    if (err.response) {
      console.error('Respuesta de error:', err.response.status, err.response.data);
    }
    return null;
  }
}

/**
 * Obtiene información de un video usando API Ultraplus
 */
async function obtenerInfoVideo(videoUrl) {
  try {
    // Limpiar la URL antes de hacer la petición
    const cleanUrl = cleanYouTubeUrl(videoUrl);
    const url = `https://api-nv.ultraplus.click/api/youtube/info?url=${encodeURIComponent(cleanUrl)}&key=${API_KEY}`;
    
    console.log('🔍 Obteniendo info de:', cleanUrl);
    console.log('📡 URL de petición:', url);
    
    // Pequeña pausa para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { data } = await axios.get(url, { 
      timeout: TIMEOUT,
      headers: HEADERS,
      validateStatus: (status) => status < 500,
      maxRedirects: 5
    });
    
    console.log('📊 Respuesta de info:', JSON.stringify(data, null, 2));
    
    if (data.status && data.Result) {
      return data.Result;
    }
    
    console.error('⚠️ Respuesta sin resultado válido');
    return null;
  } catch (err) {
    console.error('⚠️ Error obteniendo info del video:', err.message);
    if (err.response) {
      console.error('📋 Status:', err.response.status);
      console.error('📋 Data:', typeof err.response.data === 'string' ? err.response.data.substring(0, 500) : err.response.data);
    }
    return null;
  }
}

/**
 * Descarga audio usando API Ultraplus
 */
async function downloadAudio(conn, m, url, videoInfo, sendType) {
  try {
    console.log('🔄 Descargando audio desde Ultraplus API...');
    
    // Limpiar URL antes de descargar
    const cleanUrl = cleanYouTubeUrl(url);
    const downloadUrl = `https://api-nv.ultraplus.click/api/dl/yt-direct?url=${encodeURIComponent(cleanUrl)}&type=audio&key=${API_KEY}`;
    
    console.log('📡 URL de descarga:', downloadUrl);
    
    // Pequeña pausa antes de descargar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { data } = await axios.get(downloadUrl, { 
      timeout: TIMEOUT * 2, // Más tiempo para descarga
      headers: HEADERS,
      validateStatus: (status) => status < 500
    });
    
    console.log('📊 Respuesta descarga audio:', JSON.stringify(data, null, 2));
    
    if (!data.status || !data.Result?.download) {
      throw new Error('No se pudo obtener el enlace de descarga de audio');
    }

    const audioUrl = data.Result.download;
    
    console.log('🎵 URL de audio:', audioUrl);
    
    console.log('✅ Audio obtenido correctamente');
    console.log('📤 Enviando audio...');

    // Enviar audio
    await conn.sendMessage(
      m.chat,
      {
        [sendType]: { url: audioUrl },
        mimetype: 'audio/mpeg',
        fileName: `${sanitizeFilename(videoInfo.titulo)}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: videoInfo.titulo,
            body: videoInfo.canal,
            thumbnailUrl: videoInfo.miniatura,
            sourceUrl: url,
            mediaType: 1,
            showAdAttribution: false,
            renderLargerThumbnail: true
          }
        }
      },
      { quoted: m }
    );

    m.react('✅');
    console.log('✅ Audio enviado correctamente');

  } catch (error) {
    console.error('❌ Error descargando audio:', error.message);
    throw new Error(`No se pudo descargar el audio: ${error.message}`);
  }
}

/**
 * Descarga video usando API Ultraplus
 */
async function downloadVideo(conn, m, url, videoInfo, sendType) {
  try {
    console.log('🔄 Descargando video desde Ultraplus API...');
    
    // Limpiar URL antes de descargar
    const cleanUrl = cleanYouTubeUrl(url);
    const downloadUrl = `https://api-nv.ultraplus.click/api/dl/yt-direct?url=${encodeURIComponent(cleanUrl)}&type=video&key=${API_KEY}`;
    
    console.log('📡 URL de descarga:', downloadUrl);
    
    // Pequeña pausa antes de descargar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { data } = await axios.get(downloadUrl, { 
      timeout: TIMEOUT * 2,
      headers: HEADERS,
      validateStatus: (status) => status < 500
    });
    
    console.log('📊 Respuesta descarga video:', JSON.stringify(data, null, 2));
    
    if (!data.status || !data.Result?.download) {
      throw new Error('No se pudo obtener el enlace de descarga de video');
    }

    const videoUrl = data.Result.download;
    
    console.log('🎬 URL de video:', videoUrl);
    
    console.log('✅ Video obtenido correctamente');
    console.log('📤 Enviando video...');

    // Enviar video
    await conn.sendMessage(
      m.chat,
      {
        [sendType]: { url: videoUrl },
        mimetype: 'video/mp4',
        fileName: `${sanitizeFilename(videoInfo.titulo)}.mp4`,
        caption: `🎬 *${videoInfo.titulo}*\n👤 ${videoInfo.canal}\n⏱️ ${videoInfo.duracion}`,
        contextInfo: {
          externalAdReply: {
            title: videoInfo.titulo,
            body: videoInfo.canal,
            thumbnailUrl: videoInfo.miniatura,
            sourceUrl: url,
            mediaType: 2
          }
        }
      },
      { quoted: m }
    );

    m.react('✅');
    console.log('✅ Video enviado correctamente');

  } catch (error) {
    console.error('❌ Error descargando video:', error.message);
    throw new Error(`No se pudo descargar el video: ${error.message}`);
  }
}

/**
 * Valida si una URL es reproducible
 */
async function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: HEADERS
    });

    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') || '';
    const isValid = res.ok && (
      contentType.includes('audio') ||
      contentType.includes('video') ||
      contentType.includes('octet-stream') ||
      contentType.includes('mpeg') ||
      contentType.includes('mp4')
    );

    console.log(`🔍 Validación - Status: ${res.status}, Type: ${contentType}, Valid: ${isValid}`);
    return isValid;
  } catch (error) {
    console.log('⚠️ Error validando URL:', error.message);
    return false;
  }
}

/**
 * Formatea números con separadores
 */
function formatNumber(n) {
  return n ? n.toLocaleString('es-ES') : '0';
}

/**
 * Limpia nombres de archivo
 */
function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 180);
}

// Configuración del handler
handler.help = ['ytmp3', 'ytmp4', 'fgmp3', 'fgmp4'];
handler.tags = ['downloader'];
handler.command = /^(ytmp3|ytmp4|fgmp4|fgmp3|dlmp3|ytmp4doc|ytmp3doc)$/i;

export default handler;