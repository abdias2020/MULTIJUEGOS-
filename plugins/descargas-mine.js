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
┃ • ${usedPrefix + command} https://aptoide.com/...
┃
┃ 🌐 *Sitios compatibles:*
┃ • MCPEDL, APKPure, APKMirror
┃ • Mediafire, Google Drive
┃ • Uptodown, APKMonk, Aptoide
┃ • AndroidAPKsFree, APK4Fun
┃ • Y muchos más...
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
┃ ${usedPrefix + command} https://apkpure.com/...
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
        const urlLower = text.toLowerCase();
        let apkData;

        // Detectar el tipo de sitio web
        if (urlLower.includes('mediafire.com')) {
            m.react('📁');
            apkData = await handleMediafire(text);
        } else if (urlLower.includes('drive.google.com')) {
            m.react('💾');
            apkData = await handleGoogleDrive(text);
        } else if (urlLower.includes('apkpure.com') || urlLower.includes('apkpure.net')) {
            m.react('🔷');
            apkData = await handleAPKPure(text);
        } else if (urlLower.includes('apkmirror.com')) {
            m.react('🔶');
            apkData = await handleAPKMirror(text);
        } else if (urlLower.includes('uptodown.com')) {
            m.react('🟢');
            apkData = await handleUptodown(text);
        } else if (urlLower.includes('apkmonk.com')) {
            m.react('🟡');
            apkData = await handleAPKMonk(text);
        } else if (urlLower.includes('aptoide.com')) {
            m.react('🟠');
            apkData = await handleAptoide(text);
        } else if (urlLower.includes('apk4fun.com')) {
            m.react('🔵');
            apkData = await handleAPK4Fun(text);
        } else if (urlLower.includes('androidapksfree.com')) {
            m.react('🟣');
            apkData = await handleAndroidAPKsFree(text);
        } else if (urlLower.includes('mega.nz')) {
            m.react('💿');
            apkData = await handleMega(text);
        } else if (urlLower.includes('dropbox.com')) {
            m.react('📦');
            apkData = await handleDropbox(text);
        } else {
            // Método genérico ultra mejorado
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

        // Descargar el APK con reintentos
        let apkResponse;
        let retries = 3;
        
        while (retries > 0) {
            try {
                apkResponse = await axios.get(apkData.downloadUrl, {
                    responseType: 'arraybuffer',
                    maxContentLength: 150 * 1024 * 1024, // 150MB max
                    maxBodyLength: 150 * 1024 * 1024,
                    timeout: 600000, // 10 minutos
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/vnd.android.package-archive,application/octet-stream,*/*',
                        'Referer': text,
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br'
                    },
                    onDownloadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            if (percentCompleted % 20 === 0) {
                                console.log(`📥 Descarga: ${percentCompleted}%`);
                            }
                        }
                    }
                });
                break; // Descarga exitosa
            } catch (err) {
                retries--;
                if (retries === 0) throw err;
                console.log(`⚠️ Reintentando descarga... (${3 - retries}/3)`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
            }
        }

        // Validar que sea un APK válido
        const buffer = Buffer.from(apkResponse.data);
        const header = buffer.toString('hex', 0, 4);
        
        // Verificar firma APK (504B0304 - ZIP signature)
        if (!header.startsWith('504b03') && !header.startsWith('504b01')) {
            throw new Error('El archivo descargado no parece ser un APK válido');
        }

        const fileName = sanitizeFileName(apkData.title) + '.apk';
        const fileSize = (buffer.length / (1024 * 1024)).toFixed(2);

        // Verificar tamaño
        if (buffer.length > 150 * 1024 * 1024) {
            throw new Error('El archivo es demasiado grande (>150MB)');
        }

        if (buffer.length < 1000) {
            throw new Error('El archivo es demasiado pequeño, posiblemente no sea un APK válido');
        }

        // Enviar el APK
        await conn.sendMessage(
            m.chat,
            {
                document: buffer,
                mimetype: 'application/vnd.android.package-archive',
                fileName: fileName,
                caption: `╭━━━━━━━━━⬣
┃ 📦 *${apkData.title}*
┃━━━━━━━━━━━━━━━
┃ 
┃ 📊 *Versión:* ${apkData.version || 'N/A'}
┃ 💾 *Tamaño:* ${fileSize} MB
┃ 🌐 *Fuente:* ${getDomain(text)}
┃ 
┃ ⚠️ *Importante:*
┃ • Habilita "Orígenes desconocidos"
┃ • Verifica permisos al instalar
┃ • Escanea con antivirus
╰━━━━━━━━━⬣`
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
┃ 📲 *Instrucciones:*
┃ 1. Descarga el archivo
┃ 2. Abre el APK
┃ 3. Permite instalación de origen desconocido
┃ 4. Instala y disfruta
┃ 
┃ ⚠️ *Advertencia:*
┃ Instala bajo tu responsabilidad
╰━━━━━━━━━⬣`
            },
            { quoted: m }
        );

    } catch (e) {
        m.react('❌');
        console.error('❌ Error completo:', e);
        
        let errorDetail = '';
        if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
            errorDetail = '• Tiempo de espera agotado\n┃ • El servidor no responde';
        } else if (e.response?.status === 404) {
            errorDetail = '• Archivo no encontrado (404)';
        } else if (e.response?.status === 403) {
            errorDetail = '• Acceso denegado (403)\n┃ • El sitio bloqueó la descarga';
        } else if (e.response?.status === 503) {
            errorDetail = '• Servicio no disponible (503)';
        } else if (e.message.includes('demasiado grande')) {
            errorDetail = '• Archivo muy pesado (>150MB)';
        } else if (e.message.includes('no parece ser un APK')) {
            errorDetail = '• Archivo inválido o corrupto';
        } else if (e.message.includes('no se encontró enlace')) {
            errorDetail = '• No se detectó enlace de descarga\n┃ • El sitio puede requerir JavaScript\n┃ • Intenta con el enlace directo';
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
┃ • Usa el enlace directo de descarga
┃ • Prueba desde el navegador primero
┃ • Asegúrate que sea un enlace público
┃ • Verifica el tamaño del archivo (<150MB)
┃
┃ 💡 *Tip:* Para mejores resultados
┃ usa enlaces directos (.apk) o sitios
┃ como APKPure, Uptodown, APKMirror
╰━━━━━━━━━⬣`;
        
        m.reply(errorMsg);
    } finally {
        delete userRequests[m.sender];
        userMessages.delete(m.sender);
    }
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function getDomain(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch {
        return 'Desconocido';
    }
}

function sanitizeFileName(name) {
    return name
        .replace(/[^a-zA-Z0-9\s.-]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}

async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.get(url, options);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// ============================================
// MANEJADORES ESPECÍFICOS POR SITIO
// ============================================

async function handleMediafire(url) {
    const { data } = await fetchWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('.dl-btn-label').attr('title') || 
                  $('.filename').text().trim() || 
                  $('div.filename').text().trim() ||
                  'Mediafire APK';
    
    const downloadUrl = $('#downloadButton').attr('href') || 
                       $('a.input[href*="download"]').attr('href') ||
                       $('a[href*="download.php"]').attr('href');
    
    const size = $('.details li:contains("File size")').text().match(/[\d.]+ [KMGT]B/i)?.[0] ||
                 $('li:contains("File size")').text().match(/[\d.]+ [KMGT]B/i)?.[0];

    if (!downloadUrl) throw new Error('No se encontró enlace de descarga en Mediafire');

    return { title, downloadUrl, size, version: null, date: null };
}

async function handleGoogleDrive(url) {
    const fileId = url.match(/\/d\/([^\/]+)/)?.[1] || 
                   url.match(/id=([^&]+)/)?.[1] ||
                   url.match(/file\/d\/([^\/]+)/)?.[1];
    
    if (!fileId) throw new Error('ID de archivo de Google Drive no válido');

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    
    return {
        title: 'Google Drive APK',
        downloadUrl,
        size: null,
        version: null,
        date: null
    };
}

async function handleAPKPure(url) {
    const { data } = await fetchWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('.title-like h1').text().trim() || 
                  $('h1[itemprop="name"]').text().trim() ||
                  $('h1').first().text().trim() || 
                  'APKPure APK';
    
    const version = $('.details-sdk span:contains("Version")').parent().text().match(/[\d.]+/)?.[0] ||
                    $('span:contains("Version")').text().match(/[\d.]+/)?.[0];
    const size = $('.details-sdk span:contains("File size")').parent().text().match(/[\d.]+ [KMGT]B/i)?.[0] ||
                 $('span:contains("File size")').text().match(/[\d.]+ [KMGT]B/i)?.[0];
    
    let downloadUrl = $('.download-btn').attr('href') || 
                      $('a.da').attr('href') ||
                      $('#download_link').attr('href') ||
                      $('a[href*="download"]').first().attr('href');

    if (!downloadUrl) throw new Error('No se encontró enlace de descarga en APKPure');

    // Convertir a URL absoluta
    if (downloadUrl.startsWith('//')) {
        downloadUrl = 'https:' + downloadUrl;
    } else if (downloadUrl.startsWith('/')) {
        downloadUrl = 'https://d.apkpure.com' + downloadUrl;
    } else if (!downloadUrl.startsWith('http')) {
        downloadUrl = 'https://d.apkpure.com/' + downloadUrl;
    }

    return { title, downloadUrl, size, version, date: null };
}

async function handleAPKMirror(url) {
    const { data } = await fetchWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('h1.post-title').text().trim() || 
                  $('h1').first().text().trim() ||
                  'APKMirror APK';
    const version = $('.apkm-badge:contains("Version")').next().text().trim() ||
                    $('span:contains("Version")').text().match(/[\d.]+/)?.[0];
    const size = $('.apkm-badge:contains("File size")').next().text().trim() ||
                 $('span:contains("File size")').text().match(/[\d.]+ [KMGT]B/i)?.[0];
    
    let downloadPageUrl = $('.downloadButton').attr('href') ||
                         $('a:contains("Download APK")').attr('href') ||
                         $('a[href*="download"]').first().attr('href');
    
    if (!downloadPageUrl) throw new Error('No se encontró enlace de descarga en APKMirror');

    const fullDownloadUrl = downloadPageUrl.startsWith('http') ? 
                           downloadPageUrl : 
                           `https://www.apkmirror.com${downloadPageUrl}`;

    // Segunda página para obtener enlace directo
    const { data: downloadPage } = await fetchWithRetry(fullDownloadUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': url
        }
    });
    const $2 = cheerio.load(downloadPage);
    let directUrl = $2('a[rel="nofollow"]').attr('href') ||
                    $2('a:contains("here")').attr('href') ||
                    $2('a[href*=".apk"]').attr('href');

    if (!directUrl) throw new Error('No se pudo obtener enlace directo de APKMirror');

    return {
        title,
        downloadUrl: directUrl.startsWith('http') ? directUrl : `https://www.apkmirror.com${directUrl}`,
        size,
        version,
        date: null
    };
}

async function handleUptodown(url) {
    const { data } = await fetchWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('h1').first().text().trim() || 
                  $('.detail h1').text().trim() ||
                  'Uptodown APK';
    const version = $('#detail-download-button').attr('data-version') ||
                    $('span[itemprop="softwareVersion"]').text().trim();
    const size = $('span:contains("Size")').text().match(/[\d.]+ [KMGT]B/i)?.[0];
    
    let downloadUrl = $('#detail-download-button').attr('data-url') ||
                      $('button[data-url]').attr('data-url') ||
                      $('a.button.download').attr('href');

    if (!downloadUrl) throw new Error('No se encontró enlace de descarga en Uptodown');

    if (!downloadUrl.startsWith('http')) {
        downloadUrl = 'https://dw.uptodown.com' + downloadUrl;
    }

    return { title, downloadUrl, size, version, date: null };
}

async function handleAPKMonk(url) {
    const { data } = await fetchWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('h1.app-name').text().trim() || 
                  $('h1').first().text().trim() ||
                  'APKMonk APK';
    const version = $('.app-version').text().match(/[\d.]+/)?.[0];
    const size = $('.apk-size').text().match(/[\d.]+ [KMGT]B/i)?.[0];
    
    let downloadUrl = $('.btn-download').attr('href') ||
                      $('a:contains("Download APK")').attr('href');

    if (!downloadUrl) throw new Error('No se encontró enlace de descarga en APKMonk');

    if (!downloadUrl.startsWith('http')) {
        downloadUrl = 'https://www.apkmonk.com' + downloadUrl;
    }

    return { title, downloadUrl, size, version, date: null };
}

async function handleAptoide(url) {
    const { data } = await fetchWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('h1[itemprop="name"]').text().trim() || 
                  $('h1').first().text().trim() ||
                  'Aptoide APK';
    const version = $('div:contains("Version")').text().match(/[\d.]+/)?.[0];
    const size = $('div:contains("Size")').text().match(/[\d.]+ [KMGT]B/i)?.[0];
    
    let downloadUrl = $('a.download-button').attr('href') ||
                      $('a[href*="download"]').first().attr('href');

    if (!downloadUrl) throw new Error('No se encontró enlace de descarga en Aptoide');

    if (!downloadUrl.startsWith('http')) {
        downloadUrl = 'https://en.aptoide.com' + downloadUrl;
    }

    return { title, downloadUrl, size, version, date: null };
}

async function handleAPK4Fun(url) {
    const { data } = await fetchWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('.entry-title').text().trim() || 
                  $('h1').first().text().trim() ||
                  'APK4Fun APK';
    const version = $('strong:contains("Version")').parent().text().match(/[\d.]+/)?.[0];
    const size = $('strong:contains("Size")').parent().text().match(/[\d.]+ [KMGT]B/i)?.[0];
    
    let downloadUrl = $('.download-btn').attr('href') ||
                      $('a:contains("Download")').attr('href');

    if (!downloadUrl) throw new Error('No se encontró enlace de descarga en APK4Fun');

    if (!downloadUrl.startsWith('http')) {
        downloadUrl = 'https://apk4fun.com' + downloadUrl;
    }

    return { title, downloadUrl, size, version, date: null };
}

async function handleAndroidAPKsFree(url) {
    const { data } = await fetchWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    const title = $('h1.entry-title').text().trim() || 
                  'AndroidAPKsFree APK';
    const version = $('li:contains("Version")').text().match(/[\d.]+/)?.[0];
    const size = $('li:contains("Size")').text().match(/[\d.]+ [KMGT]B/i)?.[0];
    
    let downloadUrl = $('.download-link').attr('href') ||
                      $('a.btn-download').attr('href');

    if (!downloadUrl) throw new Error('No se encontró enlace de descarga');

    if (!downloadUrl.startsWith('http')) {
        downloadUrl = 'https://androidapksfree.com' + downloadUrl;
    }

    return { title, downloadUrl, size, version, date: null };
}

async function handleMega(url) {
    // Mega requiere cliente específico, intentar enlace directo
    return {
        title: 'Mega APK',
        downloadUrl: url,
        size: null,
        version: null,
        date: null
    };
}

async function handleDropbox(url) {
    // Convertir enlace de vista a enlace de descarga
    let downloadUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    downloadUrl = downloadUrl.replace('?dl=0', '?dl=1');
    
    return {
        title: 'Dropbox APK',
        downloadUrl,
        size: null,
        version: null,
        date: null
    };
}

// ============================================
// SCRAPER GENÉRICO ULTRA MEJORADO
// ============================================

async function scrapeAPKFromPage(url) {
    const { data } = await fetchWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });
    const $ = cheerio.load(data);

    // === EXTRACCIÓN DE TÍTULO ===
    const title = $('h1.entry-title').text().trim() || 
                  $('h1.post-title').text().trim() ||
                  $('h1.title').text().trim() ||
                  $('h1[itemprop="name"]').text().trim() ||
                  $('h1.app-name').text().trim() ||
                  $('h1').first().text().trim() ||
                  $('title').text().replace(/download|apk|free/gi, '').trim() ||
                  'APK Download';

    // === EXTRACCIÓN DE VERSIÓN ===
    const version = $('.version').text().trim() || 
                    $('span[itemprop="softwareVersion"]').text().trim() ||
                    $('span:contains("Version")').next().text().trim() ||
                    $('div:contains("Version")').text().match(/v?[\d.]+/i)?.[0] ||
                    $('*:contains("Version")').text().match(/v?[\d.]+/i)?.[0];

    // === EXTRACCIÓN DE FECHA ===
    const date = $('.post-date').text().trim() || 
                 $('time').text().trim() ||
                 $('time').attr('datetime') ||
                 $('.date').text().trim() ||
                 $('span[itemprop="datePublished"]').text().trim();

    // === EXTRACCIÓN DE TAMAÑO ===
    const size = $('*:contains("Size")').text().match(/[\d.]+ [KMGT]B/i)?.[0] ||
                 $('*:contains("Tamaño")').text().match(/[\d.]+ [KMGT]B/i)?.[0] ||
                 $('.file-size').text().trim() ||
                 $('span:contains("MB")').text().match(/[\d.]+ MB/i)?.[0];

    // === EXTRACCIÓN DE ENLACE DE DESCARGA (MÚLTIPLES MÉTODOS) ===
    let downloadUrl = null;
    const baseUrl = new URL(url);

    // Método 1: Botones y enlaces directos con clases comunes
    const downloadSelectors = [
        'a.download-button', 'a#download-button', 'a.btn-download',
        'button.download-btn', '.download-btn a', '#download-btn',
        'a.button.download', 'a[data-download]', 'a.apk-download',
        '.download-link', '#download_link', 'a.dl-button',
        'a#downloadButton', 'a.btn.btn-download', '.btn-success[href]'
    ];

    for (const selector of downloadSelectors) {
        const href = $(selector).attr('href') || $(selector).attr('data-url') || $(selector).attr('data-href');
        if (href && !href.includes('javascript') && !href.startsWith('#')) {
            downloadUrl = href;
            break;
        }
    }
   
       // Método 2: Enlaces que terminan en .apk
    if (!downloadUrl) {
        $('a[href$=".apk"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('javascript')) {
                downloadUrl = href;
                return false;
            }
        });
    }

    // Método 3: Enlaces que contienen "download" y ".apk"
    if (!downloadUrl) {
        $('a[href*="download"][href*=".apk"], a[href*=".apk"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('javascript') && !href.startsWith('#')) {
                downloadUrl = href;
                return false;
            }
        });
    }

    // Método 4: Botones con texto "Download" o variaciones
    if (!downloadUrl) {
        const downloadTexts = ['Download', 'Descargar', 'DOWNLOAD', 'Download APK', 
                               'GET', 'Baixar', 'Télécharger', 'Herunterladen'];
        for (const text of downloadTexts) {
            const link = $(`a:contains("${text}")`).first();
            const href = link.attr('href');
            if (href && !href.includes('javascript') && !href.startsWith('#')) {
                downloadUrl = href;
                break;
            }
        }
    }

    // Método 5: Enlaces a servicios de hosting/CDN comunes
    if (!downloadUrl) {
        const commonHosts = [
            'mediafire', 'mega.nz', 'drive.google', 'dropbox', 
            'direct', 'cdn', 'dl.', 'download.', 'files.',
            'storage', 's3.amazonaws', 'cloudfront', 'apk-dl'
        ];
        $('a[href]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && commonHosts.some(host => href.toLowerCase().includes(host))) {
                downloadUrl = href;
                return false;
            }
        });
    }

    // Método 6: Buscar en atributos data-*
    if (!downloadUrl) {
        $('a[data-file], a[data-link], a[data-download-url], button[data-url]').each((i, el) => {
            const href = $(el).attr('data-file') || 
                        $(el).attr('data-link') || 
                        $(el).attr('data-download-url') ||
                        $(el).attr('data-url');
            if (href && href.length > 10) {
                downloadUrl = href;
                return false;
            }
        });
    }

    // Método 7: Buscar en scripts inline (JSON data)
    if (!downloadUrl) {
        $('script').each((i, el) => {
            const scriptContent = $(el).html();
            if (scriptContent) {
                // Buscar URLs en el script
                const apkMatch = scriptContent.match(/https?:\/\/[^\s"']+\.apk/i);
                if (apkMatch) {
                    downloadUrl = apkMatch[0];
                    return false;
                }
                // Buscar variables de descarga
                const dlMatch = scriptContent.match(/download[Uu]rl\s*[:=]\s*["']([^"']+)["']/);
                if (dlMatch) {
                    downloadUrl = dlMatch[1];
                    return false;
                }
            }
        });
    }

    // Método 8: Meta tags y links en head
    if (!downloadUrl) {
        downloadUrl = $('meta[property="og:url"]').attr('content') ||
                     $('link[rel="alternate"][type="application/vnd.android.package-archive"]').attr('href');
    }

    // Método 9: Iframes con contenido de descarga
    if (!downloadUrl) {
        $('iframe[src*="download"], iframe[src*=".apk"]').each((i, el) => {
            const src = $(el).attr('src');
            if (src) {
                downloadUrl = src;
                return false;
            }
        });
    }

    // Método 10: Buscar en elementos ocultos
    if (!downloadUrl) {
        $('input[type="hidden"][value*=".apk"], input[type="hidden"][value*="download"]').each((i, el) => {
            const value = $(el).attr('value');
            if (value && value.startsWith('http')) {
                downloadUrl = value;
                return false;
            }
        });
    }

    if (!downloadUrl) {
        throw new Error('No se encontró enlace de descarga válido en la página. El sitio puede requerir JavaScript o autenticación.');
    }

    // === NORMALIZAR URL DE DESCARGA ===
    // Convertir URL relativa a absoluta
    if (downloadUrl.startsWith('//')) {
        downloadUrl = baseUrl.protocol + downloadUrl;
    } else if (downloadUrl.startsWith('/')) {
        downloadUrl = `${baseUrl.protocol}//${baseUrl.host}${downloadUrl}`;
    } else if (!downloadUrl.startsWith('http')) {
        downloadUrl = `${baseUrl.protocol}//${baseUrl.host}/${downloadUrl}`;
    }

    // Limpiar parámetros sospechosos
    try {
        const urlObj = new URL(downloadUrl);
        // Mantener solo parámetros importantes
        const importantParams = ['id', 'file', 'download', 'token', 'key'];
        const newParams = new URLSearchParams();
        importantParams.forEach(param => {
            if (urlObj.searchParams.has(param)) {
                newParams.set(param, urlObj.searchParams.get(param));
            }
        });
        urlObj.search = newParams.toString();
        downloadUrl = urlObj.toString();
    } catch (e) {
        // Si falla el parsing, usar URL original
    }

    return {
        title: title.substring(0, 100).replace(/\s+/g, ' ').trim(),
        version: version || null,
        date: date || null,
        size: size || null,
        downloadUrl
    };
}

// ============================================
// CONFIGURACIÓN DEL HANDLER
// ============================================

handler.help = ['apkurl <url>'];
handler.tags = ['downloader'];
handler.command = /^(apkurl|apkdl|downloadapk|getapk)$/i;
handler.register = true;
handler.limit = 3;

export default handler;