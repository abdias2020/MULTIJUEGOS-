import axios from 'axios';
import cheerio from 'cheerio';

const handler = async (m, { conn, usedPrefix, command, text }) => {
    if (!text) {
        return m.reply('⚠️ Proporciona una URL\n\nEjemplo:\n' + usedPrefix + command + 'https://américa tv.coml');
    }

    m.react('🔍');

    try {
        // Obtener el contenido de la página
        const { data } = await axios.get(text, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);

        // Buscar enlace de Mediafire
        let mediafireUrl = null;

        // Método 1: Buscar en enlaces directos
        $('a[href*="mediafire.com"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('mediafire.com/file/')) {
                mediafireUrl = href;
                return false;
            }
        });

        // Método 2: Buscar en botones de descarga
        if (!mediafireUrl) {
            const downloadButtons = $('a.download-button, a#download-button, a.btn-download, .download-btn a');
            downloadButtons.each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('mediafire')) {
                    mediafireUrl = href;
                    return false;
                }
            });
        }

        // Método 3: Buscar en cualquier enlace que contenga "mediafire"
        if (!mediafireUrl) {
            $('a[href]').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.toLowerCase().includes('mediafire')) {
                    mediafireUrl = href;
                    return false;
                }
            });
        }

        if (!mediafireUrl) {
            return m.reply('❌ No se encontró enlace de Mediafire en esta página');
        }

        m.react('📁');

        // Extraer información de la página (opcional)
        const title = $('h1').first().text().trim() || 
                      $('.entry-title').text().trim() || 
                      $('title').text().trim() || 
                      'Archivo APK';

        // Mostrar información
        await m.reply(`╭━━━━━━━━━⬣
┃ 📦 *APK ENCONTRADO*
┃━━━━━━━━━━━━━━━
┃ 
┃ 📌 *Título:* ${title}
┃ 🔗 *Enlace:* Mediafire detectado
┃ 
┃ ⏳ *Descargando con plugin de Mediafire...*
╰━━━━━━━━━⬣`);

        m.react('📥');

        // Importar y usar el plugin de Mediafire
        const mediafireModule = await import('./descargas-mediafire.js');
        const mediafireHandler = mediafireModule.default;

        // Crear mensaje falso para el plugin
        const fakeMessage = {
            ...m,
            text: mediafireUrl
        };

        // Ejecutar el plugin de Mediafire
        await mediafireHandler(fakeMessage, {
            conn,
            usedPrefix,
            command: 'mediafire',
            text: mediafireUrl
        });

        m.react('✅');

        await m.reply(`╭━━━━━━━━━⬣
┃ ✅ *DESCARGA COMPLETADA*
┃
┃ 📦 ${title}
┃ 📁 Fuente: Mediafire
┃ 
┃ 📲 Abre el APK e instala
╰━━━━━━━━━⬣`);

    } catch (error) {
        m.react('❌');
        console.error('Error:', error);
        
        let errorMsg = '❌ Error al procesar la página\n\n';
        
        if (error.message.includes('Cannot find module')) {
            errorMsg += '⚠️ No se encontró el plugin de Mediafire\n';
            errorMsg += 'Asegúrate de que existe: /plugins/descargas-mediafire.js';
        } else if (error.code === 'ENOTFOUND') {
            errorMsg += '⚠️ No se pudo acceder a la página\n';
            errorMsg += 'Verifica que la URL sea correcta';
        } else {
            errorMsg += '⚠️ ' + (error.message || 'Error desconocido');
        }
        
        m.reply(errorMsg);
    }
};

handler.help = ['apkurl <url>'];
handler.tags = ['downloader'];
handler.command = /^(apkurl|apkdl|getapk)$/i;
handler.register = true;
handler.limit = 2;

export default handler;