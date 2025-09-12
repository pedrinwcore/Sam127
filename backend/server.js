const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const db = require('./config/database');
const SSHManager = require('./config/SSHManager');

const authRoutes = require('./routes/auth');
const foldersRoutes = require('./routes/folders');
const videosRoutes = require('./routes/videos');
const playlistsRoutes = require('./routes/playlists');
const agendamentosRoutes = require('./routes/agendamentos');
const comerciaisRoutes = require('./routes/comerciais');
const downloadyoutubeRoutes = require('./routes/downloadyoutube');
const espectadoresRoutes = require('./routes/espectadores');
const streamingRoutes = require('./routes/streaming');
const relayRoutes = require('./routes/relay');
const logosRoutes = require('./routes/logos');
const transmissionSettingsRoutes = require('./routes/transmission-settings');
const ftpRoutes = require('./routes/ftp');
const serversRoutes = require('./routes/servers');
const playersRoutes = require('./routes/players');
const videosSSHRoutes = require('./routes/videos-ssh');
const conversionRoutes = require('./routes/conversion');
const videoStreamRoutes = require('./routes/video-stream');
const userWowzaSetupRoutes = require('./routes/user-wowza-setup');
const appMultiplataformaRoutes = require('./routes/app-multiplataforma');
const appAndroidRoutes = require('./routes/app-android');
const smilManagementRoutes = require('./routes/smil-management');
const dadosConexaoRoutes = require('./routes/dados-conexao');
const playerExternalRoutes = require('./routes/player-external');
const playerPortRoutes = require('./routes/player-port');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(cors({
  origin: isProduction ? [
    'http://samhost.wcore.com.br',
    'https://samhost.wcore.com.br',
    'http://samhost.wcore.com.br:3000'
  ] : [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/content', async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);
    if (!token && req.query.auth_token) token = req.query.auth_token;
    if (!token) return res.status(401).json({ error: 'Token de acesso requerido' });

    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura_aqui';
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (jwtError) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const requestPath = req.path.startsWith('/') ? req.path : `/${req.path}`;
    if (requestPath.includes('/api/videos-ssh/')) return next();

    const isVideoFile = /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i.test(requestPath);
    const isStreamFile = /\.(m3u8|ts)$/i.test(requestPath);
    if (!isVideoFile && !isStreamFile) return res.status(404).json({ error: 'Arquivo não encontrado' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Accept-Ranges', 'bytes');

    if (isStreamFile) {
      if (requestPath.includes('.m3u8')) res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      else if (requestPath.includes('.ts')) res.setHeader('Content-Type', 'video/mp2t');
    } else {
      if (requestPath.includes('.mp4')) res.setHeader('Content-Type', 'video/mp4');
      else if (requestPath.includes('.avi')) res.setHeader('Content-Type', 'video/x-msvideo');
      else if (requestPath.includes('.mov')) res.setHeader('Content-Type', 'video/quicktime');
      else if (requestPath.includes('.wmv')) res.setHeader('Content-Type', 'video/x-ms-wmv');
      else if (requestPath.includes('.webm')) res.setHeader('Content-Type', 'video/webm');
      else if (requestPath.includes('.mkv')) res.setHeader('Content-Type', 'video/x-matroska');
      else res.setHeader('Content-Type', 'video/mp4');
    }

    if (isStreamFile) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else res.setHeader('Cache-Control', 'public, max-age=3600');

    const cleanPath = requestPath.replace('/content/', '').replace(/^\/+/, '');
    const pathParts = cleanPath.split('/');
    if (pathParts.length < 3) return res.status(404).json({ error: 'Caminho de vídeo inválido' });

    let userLogin = pathParts[0];
    let folderName = pathParts[1];
    let fileName = pathParts[2];

    let wowzaHost = '51.222.156.223';
    let wowzaPort = 6980;
    let wowzaUser = 'admin';
    let wowzaPassword = 'FK38Ca2SuE6jvJXed97VMn';

    try {
      const [userServerRows] = await db.execute(
        'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? OR usuario = ? LIMIT 1',
        [req.user.userId, userLogin]
      );

      if (userServerRows.length > 0) {
        const serverId = userServerRows[0].codigo_servidor;
        const [serverRows] = await db.execute(
          'SELECT ip, dominio, senha_root FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
          [serverId]
        );

        if (serverRows.length > 0) {
          const server = serverRows[0];
          wowzaHost = server.dominio || server.ip;
          wowzaPassword = server.senha_root || wowzaPassword;
        }
      }
    } catch {}

    const fileExtension = path.extname(fileName).toLowerCase();
    const finalFileName = fileName.endsWith('.mp4') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp4');

    const fetch = require('node-fetch');
    let wowzaUrl;
    if (isStreamFile) {
      const mp4Path = `${userLogin}/${folderName}/${finalFileName}`;
      wowzaUrl = `http://${wowzaHost}:1935/vod/_definst_/mp4:${mp4Path}/playlist.m3u8`;
    } else {
      const mp4Path = `${userLogin}/${folderName}/${finalFileName}`;
      wowzaUrl = `http://${wowzaUser}:${wowzaPassword}@${wowzaHost}:${wowzaPort}/content/${mp4Path}`;
    }

    try {
      const requestHeaders = {
        'Range': req.headers.range || '',
        'User-Agent': 'Streaming-System/1.0',
        'Accept': '*/*',
        'Cache-Control': isStreamFile ? 'no-cache' : 'public, max-age=3600',
        'Connection': 'keep-alive'
      };

      const wowzaResponse = await fetch(wowzaUrl, {
        method: req.method,
        headers: requestHeaders,
        timeout: 30000
      });

      if (!wowzaResponse.ok) {
        if (finalFileName !== fileName) {
          const originalUrl = isStreamFile ?
            `http://${wowzaHost}:1935/vod/_definst_/mp4:${userLogin}/${folderName}/${fileName}/playlist.m3u8` :
            `http://${wowzaUser}:${wowzaPassword}@${wowzaHost}:${wowzaPort}/content/${userLogin}/${folderName}/${fileName}`;
          const originalResponse = await fetch(originalUrl, { method: req.method, headers: requestHeaders, timeout: 30000 });
          if (originalResponse.ok) {
            originalResponse.headers.forEach((value, key) => {
              if (!res.headersSent) res.setHeader(key, value);
            });
            return originalResponse.body.pipe(res);
          }
        }
        return res.status(404).json({ error: 'Vídeo não encontrado', attempted_urls: [wowzaUrl] });
      }

      wowzaResponse.headers.forEach((value, key) => {
        if (!res.headersSent) res.setHeader(key, value);
      });
      wowzaResponse.body.pipe(res);
    } catch {
      res.redirect(wowzaUrl);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.use('/wowza-direct', async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);
    if (!token && req.query.auth_token) token = req.query.auth_token;
    if (!token) return res.status(401).json({ error: 'Token de acesso requerido' });

    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura_aqui';
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const requestPath = req.path.replace('/wowza-direct/', '');
    const userLogin = requestPath.split('/')[0];

    let wowzaHost = '51.222.156.223';
    let wowzaPort = 6980;
    let wowzaUser = 'admin';
    let wowzaPassword = 'FK38Ca2SuE6jvJXed97VMn';

    try {
      const [userServerRows] = await db.execute(
        'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? OR usuario = ? LIMIT 1',
        [req.user.userId, userLogin]
      );
      if (userServerRows.length > 0) {
        const serverId = userServerRows[0].codigo_servidor;
        const [serverRows] = await db.execute(
          'SELECT ip, dominio, senha_root FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
          [serverId]
        );
        if (serverRows.length > 0) {
          const server = serverRows[0];
          wowzaHost = server.dominio || server.ip;
          wowzaPassword = server.senha_root || wowzaPassword;
        }
      }
    } catch {}

    const wowzaUrl = `http://${wowzaUser}:${wowzaPassword}@${wowzaHost}:${wowzaPort}/content/${requestPath}`;
    res.redirect(wowzaUrl);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.get('/api/wowza/video-url/:userLogin/:folderName/:fileName', async (req, res) => {
  try {
    const { userLogin, folderName, fileName } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token de acesso requerido' });
    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura_aqui';
    const decoded = jwt.verify(token, JWT_SECRET);

    let wowzaHost = '51.222.156.223';
    let wowzaPort = 6980;
    let wowzaUser = 'admin';
    let wowzaPassword = 'FK38Ca2SuE6jvJXed97VMn';

    try {
      const [userServerRows] = await db.execute(
        'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? OR login = ? LIMIT 1',
        [decoded.userId, userLogin]
      );
      if (userServerRows.length > 0) {
        const serverId = userServerRows[0].codigo_servidor;
        const [serverRows] = await db.execute(
          'SELECT ip, dominio, senha_root FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
          [serverId]
        );
        if (serverRows.length > 0) {
          const server = serverRows[0];
          wowzaHost = server.dominio || server.ip;
        }
      }
    } catch {}

    const finalFileName = fileName.endsWith('.mp4') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp4');
    const urls = {
      direct: `http://${wowzaUser}:${wowzaPassword}@${wowzaHost}:6980/content/${userLogin}/${folderName}/${finalFileName}`,
      hls: `http://${wowzaHost}:1935/vod/_definst_/mp4:${userLogin}/${folderName}/${finalFileName}/playlist.m3u8`,
      proxy: `/content/${userLogin}/${folderName}/${finalFileName}`,
      external: `http://${wowzaUser}:${wowzaPassword}@${wowzaHost}:6980/content/${userLogin}/${folderName}/${finalFileName}`
    };

    res.json({ success: true, urls, recommended: 'direct', server_info: { host: wowzaHost, port: wowzaPort, dynamic: true }, file_info: { user: userLogin, folder: folderName, file: finalFileName, original_file: fileName } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

if (isProduction) {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/comerciais', comerciaisRoutes);
app.use('/api/downloadyoutube', downloadyoutubeRoutes);
app.use('/api/espectadores', espectadoresRoutes);
app.use('/api/streaming', streamingRoutes);
app.use('/api/relay', relayRoutes);
app.use('/api/logos', logosRoutes);
app.use('/api/transmission-settings', transmissionSettingsRoutes);
app.use('/api/ftp', ftpRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/videos-ssh', videosSSHRoutes);
app.use('/api/user-settings', require('./routes/user-settings'));
app.use('/api/conversion', conversionRoutes);
app.use('/api/video-stream', videoStreamRoutes);
app.use('/api/user-wowza-setup', userWowzaSetupRoutes);
app.use('/api/app-multiplataforma', appMultiplataformaRoutes);
app.use('/api/app-android', appAndroidRoutes);
app.use('/api/smil-management', smilManagementRoutes);
app.use('/api/dados-conexao', dadosConexaoRoutes);
app.use('/api/player-external', playerExternalRoutes);
app.use('/api/player-port', playerPortRoutes);

app.get('/api/test', (req, res) => res.json({ message: 'API funcionando!', timestamp: new Date().toISOString() }));

app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await db.testConnection();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    res.json({
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      memory: { used: Math.round(memoryUsage.heapUsed / 1024 / 1024), total: Math.round(memoryUsage.heapTotal / 1024 / 1024) },
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message, timestamp: new Date().toISOString() });
  }
});

app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Arquivo muito grande' });
  if (error.message.includes('Tipo de arquivo não suportado')) return res.status(400).json({ error: 'Tipo de arquivo não suportado' });
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.use('*', (req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

async function startServer() {
  try {
    const dbConnected = await db.testConnection();
    if (!dbConnected) console.error('❌ Não foi possível conectar ao banco de dados');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌐 Frontend: http://localhost:3000`);
      console.log(`🔧 Backend: http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔧 API test: http://localhost:${PORT}/api/test`);
      console.log(`🔗 SSH Manager inicializado para uploads remotos`);
      console.log(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    });

    process.on('SIGINT', () => { SSHManager.closeAllConnections(); process.exit(0); });
    process.on('SIGTERM', () => { SSHManager.closeAllConnections(); process.exit(0); });
  } catch (error) {
    process.exit(1);
  }
}

startServer();
