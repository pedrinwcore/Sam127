const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

class SSHManager {
    constructor() {
        this.connections = new Map();
    }

    async getConnection(serverId) {
        try {
            // Buscar dados do servidor no banco
            const db = require('./database');
            const [serverRows] = await db.execute(
                'SELECT ip, porta_ssh, senha_root FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
                [serverId]
            );

            if (serverRows.length === 0) {
                throw new Error('Servidor não encontrado ou inativo');
            }

            const server = serverRows[0];
            const connectionKey = `${server.ip}:${server.porta_ssh}`;

            // Verificar se já existe conexão ativa
            if (this.connections.has(connectionKey)) {
                const existingConn = this.connections.get(connectionKey);
                if (existingConn.conn && existingConn.conn._sock && !existingConn.conn._sock.destroyed) {
                    return existingConn;
                }
                // Remover conexão inválida
                this.connections.delete(connectionKey);
            }

            // Criar nova conexão SSH
            const conn = new Client();
            
            return new Promise((resolve, reject) => {
                conn.on('ready', () => {
                    console.log(`✅ Conectado via SSH ao servidor ${server.ip}`);
                    
                    const connectionData = {
                        conn,
                        server,
                        connected: true,
                        lastUsed: new Date()
                    };
                    
                    this.connections.set(connectionKey, connectionData);
                    resolve(connectionData);
                });

                conn.on('error', (err) => {
                    console.error(`❌ Erro SSH para ${server.ip}:`, err);
                    reject(err);
                });

                conn.on('close', () => {
                    console.log(`🔌 Conexão SSH fechada para ${server.ip}`);
                    this.connections.delete(connectionKey);
                });

                // Conectar
                conn.connect({
                    host: server.ip,
                    port: server.porta_ssh || 22,
                    username: 'root',
                    password: server.senha_root,
                    readyTimeout: 30000,
                    keepaliveInterval: 30000
                });
            });

        } catch (error) {
            console.error('Erro ao obter conexão SSH:', error);
            throw error;
        }
    }

