import axios from 'axios';
import cheerio from 'cheerio';

const userMessages = new Map();
const userRequests = {};

const handler = async (m, { conn, usedPrefix, command, text }) => {
    if (!text) {
        return m.reply(`╭━━━━━━━━━⬣
┃ ⚠️ *USO INCORRECTO*
┃
┃ Escribe el nombre del APK
┃ o la URL completa
┃
┃ 📌 *Ejemplos:*
┃ • ${usedPrefix + command} minecraft
┃ • ${usedPrefix + command} https://mcpedl.org/...
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
        let apkData;

        if (text.startsWith('http')) {
            // Buscar directamente en la URL proporcionada
            apkData = await scrapeAPKFromPage(text);
        } else {
            // Buscar en MCPEDL
            const searchUrl = `https://mcpedl.org/?s=${encodeURIComponent(text)}`;
            const { data } = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const $ = cheerio.load(data);

            // Buscar el primer resultado
            const firstResult = $('.g-block.size-20 article').first();
            const pageUrl = firstResult.find('a').attr('href');

            if (!pageUrl) throw new Error('No se encontraron resultados');

            m.react('⌛');
            apkData = await scrapeAPKFromPage(pageUrl);
        }

        // Mostrar información del APK
        const infoMsg = `╭━━━━━━━━━⬣
┃ 📦 *MINECRAFT APK*
┃━━━━━━━━━━━━━━━
┃ 
┃ 📌 *Título:* ${apkData.title}
┃ 📊 *Versión:* ${apkData.version || 'No especificada'}
┃ 💾 *Tamaño:* ${apkData.size || 'Calculando...'}
┃ 📅 *Actualización:* ${apkData.date || 'N/A'}
┃ 
┃━━━━━━━━━━━━━━━
┃ 🔗 *Enlace:* ${apkData.downloadUrl}
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
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const fileName = apkData.title.replace(/[^a-zA-Z0-9]/g, '_') + '.apk';

        // Enviar el APK
        await conn.sendMessage(
            m.chat,
            {
                document: apkResponse.data,
                mimetype: 'application/vnd.android.package-archive',
                fileName: fileName
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
┃ 
┃ ⚠️ *Nota:* Instala bajo tu
┃ responsabilidad
╰━━━━━━━━━⬣`
            },
            { quoted: m }
        );

    } catch (e) {
        m.react('❌');
        console.error('Error completo:', e);
        
        const errorMsg = `╭━━━━━━━━━⬣
┃ ❌ *ERROR*
┃
┃ No se pudo descargar el APK
┃ 
┃ *Posibles causas:*
┃ • Enlace inválido
┃ • APK no disponible
┃ • Error de conexión
┃
┃ *Solución:*
┃ • Verifica el nombre
┃ • Intenta con la URL directa
┃ • Usa: ${usedPrefix}apk minecraft
╰━━━━━━━━━⬣`;
        
        m.reply(errorMsg);
    } finally {
        delete userRequests[m.sender];
    }
};

// Función para extraer información del APK de una página
async function scrapeAPKFromPage(url) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);

    // Buscar el título
    const title = $('h1.entry-title').text().trim() || 
                  $('title').text().trim() || 
                  'Minecraft APK';

    // Buscar versión
    const version = $('.version').text().trim() || 
                    $('span:contains("Version")').next().text().trim() ||
                    $('p:contains("Version")').text().match(/[\d.]+/)?.[0];

    // Buscar fecha
    const date = $('.post-date').text().trim() || 
                 $('time').text().trim();

    // Buscar tamaño
    const size = $('span:contains("Size")').text().match(/[\d.]+ [MG]B/)?.[0] ||
                 $('.file-size').text().trim();

    // Buscar enlaces de descarga
    let downloadUrl = null;

    // Método 1: Botón de descarga directo
    downloadUrl = $('a.download-button, a#download-button, .download-btn').attr('href');

    // Método 2: Enlaces que contengan .apk
    if (!downloadUrl) {
        $('a[href*=".apk"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.includes('download') || href.endsWith('.apk'))) {
                downloadUrl = href;
                return false;
            }
        });
    }

    // Método 3: Buscar en botones de descarga
    if (!downloadUrl) {
        $('a:contains("Download"), a:contains("Descargar")').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('javascript')) {
                downloadUrl = href;
                return false;
            }
        });
    }

    // Método 4: Buscar enlaces de mediafire, mega, etc
    if (!downloadUrl) {
        const commonHosts = ['mediafire', 'mega', 'drive.google', 'dropbox', 'direct'];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && commonHosts.some(host => href.includes(host))) {
                downloadUrl = href;
                return false;
            }
        });
    }

    if (!downloadUrl) {
        throw new Error('No se encontró enlace de descarga en la página');
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
        title,
        version,
        date,
        size,
        downloadUrl
    };
}

handler.help = ['apk'];
handler.tags = ['downloader'];
handler.command = /^(apk|mcpedl)$/i;
handler.register = true;
handler.limit = 2;

export default handler;