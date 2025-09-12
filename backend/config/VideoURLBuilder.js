const db = require('./database');

class VideoURLBuilder {
    constructor() {
        this.defaultPort = 1443;
        this.playScript = 'play.php';
    }

    // Sanitizar nome da pasta para URL
    sanitizeFolderName(folderName) {
        if (!folderName) return 'default';
        
        return folderName
            .toLowerCase() // Converter para minúsculas
            .normalize('NFD') // Normalizar caracteres acentuados
            .replace(/[\u0300-\u036f]/g, '') // Remover acentos
            .replace(/[^a-z0-9-_]/g, '') // Permitir apenas letras, números, hífen e underscore
            .substring(0, 50) // Limitar tamanho
            || 'default'; // Fallback se ficar vazio
    }

    // Obter domínio do servidor Wowza
    async getWowzaDomain(serverId = null) {
        try {
            let query = 'SELECT dominio, ip FROM wowza_servers WHERE status = "ativo"';
            let params = [];

            if (serverId) {
                query += ' AND codigo = ?';
                params.push(serverId);
            } else {
                query += ' ORDER BY streamings_ativas ASC LIMIT 1';
            }

            const [rows] = await db.execute(query, params);
            
            if (rows.length > 0) {
                const server = rows[0];
                // SEMPRE usar domínio do Wowza, NUNCA o domínio da aplicação
                return server.dominio || 'stmv1.udicast.com';
            }
            
            // Fallback sempre para domínio do Wowza
            return 'stmv1.udicast.com';
        } catch (error) {
            console.error('Erro ao obter domínio do servidor:', error);
            // Fallback sempre para domínio do Wowza
            return 'stmv1.udicast.com';
        }
    }

    // Construir URL de visualização de vídeo
    async buildVideoViewUrl(userLogin, folderName, fileName, serverId = null) {
        try {
            const domain = await this.getWowzaDomain(serverId);
            const sanitizedFolder = this.sanitizeFolderName(folderName);
            
            // Garantir que o arquivo tem extensão
            const finalFileName = fileName.includes('.') ? fileName : `${fileName}.mp4`;
            
            const url = `https://${domain}:${this.defaultPort}/${this.playScript}?login=${userLogin}&video=${sanitizedFolder}/${finalFileName}`;
            
            console.log(`🎥 URL construída: ${url}`);
            return url;
        } catch (error) {
            console.error('Erro ao construir URL de vídeo:', error);
            return null;
        }
    }

    // Construir URL de visualização baseada no caminho completo
    async buildVideoUrlFromPath(videoPath, userLogin, serverId = null) {
        try {
            const pathParts = videoPath.split('/');
            
            let folderName = 'default';
            let fileName = 'video.mp4';
            
            // Tentar extrair pasta e arquivo do caminho
            if (pathParts.length >= 5) {
                folderName = pathParts[4];
                fileName = pathParts[5] || 'video.mp4';
            } else if (pathParts.length >= 3) {
                // Para estrutura streaming/usuario/pasta/arquivo
                if (pathParts[0] === 'streaming') {
                    folderName = pathParts[2] || 'default';
                    fileName = pathParts[3] || 'video.mp4';
                } else {
                    folderName = pathParts[1] || 'default';
                    fileName = pathParts[2] || 'video.mp4';
                }
            } else if (pathParts.length >= 2) {
                folderName = pathParts[0];
                fileName = pathParts[2] || 'video.mp4';
            } else if (pathParts.length >= 1) {
                fileName = pathParts[pathParts.length - 1];
            }
            
            console.log(`🔍 Extraindo do caminho ${videoPath}: pasta=${folderName}, arquivo=${fileName}`);
            
            return await this.buildVideoViewUrl(userLogin, folderName, fileName, serverId);
        } catch (error) {
            console.error('Erro ao construir URL do caminho:', error);
            return null;
        }
    }

    // Construir URL de visualização baseada nos dados do vídeo do banco
    async buildVideoUrlFromDatabase(videoId, userId) {
        try {
            // Buscar dados do vídeo
            const [videoRows] = await db.execute(
                `SELECT v.nome, v.url, v.caminho, f.nome_sanitizado as folder_name, f.servidor_id as codigo_servidor
                 FROM videos v
                 LEFT JOIN folders f ON v.pasta = f.id
                 WHERE v.id = ? AND v.codigo_cliente = ?`,
                [videoId, userId]
            );

            if (videoRows.length === 0) {
                throw new Error('Vídeo não encontrado');
            }

            const video = videoRows[0];
            const serverId = video.codigo_servidor || 1;

            // Buscar login do usuário
            const [userRows] = await db.execute(
                'SELECT usuario, email FROM streamings WHERE codigo_cliente = ? LIMIT 1',
                [userId]
            );

            const userLogin = userRows.length > 0 && userRows[0].usuario ? 
                userRows[0].usuario : 
                (userRows[0]?.email ? userRows[0].email.split('@')[0] : `user_${userId}`);

            // Construir URL
            return await this.buildVideoViewUrl(
                userLogin, 
                video.folder_name || 'default', 
                video.nome, 
                serverId
            );
        } catch (error) {
            console.error('Erro ao construir URL do banco:', error);
            return null;
        }
    }

    // Validar se URL está no formato correto
    isValidVideoUrl(url) {
        if (!url) return false;
        
        const pattern = /^https:\/\/[^:]+:1443\/play\.php\?login=[^&]+&video=[^&]+$/;
        return pattern.test(url);
    }

    // Extrair informações da URL
    parseVideoUrl(url) {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            
            return {
                domain: urlObj.hostname,
                login: params.get('login'),
                video: params.get('video'),
                folder: params.get('video')?.split('/')[0],
                filename: params.get('video')?.split('/')[1]
            };
        } catch (error) {
            console.error('Erro ao parsear URL:', error);
            return null;
        }
    }
}

module.exports = new VideoURLBuilder();