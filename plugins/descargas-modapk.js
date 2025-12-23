import axios from 'axios';
import fetch from 'node-fetch';

const userMessages = new Map();
const userRequests = {};

/* ======================== CONFIGURACIÓN ======================== */
const CONFIG = {
  APTOIDE_API: 'https://api-sky.ultraplus.click/aptoide',
  API_KEY: 'sk_5242a5e0-e6b2-41b0-a9f2-7479fc8a60e0',
  MAX_FILE_SIZE: 999, // MB
  TIMEOUT: 30000
};

/* ======================== UTILIDADES ======================== */

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return 'Desconocido';
  
  const mb = bytes / (1024 * 1024);
  
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  
  return `${mb.toFixed(2)} MB`;
}

function extractSizeInMB(bytes) {
  if (!bytes) return 0;
  return bytes / (1024 * 1024);
}

async function searchApkAptoide(query) {
  try {
    console.log(`🔍 Buscando APK: ${query}`);
    
    const response = await axios.post(
      CONFIG.APTOIDE_API,
      { query: query },
      {
        headers: {
          'apikey': CONFIG.API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: CONFIG.TIMEOUT
      }
    );

    const data = response.data;

    if (!data.status || !data.result || !data.result.results || data.result.results.length === 0) {
      throw new Error('No se encontraron resultados');
    }

    // Obtener el primer resultado
    const apk = data.result.results[0];

    console.log(`✅ APK encontrado: ${apk.name}`);

    return {
      name: apk.name,
      package: apk.package || 'Desconocido',
      developer: apk.developer || 'Desconocido',
      version: apk.version || 'Desconocida',
      versionCode: apk.versionCode,
      size: apk.size, // En bytes
      downloads: apk.downloads || 0,
      rating: apk.rating || 0,
      icon: apk.icon,
      apk: apk.apk, // URL de descarga
      malware: apk.malware || 'UNKNOWN'
    };

  } catch (error) {
    console.error('❌ Error en Aptoide API:', error.message);
    
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
      throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Tiempo de espera agotado. Intenta nuevamente.');
    }
    
    throw new Error(`Error buscando APK: ${error.message}`);
  }
}

function formatDownloads(downloads) {
  if (!downloads) return '0';
  
  if (downloads >= 1000000000) {
    return `${(downloads / 1000000000).toFixed(1)}B+`;
  }
  if (downloads >= 1000000) {
    return `${(downloads / 1000000).toFixed(1)}M+`;
  }
  if (downloads >= 1000) {
    return `${(downloads / 1000).toFixed(1)}K+`;
  }
  
  return downloads.toString();
}

function generateApkMessage(apk) {
  const sizeFormatted = formatFileSize(apk.size);
  const downloadsFormatted = formatDownloads(apk.downloads);
  
  let message = `╔═══════════════════════╗\n`;
  message += `║  📱 INFORMACIÓN DEL APK  ║\n`;
  message += `╚═══════════════════════╝\n\n`;
  
  message += `📌 *Nombre:* ${apk.name}\n\n`;
  message += `👤 *Desarrollador:* ${apk.developer}\n\n`;
  message += `📦 *Paquete:* ${apk.package}\n\n`;
  message += `🔢 *Versión:* ${apk.version}\n\n`;
  message += `💾 *Peso:* ${sizeFormatted}\n\n`;
  message += `📥 *Descargas:* ${downloadsFormatted}\n\n`;
  
  if (apk.rating > 0) {
    message += `⭐ *Rating:* ${apk.rating}/5\n\n`;
  }
  
  if (apk.malware === 'TRUSTED') {
    message += `✅ *Estado:* Verificado y seguro\n\n`;
  } else {
    message += `⚠️ *Estado:* ${apk.malware}\n\n`;
  }
  
  message += `> _⏳ Espere un momento, su APK se está enviando..._`;
  
  return message;
}

/* ======================== HANDLER PRINCIPAL ======================== */

