import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import axios from 'axios';

/* ======================== CONFIGURACIÓN ======================== */
const CONFIG = {
  MAX_FILE_SIZE: 1000, // MB
  TIMEOUT: 60000, // Aumentado a 60 segundos
  STICKER_ERROR: 'https://qu.ax/Wdsb.webp',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const userCaptions = new Map();
const userRequests = {};

/* ======================== UTILIDADES ======================== */

function isValidMediaFireUrl(url) {
  return /^https?:\/\/(www\.)?mediafire\.com\/(file|view|download)/i.test(url);
}

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

function cleanFileName(filename) {
  if (!filename) return 'archivo';
  
  // Eliminar duplicaciones
  const halfLength = Math.floor(filename.length / 2);
  const firstHalf = filename.substring(0, halfLength);
  const secondHalf = filename.substring(halfLength);
  
  if (firstHalf === secondHalf) {
    return firstHalf.trim();
  }
  
  return filename.trim();
}

function normalizeUrl(url) {
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  if (!url.startsWith('http')) {
    return 'https://' + url;
  }
  return url;
}

/* ======================== SCRAPING MEDIAFIRE MEJORADO ======================== */

async function scrapMediaFire(url) {
  try {
    console.log(`🔍 Scrapeando MediaFire: ${url}`);
    
    // Primera request para obtener la página
    const response = await fetch(url, {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.mediafire.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extraer información del archivo con múltiples métodos
    let downloadUrl = null;
    let filename = null;
    let filesizeBytes = 0;

    // MÉTODO 1: Buscar en el botón de descarga principal
    downloadUrl = $('#downloadButton').attr('href');
    
    // MÉTODO 2: Buscar en scripts de la página (más confiable)
    if (!downloadUrl) {
      const scripts = $('script').toArray();
      for (const script of scripts) {
        const content = $(script).html() || '';
        
        // Buscar la URL de descarga directa
        const urlMatch = content.match(/url:\s*'([^']+download[^']+)'/i) ||
                        content.match(/"(https:\/\/download\d+\.mediafire\.com[^"]+)"/i) ||
                        content.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i);
        
        if (urlMatch && urlMatch[1]) {
          downloadUrl = urlMatch[1];
          break;
        }
      }
    }

    // MÉTODO 3: Buscar enlace directo en la página
    if (!downloadUrl) {
      $('a').each((i, elem) => {
        const href = $(elem).attr('href');
        if (href && /download\d+\.mediafire\.com/i.test(href)) {
          downloadUrl = href;
          return false;
        }
      });
    }

    // MÉTODO 4: Buscar cualquier enlace de descarga
    if (!downloadUrl) {
      downloadUrl = $('a.input[aria-label="Download file"]').attr('href') ||
                   $('a[href*="download"]').first().attr('href');
    }

    // Normalizar URL
    if (downloadUrl) {
      downloadUrl = normalizeUrl(downloadUrl);
      console.log(`📥 URL extraída: ${downloadUrl}`);
    }

    // Extraer nombre del archivo (múltiples métodos)
    filename = $('.filename').text().trim() ||
               $('.dl-btn-label').attr('title')?.trim() ||
               $('meta[property="og:title"]').attr('content')?.trim() ||
               $('.intro .filename').text().trim() ||
               $('div.filename').text().trim();

    // Si no se encuentra, buscar en el script
    if (!filename) {
      const scripts = $('script').toArray();
      for (const script of scripts) {
        const content = $(script).html() || '';
        const nameMatch = content.match(/fileName:\s*["']([^"']+)["']/i);
        if (nameMatch) {
          filename = nameMatch[1];
          break;
        }
      }
    }

    // Extraer tamaño REAL del archivo
    // Buscar en la tabla de detalles
    let filesizeText = '';
    
    $('.details li, .details-list li, ul.details li').each((i, elem) => {
      const text = $(elem).text();
      if (text.includes('File size') || text.includes('Tamaño')) {
        filesizeText = text;
        return false;
      }
    });

    // También buscar en otros lugares
    if (!filesizeText) {
      filesizeText = $('span.filetype').parent().text() ||
                    $('.dl-info').text() ||
                    $('div[class*="size"]').text();
    }

    // Parsear el tamaño
    const sizeMatch = filesizeText.match(/(\d+(?:[.,]\d+)?)\s*(bytes|B|KB|MB|GB)/i);
    if (sizeMatch) {
      let value = parseFloat(sizeMatch[1].replace(',', '.'));
      const unit = sizeMatch[2].toUpperCase();
      
      switch (unit) {
        case 'GB':
          filesizeBytes = value * 1024 * 1024 * 1024;
          break;
        case 'MB':
          filesizeBytes = value * 1024 * 1024;
          break;
        case 'KB':
          filesizeBytes = value * 1024;
          break;
        case 'BYTES':
        case 'B':
          filesizeBytes = value;
          break;
      }
    }

    // Si aún no tenemos el tamaño, intentar obtenerlo del header de la URL
    if (!filesizeBytes && downloadUrl) {
      try {
        const headResponse = await axios.head(downloadUrl, {
          headers: { 'User-Agent': CONFIG.USER_AGENT },
          timeout: 10000
        });
        
        const contentLength = headResponse.headers['content-length'];
        if (contentLength) {
          filesizeBytes = parseInt(contentLength);
          console.log(`📏 Tamaño obtenido del header: ${formatFileSize(filesizeBytes)}`);
        }
      } catch (e) {
        console.log('⚠️ No se pudo obtener tamaño del header');
      }
    }

    // Validaciones
    if (!downloadUrl) {
      console.log('❌ No se encontró URL de descarga');
      console.log('HTML (primeros 1000 caracteres):');
      console.log(html.substring(0, 1000));
      throw new Error('No se encontró el enlace de descarga. El archivo puede haber sido eliminado o no es público.');
    }

    if (!filename) {
      // Usar nombre de la URL como fallback
      const urlParts = url.split('/');
      filename = decodeURIComponent(urlParts[urlParts.length - 2] || 'archivo');
    }

    // Determinar mimetype según extensión
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimetypes = {
      'apk': 'application/vnd.android.package-archive',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      'exe': 'application/x-msdownload',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'txt': 'text/plain',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
    const mimetype = mimetypes[ext] || 'application/octet-stream';

    console.log(`✅ Archivo encontrado:`);
    console.log(`   📁 Nombre: ${filename}`);
    console.log(`   💾 Tamaño: ${formatFileSize(filesizeBytes)} (${filesizeBytes} bytes)`);
    console.log(`   🔗 URL: ${downloadUrl}`);

    return {
      filename: cleanFileName(filename),
      filesize: formatFileSize(filesizeBytes),
      filesizeBytes: filesizeBytes,
      download: downloadUrl,
      mimetype: mimetype
    };

  } catch (error) {
    console.error('❌ Error en scraping:', error.message);
    throw error;
  }
}

/* ======================== GENERADOR DE CAPTION ======================== */

function generateCaption(file) {
  return `╔═══════════════════════╗
║  📁 MEDIAFIRE DOWNLOAD  ║
╚═══════════════════════╝

📌 *Nombre:* ${file.filename}

💾 *Peso:* ${file.filesize}

📄 *Tipo:* ${file.mimetype}

┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

> _⏳ Descargando archivo completo..._`;
}

/* ======================== HANDLER PRINCIPAL ======================== */

const handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!args[0]) {
    return m.reply(
      `╔═══════════════════════╗\n` +
      `║  ⚠️ FALTA LA URL  ║\n` +
      `╚═══════════════════════╝\n\n` +
      `📝 *Uso correcto:*\n` +
      `${usedPrefix + command} <url de MediaFire>\n\n` +
      `💡 *Ejemplo:*\n` +
      `${usedPrefix + command} https://www.mediafire.com/file/ejemplo/file.zip`
    );
  }

  if (!isValidMediaFireUrl(args[0])) {
    return m.reply(
      `╔═══════════════════════╗\n` +
      `║  ⚠️ URL INVÁLIDA  ║\n` +
      `╚═══════════════════════╝\n\n` +
      `❌ *Enlace no válido.*\n\n` +
      `📌 Asegúrate de ingresar una URL de MediaFire válida.\n\n` +
      `✅ *Ejemplo válido:*\n` +
      `\`${usedPrefix + command} https://www.mediafire.com/file/ejemplo/archivo.zip\``
    );
  }

  if (userRequests[m.sender]) {
    return await conn.reply(
      m.chat,
      `⚠️ Hey @${m.sender.split('@')[0]}, ya estás descargando algo 🙄\n\n` +
      `Espera a que termine tu solicitud actual antes de hacer otra...`,
      userCaptions.get(m.sender) || m,
      { mentions: [m.sender] }
    );
  }

  userRequests[m.sender] = true;
  await m.react("🔍");

  try {
    console.log('🚀 Iniciando scraping de MediaFire...');
    const fileData = await scrapMediaFire(args[0]);

    if (!fileData || !fileData.download) {
      throw new Error('No se pudo obtener el enlace de descarga');
    }

    await m.react("⏳");

    const sizeInMB = extractSizeInMB(fileData.filesizeBytes);
    
    if (sizeInMB > CONFIG.MAX_FILE_SIZE) {
      await m.reply(
        `╔═══════════════════════╗\n` +
        `║  ⚠️ ARCHIVO MUY GRANDE  ║\n` +
        `╚═══════════════════════╝\n\n` +
        `📁 *Archivo:* ${fileData.filename}\n` +
        `💾 *Tamaño:* ${fileData.filesize}\n` +
        `🚫 *Límite:* ${CONFIG.MAX_FILE_SIZE} MB\n\n` +
        `_No se puede enviar por WhatsApp debido a su tamaño._\n\n` +
        `🔗 *Descarga directa:*\n${fileData.download}`
      );
      
      await m.react("⚠️");
      return;
    }

    const caption = generateCaption(fileData);
    const captionMessage = await conn.reply(m.chat, caption, m);
    userCaptions.set(m.sender, captionMessage);

    await m.react("⬇️");

    // Descargar el archivo completo primero (más confiable)
    console.log('📥 Descargando archivo completo...');
    const fileBuffer = await axios.get(fileData.download, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Referer': 'https://www.mediafire.com/'
      },
      timeout: CONFIG.TIMEOUT,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log(`✅ Archivo descargado: ${fileBuffer.data.byteLength} bytes`);

    // Enviar el buffer completo
    await conn.sendMessage(
      m.chat,
      {
        document: fileBuffer.data,
        mimetype: fileData.mimetype,
        fileName: fileData.filename
      },
      { quoted: m }
    );

    console.log(`✅ Archivo enviado: ${fileData.filename}`);
    await m.react('✅');

  } catch (error) {
    console.error('❌ Error en handler:', error);
    
    await m.react('❌');
    
    try {
      await conn.sendFile(m.chat, CONFIG.STICKER_ERROR, 'error.webp', '', m);
    } catch (e) {
      // Ignorar error del sticker
    }
    
    await conn.reply(
      m.chat,
      `╔═══════════════════════╗\n` +
      `║  ❌ OCURRIÓ UN ERROR  ║\n` +
      `╚═══════════════════════╝\n\n` +
      `${error.message}\n\n` +
      `💡 *Sugerencias:*\n` +
      `• Verifica que el enlace sea correcto\n` +
      `• Asegúrate de que el archivo aún existe\n` +
      `• Verifica que el archivo sea público\n` +
      `• Intenta con otro archivo\n` +
      `• Espera unos minutos e intenta nuevamente`,
      m
    );
    
    handler.limit = false;
    
  } finally {
    delete userRequests[m.sender];
  }
};

/* ======================== METADATA ======================== */

handler.help = ['mediafire', 'mediafiredl'];
handler.tags = ['downloader'];
handler.command = /^(mediafire|mediafiredl|dlmediafire)$/i;
handler.register = true;
handler.limit = 3;

export default handler;