    async executeCommand(serverId, command) {
        try {
            const { conn } = await this.getConnection(serverId);
            
            return new Promise((resolve, reject) => {
                conn.exec(command, (err, stream) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    let stdout = '';
                    let stderr = '';

                    stream.on('close', (code, signal) => {
                        if (code === 0) {
                            resolve({ success: true, stdout, stderr, code });
                        } else {
                            reject(new Error(`Comando falhou com código ${code}: ${stderr}`));
                        }
                    });

                    stream.on('data', (data) => {
                        stdout += data.toString();
                    });

                    stream.stderr.on('data', (data) => {
                        stderr += data.toString();
                    });
                });
            });
        } catch (error) {
            console.error('Erro ao executar comando SSH:', error);
            throw error;
        }
    }

    async uploadFile(serverId, localPath, remotePath) {
        try {
            const { conn } = await this.getConnection(serverId);
            
            return new Promise((resolve, reject) => {
                conn.sftp((err, sftp) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Criar diretório remoto se não existir
                    const remoteDir = path.dirname(remotePath);
                    sftp.mkdir(remoteDir, { mode: 0o755 }, (mkdirErr) => {
                        // Ignorar erro se diretório já existir
                        
                        sftp.fastPut(localPath, remotePath, (uploadErr) => {
                            if (uploadErr) {
                                reject(uploadErr);
                                return;
                            }

                            // Definir permissões do arquivo
                            sftp.chmod(remotePath, 0o644, (chmodErr) => {
                                if (chmodErr) {
                                    console.warn('Aviso: Não foi possível definir permissões:', chmodErr);
                                }
                                
                                console.log(`✅ Arquivo enviado com sucesso: ${path.basename(remotePath)}`);
                                resolve({ success: true, remotePath });
                            });
                        });
                    });
                });
            });
        } catch (error) {
            console.error('Erro ao fazer upload via SSH:', error);
            throw error;
        }
    }

    // Método para obter informações de uma pasta
    async getFolderInfo(serverId, folderPath) {
        try {
            // Verificar se pasta existe
            const existsCommand = `test -d "${folderPath}" && echo "EXISTS" || echo "NOT_EXISTS"`;
            const existsResult = await this.executeCommand(serverId, existsCommand);
            const exists = existsResult.stdout.includes('EXISTS');

            if (!exists) {
                return {
                    exists: false,
                    path: folderPath,
                    file_count: 0,
                    size_mb: 0
                };
            }

            // Contar arquivos
            const countCommand = `find "${folderPath}" -type f | wc -l`;
            const countResult = await this.executeCommand(serverId, countCommand);
            const fileCount = parseInt(countResult.stdout.trim()) || 0;

            // Calcular tamanho
            const sizeCommand = `du -sb "${folderPath}" 2>/dev/null | cut -f1 || echo "0"`;
            const sizeResult = await this.executeCommand(serverId, sizeCommand);
            const sizeBytes = parseInt(sizeResult.stdout.trim()) || 0;
            const sizeMB = Math.ceil(sizeBytes / (1024 * 1024));

            return {
                exists: true,
                path: folderPath,
                file_count: fileCount,
                size_mb: sizeMB,
                size_bytes: sizeBytes
            };
        } catch (error) {
            console.error(`Erro ao obter informações da pasta ${folderPath}:`, error);
            return {
                exists: false,
                path: folderPath,
                file_count: 0,
                size_mb: 0,
                error: error.message
            };
        }
    }

    async createUserDirectory(serverId, userLogin) {
        try {
            // Estrutura simplificada: /home/streaming/[usuario]
            const userDir = `/home/streaming/${userLogin}`;
            const commands = [
                `mkdir -p ${userDir}`,
                `chmod -R 755 ${userDir} || true`,
                `chown -R streaming:streaming ${userDir} || true`
            ];

            for (const command of commands) {
                try {
                    await this.executeCommand(serverId, command);
                } catch (cmdError) {
                    console.warn(`Aviso ao executar comando "${command}":`, cmdError.message);
                    // Continuar mesmo com erros de permissão
                }
            }

            console.log(`✅ Diretório criado para usuário ${userLogin} no servidor ${serverId}`);
            return { success: true, userDir };
        } catch (error) {
            console.error(`Erro ao criar diretório para usuário ${userLogin}:`, error);
            return { success: false, error: error.message };
        }
    }

    async createUserFolder(serverId, userLogin, folderName) {
        try {
            // Estrutura simplificada: /home/streaming/[usuario]/[pasta]
            const folderPath = `/home/streaming/${userLogin}/${folderName}`;
            const commands = [
                `mkdir -p ${folderPath}`,
                `chmod -R 755 ${folderPath} || true`,
                `chown -R streaming:streaming ${folderPath} || true`
            ];

            for (const command of commands) {
                try {
                    await this.executeCommand(serverId, command);
                } catch (cmdError) {
                    console.warn(`Aviso ao executar comando "${command}":`, cmdError.message);
                    // Continuar mesmo com erros de permissão
                }
            }

            console.log(`✅ Pasta ${folderName} criada para usuário ${userLogin}`);
            console.log(`📁 Caminho completo: ${folderPath}`);
            return { success: true, folderPath };
        } catch (error) {
            console.error(`Erro ao criar pasta ${folderName}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Criar estrutura completa do usuário (streaming + wowza)
    async createCompleteUserStructure(serverId, userLogin, userConfig) {
        try {
            console.log(`🏗️ Criando estrutura simplificada para usuário: ${userLogin}`);

            // Criar estrutura básica de streaming
            const result = await this.createUserDirectory(serverId, userLogin);
            
            if (!result.success) {
                console.warn(`Aviso ao criar diretório para ${userLogin}:`, result.error);
                // Continuar mesmo com erro
            }

            console.log(`✅ Estrutura simplificada criada para ${userLogin}`);
            return { success: true };

        } catch (error) {
            console.error(`Erro ao criar estrutura para ${userLogin}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Verificar estrutura completa do usuário
    async checkCompleteUserStructure(serverId, userLogin) {
        try {
            // Verificar estrutura de streaming
            const streamingPath = `/home/streaming/${userLogin}`;
            const streamingExists = await this.checkDirectoryExists(serverId, streamingPath);

            return {
                streaming_directory: streamingExists,
                complete: streamingExists,
                user_login: userLogin,
                streaming_path: streamingPath
            };

        } catch (error) {
            console.error(`Erro ao verificar estrutura completa do usuário ${userLogin}:`, error);
            return {
                streaming_directory: false,
                complete: false,
                user_login: userLogin,
                error: error.message
            };
        }
    }

    async checkDirectoryExists(serverId, path) {
        try {
            const command = `test -d "${path}" && echo "EXISTS" || echo "NOT_EXISTS"`;
            const result = await this.executeCommand(serverId, command);
            return result.stdout.includes('EXISTS');
        } catch (error) {
            return false;
        }
    }

    async deleteFile(serverId, remotePath) {
        try {
            const command = `rm -f "${remotePath}"`;
            await this.executeCommand(serverId, command);
            
            console.log(`✅ Arquivo removido: ${remotePath}`);
            return { success: true };
        } catch (error) {
            console.error(`Erro ao remover arquivo ${remotePath}:`, error);
            throw error;
        }
    }

    async listFiles(serverId, remotePath) {
        try {
            const command = `ls -la "${remotePath}"`;
            const result = await this.executeCommand(serverId, command);
            
            return { success: true, files: result.stdout };
        } catch (error) {
            console.error(`Erro ao listar arquivos em ${remotePath}:`, error);
            throw error;
        }
    }

    async getFileInfo(serverId, remotePath) {
        try {
            const command = `ls -la "${remotePath}" 2>/dev/null || echo "FILE_NOT_FOUND"`;
            const result = await this.executeCommand(serverId, command);
            
            if (result.stdout.includes('FILE_NOT_FOUND')) {
                return { exists: false };
            }

            return { 
                exists: true, 
                info: result.stdout,
                size: this.extractFileSize(result.stdout),
                permissions: this.extractPermissions(result.stdout)
            };
        } catch (error) {
            return { exists: false };
        }
    }

    extractFileSize(lsOutput) {
        try {
            const parts = lsOutput.trim().split(/\s+/);
            return parseInt(parts[4]) || 0;
        } catch (error) {
            return 0;
        }
    }

    extractPermissions(lsOutput) {
        try {
            const parts = lsOutput.trim().split(/\s+/);
            return parts[0] || '';
        } catch (error) {
            return '';
        }
    }

    closeConnection(serverId) {
        try {
            const db = require('./database');
            db.execute('SELECT ip, porta_ssh FROM wowza_servers WHERE codigo = ?', [serverId])
                .then(([serverRows]) => {
                    if (serverRows.length > 0) {
                        const server = serverRows[0];
                        const connectionKey = `${server.ip}:${server.porta_ssh}`;
                        
                        if (this.connections.has(connectionKey)) {
                            const { conn } = this.connections.get(connectionKey);
                            conn.end();
                            this.connections.delete(connectionKey);
                            console.log(`🔌 Conexão SSH fechada para ${server.ip}`);
                        }
                    }
                });
        } catch (error) {
            console.error('Erro ao fechar conexão SSH:', error);
        }
    }

    closeAllConnections() {
        for (const [key, { conn }] of this.connections) {
            try {
                conn.end();
                console.log(`🔌 Conexão SSH fechada: ${key}`);
            } catch (error) {
                console.error(`Erro ao fechar conexão ${key}:`, error);
            }
        }
        this.connections.clear();
    }
}

module.exports = new SSHManager();