const handler = async (m, { conn, usedPrefix, command, text }) => {
  if (!text) {
    return m.reply(
      `╔═══════════════════════╗\n` +
      `║  ⚠️ FALTA EL NOMBRE  ║\n` +
      `╚═══════════════════════╝\n\n` +
      `📝 *Uso correcto:*\n` +
      `${usedPrefix + command} <nombre del APK>\n\n` +
      `💡 *Ejemplo:*\n` +
      `${usedPrefix + command} WhatsApp\n` +
      `${usedPrefix + command} Minecraft\n` +
      `${usedPrefix + command} HTTP Custom`
    );
  }

  // Verificar si el usuario ya tiene una descarga en proceso
  if (userRequests[m.sender]) {
    return await conn.reply(
      m.chat,
      `⚠️ Hey @${m.sender.split('@')[0]}, ya estás descargando un APK 🙄\n\n` +
      `Espera a que termine tu descarga actual antes de pedir otra. 👆`,
      userMessages.get(m.sender) || m,
      { mentions: [m.sender] }
    );
  }

  userRequests[m.sender] = true;
  await m.react("🔍");

  try {
    // Buscar APK en Aptoide
    let apkData = null;
    
    try {
      apkData = await searchApkAptoide(text);
    } catch (error) {
      console.error('Error buscando APK:', error);
      throw new Error(
        `No se pudo encontrar el APK.\n\n` +
        `Posibles causas:\n` +
        `• El nombre está mal escrito\n` +
        `• La aplicación no existe en Aptoide\n` +
        `• Problema con la API\n\n` +
        `*Error:* ${error.message}`
      );
    }

    if (!apkData || !apkData.apk) {
      throw new Error('No se pudo obtener el enlace de descarga del APK');
    }

    await m.react("⏳");

    // Verificar tamaño del APK
    const sizeInMB = extractSizeInMB(apkData.size);
    
    if (sizeInMB > CONFIG.MAX_FILE_SIZE) {
      const sizeFormatted = formatFileSize(apkData.size);
      
      await m.reply(
        `╔═══════════════════════╗\n` +
        `║  ⚠️ ARCHIVO MUY GRANDE  ║\n` +
        `╚═══════════════════════╝\n\n` +
        `📱 *APK:* ${apkData.name}\n` +
        `💾 *Tamaño:* ${sizeFormatted}\n` +
        `🚫 *Límite:* ${CONFIG.MAX_FILE_SIZE} MB\n\n` +
        `_No se puede enviar por WhatsApp debido a su tamaño._\n\n` +
        `🔗 *Descarga directa:*\n${apkData.apk}`
      );
      
      await m.react("⚠️");
      return;
    }

    // Generar mensaje de información
    const infoMessage = generateApkMessage(apkData);

    // Enviar imagen con información del APK
    const responseMessage = await conn.sendFile(
      m.chat,
      apkData.icon,
      'apk-icon.jpg',
      infoMessage,
      m
    );
    
    userMessages.set(m.sender, responseMessage);

    await m.react("⬇️");

    // Enviar APK como documento
    try {
      await conn.sendMessage(
        m.chat,
        {
          document: { url: apkData.apk },
          mimetype: 'application/vnd.android.package-archive',
          fileName: `${apkData.name}.apk`,
          caption: `╔═══════════════════════╗\n` +
                   `║  ✅ APK DESCARGADO  ║\n` +
                   `╚═══════════════════════╝\n\n` +
                   `📱 *${apkData.name}*\n` +
                   `📦 v${apkData.version}\n` +
                   `💾 ${formatFileSize(apkData.size)}\n\n` +
                   `_Instalación completada exitosamente_`
        },
        { quoted: m }
      );
      
      console.log(`✅ APK enviado: ${apkData.name}`);
      await m.react("✅");
      
    } catch (sendError) {
      console.error('Error enviando APK:', sendError);
      throw new Error(
        `Error al enviar el APK.\n\n` +
        `Intenta descargarlo manualmente:\n${apkData.apk}`
      );
    }

  } catch (error) {
    console.error('❌ Error en handler:', error);
    
    await m.react('❌');
    
    await conn.reply(
      m.chat,
      `╔═══════════════════════╗\n` +
      `║  ❌ OCURRIÓ UN ERROR  ║\n` +
      `╚═══════════════════════╝\n\n` +
      `${error.message}\n\n` +
      `💡 *Sugerencias:*\n` +
      `• Verifica la ortografía del nombre\n` +
      `• Intenta con otro APK\n` +
      `• Espera unos minutos e intenta nuevamente\n` +
      `• Usa el comando: ${usedPrefix}${command} <nombre exacto>`,
      m
    );
    
    handler.limit = false;
    
  } finally {
    delete userRequests[m.sender];
  }
};

/* ======================== METADATA ======================== */

handler.help = ['apk', 'apkmod', 'aptoide', 'apkpure'];
handler.tags = ['downloader'];
handler.command = /^(apkmod|apk|modapk|dapk2|aptoide|aptoidedl|apkp|apkpure|apkdl)$/i;
handler.register = true;
handler.limit = 2;

export default handler;