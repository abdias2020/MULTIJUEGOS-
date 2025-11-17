import axios from 'axios';
import cheerio from 'cheerio';

const userMessages = new Map();
const userRequests = {};

const handler = async (m, { conn, usedPrefix, command, text }) => {
    if (!text) {
        return m.reply(`╭━━━━━━━━━⬣
┃ ⚠️ *USO INCORRECTO*
┃
┃ Proporciona una URL válida
┃ de descarga de APK
┃
┃ 📌 *Ejemplos:*
┃ • ${usedPrefix + command} https://mcpedl.org/...
┃ • ${usedPrefix + command} https://apkpure.com/...
┃ • ${usedPrefix + command} https://apkmirror.com/...
┃
┃ 🌐 *Sitios compatibles:*
┃ • MCPEDL
┃ • APKPure
┃ • APKMirror
┃ • Mediafire
┃ • Google Drive
┃ • Y más...
╰━━━━━━━━━⬣`);
    }

    // Validar que sea una URL
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return m.reply(`╭━━━━━━━━━⬣
┃ ❌ *URL INVÁLIDA*
┃
┃ Debes proporcionar una URL
┃ completa que comience con
┃ http:// o https://
┃
┃ 📌 *Ejemplo correcto:*
┃ ${usedPrefix + command} https://mcpedl.org/...
╰━━━━━━━━━⬣`);
    }

    if (userRequests[m.sender]) {
        return await conn.reply(
            m.chat,
            `╭━━━━━━━━━⬣
┃ ⏳ *DESCARGA EN PROCESO*
┃
┃ Hey @${m.sender.split('@')[0]}
┃ Ya tienes una descarga activa
┃ Por favor espera...
╰━━━━━━━━━⬣`,
            userMessages.get(m.sender) || m
        );
    }

    userRequests[m.sender] = true;
    m.react('🔍');

    try {
        // Detectar el tipo de sitio web
        const urlLower = text.toLowerCase();
        let apkData;

        if (urlLower.includes('mediafire.com')) {
            m.react('📁');
            apkData = await handleMediafire(text);
        } else if (urlLower.includes('drive.google.com')) {
            m.react('💾');
            apkData = await handleGoogleDrive(text);
        } else if (urlLower.includes('apkpure.com')) {
            m.react('🔷');
            apkData = await handleAPKPure(text);
        } else if (urlLower.includes('apkmirror.com')) {
            m.react('🔶');
            apkData = await handleAPKMirror(text);
        } else {
            // Método genérico para otros sitios
            m.react('⌛');
            apkData = await scrapeAPKFromPage(text);
        }

        // Mostrar información del APK
        const infoMsg = `╭━━━━━━━━━⬣
┃ 📦 *APK ENCONTRADO*
┃━━━━━━━━━━━━━━━
┃ 
┃ 📌 *Título:* ${apkData.title}
┃ 📊 *Versión:* ${apkData.version || 'No especificada'}
┃ 💾 *Tamaño:* ${apkData.size || 'Calculando...'}
┃ 📅 *Fecha:* ${apkData.date || 'N/A'}
┃ 🌐 *Fuente:* ${getDomain(text)}
┃ 
┃━━━━━━━━━━━━━━━
┃ 🔗 *Enlace:* ${apkData.downloadUrl.substring(0, 50)}...
┃ 
┃ ⏳ *Descargando...*
╰━━━━━━━━━⬣`;

        const responseMessage = await conn.sendMessage(
            m.chat,
            { text: infoMsg },
            { quoted: m }
        );
        userMessages.set(m.sender, responseMessage);

        m.react('📥');

        // Descargar el APK
        const apkResponse = await axios.get(apkData.downloadUrl, {
            responseType: 'arraybuffer',
            maxContentLength: 100 * 1024 * 1024, // 100MB max
            maxBodyLength: 100 * 1024 * 1024,
            timeout: 300000, // 5 minutos
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/vnd.android.package-archive,*/*',
                'Referer': text
            },
            onDownloadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    if (percentCompleted % 25 === 0) {
                        console.log(`Descarga: ${percentCompleted}%`);
                    }
                }
            }
        });

        const fileName = (apkData.title || 'app').replace(/[^a-zA-Z0-9\s.-]/g, '_').substring(0, 50) + '.apk';
        const fileSize = (apkResponse.data.length / (1024 * 1024)).toFixed(2);

        // Verificar tamaño del archivo
        if (apkResponse.data.length > 100 * 1024 * 1024) {
            throw new Error('El archivo es demasiado grande (>100MB)');
        }

        // Enviar el APK
        await conn.sendMessage(
            m.chat,
            {
                document: apkResponse.data,
                mimetype: 'application/vnd.android.package-archive',
                fileName: fileName,
                caption: `📦 *${apkData.title}*\n💾 Tamaño: ${fileSize} MB`
            },
            { quoted: m }
        );

        m.react('✅');

        await conn.sendMessage(
            m.chat,
            {
                text: `╭━━━━━━━━━⬣
┃ ✅ *DESCARGA COMPLETADA*
┃
┃ 📦 ${apkData.title}
┃ 💾 ${fileSize} MB
┃ 🌐 ${getDomain(text)}
┃ 
┃ ⚠️ *Advertencia:*
┃ • Instala bajo tu responsabilidad
┃ • Verifica permisos del APK
┃ • Escanea con antivirus
╰━━━━━━━━━⬣`
            },
            { quoted: m }
        );

    } catch (e) {
        m.react('❌');
        console.error('Error completo:', e);
        
        let errorDetail = '';
        if (e.code === 'ECONNABORTED') {
            errorDetail = '• Tiempo de espera agotado';
        } else if (e.response?.status === 404) {
            errorDetail = '• Archivo no encontrado (404)';
        } else if (e.response?.status === 403) {
            errorDetail = '• Acceso denegado (403)';
        } else if (e.message.includes('demasiado grande')) {
            errorDetail = '• Archivo muy pesado (>100MB)';
        } else {
            errorDetail = `• ${e.message || 'Error desconocido'}`;
        }
        
        const errorMsg = `╭━━━━━━━━━⬣
┃ ❌ *ERROR EN LA DESCARGA*
┃
┃ No se pudo descargar el APK
┃ 
┃ *Causa:*
┃ ${errorDetail}
┃
┃ *Soluciones:*
┃ • Verifica que la URL sea válida
┃ • Asegúrate que el enlace sea público
┃ • Intenta con otro enlace
┃ • Verifica el tamaño del archivo
┃
┃ 💡 *Tip:* Usa enlaces directos
┃ de descarga siempre que sea posible
╰━━━━━━━━━⬣`;
        
        m.reply(errorMsg);
    } finally {
        delete userRequests[m.sender];
        userMessages.delete(m.sender);
    }
};

// Función para obtener el dominio de una URL
function getDomain(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch {
        return 'Desconocido';
    }
}

// Manejador para Mediafire
async function handleMediafire(url) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('.dl-btn-label').attr('title') || 
                  $('.filename').text().trim() || 
                  'Mediafire APK';
    
    const downloadUrl = $('#downloadButton').attr('href') || 
                       $('a.input[href*="download"]').attr('href');
    
    const size = $('.details li:contains("File size")').text().match(/[\d.]+ [KMGT]B/i)?.[0];

    if (!downloadUrl) throw new Error('No se encontró enlace de descarga en Mediafire');

    return { title, downloadUrl, size, version: null, date: null };
}

// Manejador para Google Drive
async function handleGoogleDrive(url) {
    // Extraer ID del archivo
    const fileId = url.match(/\/d\/([^\/]+)/)?.[1] || url.match(/id=([^&]+)/)?.[1];
    
    if (!fileId) throw new Error('ID de archivo de Google Drive no válido');

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    return {
        title: 'Google Drive APK',
        downloadUrl,
        size: null,
        version: null,
        date: null
    };
}

// Manejador para APKPure
async function handleAPKPure(url) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('.title-like h1').text().trim() || 
                  $('h1').first().text().trim() || 
                  'APKPure APK';
    
    const version = $('.details-sdk span:contains("Version")').parent().text().match(/[\d.]+/)?.[0];
    const size = $('.details-sdk span:contains("File size")').parent().text().match(/[\d.]+ [KMGT]B/i)?.[0];
    
    const downloadUrl = $('.download-btn').attr('href') || 
                       $('a.da').attr('href') ||
                       $('a[href*="download"]').first().attr('href');

    if (!downloadUrl) throw new Error('No se encontró enlace de descarga en APKPure');

    // Convertir a URL absoluta si es necesaria
    const finalUrl = downloadUrl.startsWith('http') ? downloadUrl : `https://d.apkpure.com${downloadUrl}`;

    return { title, downloadUrl: finalUrl, size, version, date: null };
}

// Manejador para APKMirror
async function handleAPKMirror(url) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('h1.post-title').text().trim() || 'APKMirror APK';
    const version = $('.apkm-badge:contains("Version")').next().text().trim();
    const size = $('.apkm-badge:contains("File size")').next().text().trim();
    
    // APKMirror requiere navegación adicional para obtener el enlace directo
    const downloadPageUrl = $('.downloadButton').attr('href');
    
    if (!downloadPageUrl) throw new Error('No se encontró enlace de descarga en APKMirror');

    const fullDownloadUrl = downloadPageUrl.startsWith('http') ? 
                           downloadPageUrl : 
                           `https://www.apkmirror.com${downloadPageUrl}`;

    // Obtener el enlace directo
    const { data: downloadPage } = await axios.get(fullDownloadUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $2 = cheerio.load(downloadPage);
    const directUrl = $2('a[rel="nofollow"]').attr('href');

    if (!directUrl) throw new Error('No se pudo obtener enlace directo de APKMirror');

    return {
        title,
        downloadUrl: directUrl.startsWith('http') ? directUrl : `https://www.apkmirror.com${directUrl}`,
        size,
        version,
        date: null
    };
}

// Función genérica para extraer información del APK de una página
async function scrapeAPKFromPage(url) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const $ = cheerio.load(data);

    // Buscar el título
    const title = $('h1.entry-title').text().trim() || 
                  $('h1').first().text().trim() ||
                  $('title').text().trim() || 
                  'APK Download';

    // Buscar versión
    const version = $('.version').text().trim() || 
                    $('span:contains("Version")').next().text().trim() ||
                    $('*:contains("Version")').text().match(/v?[\d.]+/i)?.[0];

    // Buscar fecha
    const date = $('.post-date').text().trim() || 
                 $('time').text().trim() ||
                 $('.date').text().trim();

    // Buscar tamaño
    const size = $('*:contains("Size")').text().match(/[\d.]+ [KMGT]B/i)?.[0] ||
                 $('.file-size').text().trim();

    // Buscar enlaces de descarga (métodos múltiples)
    let downloadUrl = null;

    // Método 1: Botones de descarga comunes
    downloadUrl = $('a.download-button, a#download-button, .download-btn, a.btn-download').attr('href');

    // Método 2: Enlaces que terminan en .apk
    if (!downloadUrl) {
        $('a[href$=".apk"]').each((i, el) => {
            downloadUrl = $(el).attr('href');
            return false;
        });
    }

    // Método 3: Enlaces que contienen "download" y ".apk"
    if (!downloadUrl) {
        $('a[href*="download"][href*=".apk"], a[href*=".apk"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('javascript')) {
                downloadUrl = href;
                return false;
            }
        });
    }

    // Método 4: Botones con texto "Download" o "Descargar"
    if (!downloadUrl) {
        $('a:contains("Download"), a:contains("Descargar"), a:contains("DOWNLOAD")').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('javascript') && !href.startsWith('#')) {
                downloadUrl = href;
                return false;
            }
        });
    }

    // Método 5: Enlaces a servicios de hosting comunes
    if (!downloadUrl) {
        const commonHosts = ['mediafire', 'mega.nz', 'drive.google', 'dropbox', 'direct', 'cdn', 'dl.'];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && commonHosts.some(host => href.toLowerCase().includes(host))) {
                downloadUrl = href;
                return false;
            }
        });
    }

    if (!downloadUrl) {
        throw new Error('No se encontró enlace de descarga válido en la página');
    }

    // Convertir URL relativa a absoluta
    if (downloadUrl.startsWith('/')) {
        const baseUrl = new URL(url);
        downloadUrl = `${baseUrl.protocol}//${baseUrl.host}${downloadUrl}`;
    } else if (!downloadUrl.startsWith('http')) {
        const baseUrl = new URL(url);
        downloadUrl = `${baseUrl.protocol}//${baseUrl.host}/${downloadUrl}`;
    }

    return {
        title: title.substring(0, 100), // Limitar longitud
        version,
        date,
        size,
        downloadUrl
    };
}

handler.help = ['apkurl <url>'];
handler.tags = ['downloader'];
handler.command = /^(apkurl|apkdl|downloadapk)$/i;
handler.register = true;
handler.limit = 3;

export default handler;