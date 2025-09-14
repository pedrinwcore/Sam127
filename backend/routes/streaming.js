const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const WowzaStreamingService = require('../config/WowzaStreamingService');
const SSHManager = require('../config/SSHManager');

const router = express.Router();

// --- ROTA GET /obs-config - Configuração para OBS ---
router.get('/obs-config', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userLogin = req.user.email ? req.user.email.split('@')[0] : `user_${userId}`;

    // Buscar configurações do usuário
    const [userConfigRows] = await db.execute(
      `SELECT 
        bitrate, espectadores, espaco, espaco_usado, aplicacao, codigo_servidor,
        status_gravando, transcoder, transcoder_qualidades
       FROM streamings 
       WHERE (codigo_cliente = ? OR codigo = ?) AND status = 1 LIMIT 1`,
      [userId, userId]
    );

    if (userConfigRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configurações do usuário não encontradas'
      });
    }

    const userConfig = userConfigRows[0];
    const serverId = userConfig.codigo_servidor || 1;

    // Buscar informações do servidor
    const [serverRows] = await db.execute(
      `SELECT codigo, nome, limite_streamings, streamings_ativas, 
              load_cpu, tipo_servidor, status
       FROM wowza_servers
       WHERE codigo = ?`,
      [serverId]
    );

    const serverInfo = serverRows.length > 0 ? serverRows[0] : null;

    // Verificar se há bitrate solicitado na requisição
    const requestedBitrate = req.query.bitrate ? parseInt(req.query.bitrate) : null;
    const maxBitrate = userConfig.bitrate || 2500;
    const allowedBitrate = requestedBitrate ? Math.min(requestedBitrate, maxBitrate) : maxBitrate;

    // Garantir que o diretório do usuário existe no servidor
    try {
      await SSHManager.createCompleteUserStructure(serverId, userLogin, {
        bitrate: userConfig.bitrate || 2500,
        espectadores: userConfig.espectadores || 100,
        status_gravando: userConfig.status_gravando || 'nao'
      });
      console.log(`✅ Diretório do usuário ${userLogin} verificado no servidor ${serverId}`);
    } catch (dirError) {
      console.warn('Aviso: Erro ao verificar/criar diretório do usuário:', dirError.message);
    }

    // Verificar limites e gerar avisos
    const warnings = [];
    if (requestedBitrate && requestedBitrate > maxBitrate) {
      warnings.push(`Bitrate solicitado (${requestedBitrate} kbps) excede o limite do plano (${maxBitrate} kbps). Será limitado automaticamente.`);
    }
    if (serverInfo && serverInfo.streamings_ativas >= serverInfo.limite_streamings * 0.9) {
      warnings.push('Servidor próximo do limite de capacidade');
    }
    if (serverInfo && serverInfo.load_cpu > 80) {
      warnings.push('Servidor com alta carga de CPU');
    }

    // Espaço em disco
    const usedSpace = userConfig.espaco_usado || 0;
    const totalSpace = userConfig.espaco || 1000;
    const storagePercentage = Math.round((usedSpace / totalSpace) * 100);

    if (storagePercentage > 90) {
      warnings.push('Espaço de armazenamento quase esgotado');
    }

    // Verificar conectividade com Wowza
    try {
      const wowzaService = new (require('../config/WowzaStreamingService'))();
      const initialized = await wowzaService.initializeFromDatabase(userId);

      if (initialized) {
        const wowzaTest = await wowzaService.testConnection();
        if (!wowzaTest.success) {
          warnings.push('Wowza API indisponível - funcionando em modo degradado');
          warnings.push('Transmissões funcionarão normalmente, mas estatísticas podem não estar disponíveis');
        }
      }
    } catch (wowzaError) {
      console.warn('Aviso: Erro ao testar Wowza:', wowzaError.message);
      warnings.push('Wowza API indisponível - funcionando em modo degradado');
    }

    // Configurar URLs baseadas no ambiente
    // SEMPRE usar domínio do servidor Wowza, NUNCA o domínio da aplicação
    const streamingHost = 'stmv1.udicast.com';
    
    // Resposta final
    res.json({
      success: true,
      obs_config: {
        rtmp_url: `rtmp://${streamingHost}:1935/${userLogin}`,
        stream_key: `${userLogin}_live`,
        hls_url: `http://${streamingHost}:1935/${userLogin}/${userLogin}_live/playlist.m3u8`,
        max_bitrate: allowedBitrate,
        max_viewers: userConfig.espectadores,
        recording_enabled: userConfig.status_gravando === 'sim',
        recording_path: `/home/streaming/${userLogin}/recordings/`
      },
      user_limits: {
        bitrate: {
          max: maxBitrate,
          requested: requestedBitrate || maxBitrate,
          allowed: allowedBitrate
        },
        viewers: {
          max: userConfig.espectadores || 100
        },
        storage: {
          max: totalSpace,
          used: usedSpace,
          available: totalSpace - usedSpace,
          percentage: storagePercentage
        }
      },
      warnings: warnings,
      server_info: serverInfo
    });

  } catch (error) {
    console.error('Erro ao obter configuração OBS:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// Rota para servir vídeos via link externo
router.get('/video-external/:userLogin/:folder/:filename', authMiddleware, async (req, res) => {
  try {
    const { userLogin, folder, filename } = req.params;
    const userId = req.user.id;

    // Verificar se o usuário tem acesso ao vídeo
    const userEmail = req.user.email ? req.user.email.split('@')[0] : `user_${userId}`;

    if (userLogin !== userEmail) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Construir URL externa do Wowza com autenticação
    const isProduction = process.env.NODE_ENV === 'production';
    const wowzaHost = isProduction ? 'samhost.wcore.com.br' : '51.222.156.223';
    const wowzaUser = 'admin';
    const wowzaPassword = 'FK38Ca2SuE6jvJXed97VMn';
    const externalUrl = `http://${wowzaUser}:${wowzaPassword}@${wowzaHost}:6980/content/${userLogin}/${folder}/${filename}`;

    // Redirecionar para URL externa
    res.redirect(externalUrl);
  } catch (error) {
    console.error('Erro ao gerar link externo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// --- ROTA GET /obs-status - Status do stream OBS ---
router.get('/obs-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Inicializar serviço Wowza
    const wowzaService = new WowzaStreamingService();
    const initialized = await wowzaService.initializeFromDatabase(userId);

    if (!initialized) {
      return res.json({
        success: false,
        error: 'Erro ao conectar com servidor de streaming',
        obs_stream: {
          is_live: false,
          is_active: false,
          viewers: 0,
          bitrate: 0,
          uptime: '00:00:00',
          recording: false,
          platforms: []
        }
      });
    }

    try {
      // Verificar status do stream OBS
      const obsStats = await wowzaService.getOBSStreamStats(userId);

      res.json({
        success: true,
        obs_stream: {
          is_live: obsStats.isLive,
          is_active: obsStats.isActive,
          viewers: obsStats.viewers,
          bitrate: obsStats.bitrate,
          uptime: obsStats.uptime,
          recording: obsStats.recording || false,
          platforms: obsStats.platforms || []
        }
      });
    } catch (obsError) {
      console.warn('Erro ao obter status OBS, retornando dados padrão:', obsError.message);
      res.json({
        success: true,
        obs_stream: {
          is_live: false,
          is_active: false,
          viewers: 0,
          bitrate: 0,
          uptime: '00:00:00',
          recording: false,
          platforms: [],
          error: 'Wowza API indisponível'
        }
      });
    }
  } catch (error) {
    console.error('Erro ao verificar status OBS:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA POST /obs-stop - Parar stream OBS ---
router.post('/obs-stop', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Inicializar serviço Wowza
    const wowzaService = new WowzaStreamingService();
    const initialized = await wowzaService.initializeFromDatabase(userId);

    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao conectar com servidor de streaming'
      });
    }

    // Parar stream OBS
    const result = await wowzaService.stopOBSStream(userId);

    res.json({
      success: result.success,
      message: result.message || 'Stream OBS finalizado',
      error: result.error
    });
  } catch (error) {
    console.error('Erro ao parar stream OBS:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA GET /recordings - Listar gravações ---
router.get('/recordings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userLogin = req.user.usuario || req.user.email?.split('@')[0] || `user_${userId}`;

    // Inicializar serviço Wowza
    const wowzaService = new WowzaStreamingService();
    const initialized = await wowzaService.initializeFromDatabase(userId);

    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao conectar com servidor de streaming'
      });
    }

    // Listar gravações
    const recordingsResult = await wowzaService.listRecordings(userLogin);

    res.json({
      success: recordingsResult.success,
      recordings: recordingsResult.recordings || [],
      path: recordingsResult.path,
      error: recordingsResult.error
    });
  } catch (error) {
    console.error('Erro ao listar gravações:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA GET /status ---
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Inicializar serviço Wowza com dados do usuário
    const wowzaService = new WowzaStreamingService();
    const initialized = await wowzaService.initializeFromDatabase(userId);

    if (!initialized) {
      return res.json({
        success: true,
        is_live: false,
        transmission: null,
        obs_stream: null
      });
    }

    // Verificar também se há stream OBS ativo
    const obsStats = await wowzaService.getOBSStreamStats(userId);

    const [transmissionRows] = await db.execute(
      `SELECT 
        t.codigo as id,
        t.titulo,
        t.codigo_playlist,
        t.status,
        t.data_inicio,
        t.wowza_stream_id,
        t.use_smil
       FROM transmissoes t
       WHERE t.codigo_stm = ? AND t.status = 'ativa'
       ORDER BY t.data_inicio DESC
       LIMIT 1`,
      [userId]
    );

    // Se não há transmissão de playlist, verificar OBS
    if (transmissionRows.length === 0 && obsStats.isLive) {
      return res.json({
        success: true,
        is_live: true,
        stream_type: 'obs',
        obs_stream: {
          is_live: obsStats.isLive,
          viewers: obsStats.viewers,
          bitrate: obsStats.bitrate,
          uptime: obsStats.uptime,
          recording: obsStats.recording,
          platforms: obsStats.platforms || []
        }
      });
    }

    if (transmissionRows.length === 0) {
      return res.json({
        success: true,
        is_live: false,
        transmission: null,
        obs_stream: obsStats.isLive ? {
          is_live: obsStats.isLive,
          viewers: obsStats.viewers,
          bitrate: obsStats.bitrate,
          uptime: obsStats.uptime,
          recording: obsStats.recording,
          platforms: obsStats.platforms || []
        } : null
      });
    }

    const transmission = transmissionRows[0];
    const stats = await wowzaService.getStreamStats(transmission.wowza_stream_id);

    const [platformRows] = await db.execute(
      `SELECT 
        tp.status,
        up.platform_id,
        p.nome,
        p.codigo
       FROM transmissoes_plataformas tp
       JOIN user_platforms up ON tp.user_platform_id = up.codigo
       JOIN plataformas p ON up.platform_id = p.codigo
       WHERE tp.transmissao_id = ?`,
      [transmission.id]
    );

    res.json({
      success: true,
      is_live: true,
      stream_type: 'playlist',
      transmission: {
        ...transmission,
        codigo_playlist: transmission.codigo_playlist,
        stats: {
          viewers: stats.viewers,
          bitrate: stats.bitrate,
          uptime: stats.uptime,
          isActive: stats.isActive,
        },
        platforms: platformRows.map(p => ({
          user_platform: {
            platform: {
              nome: p.nome,
              codigo: p.codigo,
            }
          },
          status: p.status
        }))
      }
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA POST /start ---
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      playlist_id,
      platform_ids = [],
      settings = {},
      bitrate_override = null,
      enable_recording = false,
      use_smil = true // Sempre usar SMIL por padrão
    } = req.body;

    const userId = req.user.id;
    const userLogin = req.user.usuario || (req.user.email ? req.user.email.split('@')[0] : `user_${userId}`);

    if (!titulo || !playlist_id) {
      return res.status(400).json({ success: false, error: 'Título e playlist são obrigatórios' });
    }

    // Buscar configurações do usuário
    const [userConfigRows] = await db.execute(
      `SELECT 
        bitrate, espectadores, espaco, espaco_usado, aplicacao,
        status_gravando, transcoder, transcoder_qualidades, codigo_servidor
       FROM streamings 
       WHERE codigo_cliente = ? OR codigo = ? LIMIT 1`,
      [userId, userId]
    );

    if (userConfigRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Configurações do usuário não encontradas'
      });
    }

    const userConfig = userConfigRows[0];
    const serverId = userConfig.codigo_servidor || 1;

    // Verificar se já existe transmissão ativa
    const [activeTransmission] = await db.execute(
      'SELECT codigo FROM transmissoes WHERE codigo_stm = ? AND status = "ativa"',
      [userId]
    );

    if (activeTransmission.length > 0) {
      return res.status(400).json({ success: false, error: 'Já existe uma transmissão ativa' });
    }

    // Buscar dados da playlist
    const [playlistRows] = await db.execute(
      'SELECT nome, total_videos FROM playlists WHERE id = ? AND codigo_stm = ?',
      [playlist_id, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(400).json({ success: false, error: 'Playlist não encontrada' });
    }

    const playlist = playlistRows[0];
    if (!playlist.total_videos || playlist.total_videos === 0) {
      return res.status(400).json({ success: false, error: 'Playlist não possui vídeos' });
    }

    // Inicializar serviço Wowza com dados do usuário
    const wowzaService = new WowzaStreamingService();
    const initialized = await wowzaService.initializeFromDatabase(userId);

    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao conectar com servidor de streaming'
      });
    }

    // Verificar limites do usuário
    const requestedBitrate = bitrate_override || userConfig.bitrate;
    const limitsCheck = await wowzaService.checkUserLimits(userConfig, requestedBitrate);

    if (!limitsCheck.success) {
      return res.status(400).json({
        success: false,
        error: 'Erro ao verificar limites do usuário'
      });
    }

    // Aplicar bitrate permitido
    const allowedBitrate = limitsCheck.limits.bitrate.allowed;

    // Buscar plataformas do usuário selecionadas
    let platforms = [];
    if (platform_ids.length) {
      const placeholders = platform_ids.map(() => '?').join(',');
      const [platformRows] = await db.execute(
        `SELECT up.*, p.nome, p.codigo, p.rtmp_base_url
         FROM user_platforms up
         JOIN plataformas p ON up.platform_id = p.codigo
         WHERE up.codigo IN (${placeholders}) AND up.codigo_stm = ?`,
        [...platform_ids, userId]
      );
      platforms = platformRows;
    }

    // Atualizar arquivo SMIL antes de iniciar transmissão
    try {
      console.log(`📄 Atualizando arquivo SMIL para transmissão da playlist ${playlist_id}...`);
      const PlaylistSMILService = require('../services/PlaylistSMILService');
      const smilResult = await PlaylistSMILService.generatePlaylistSMIL(userId, userLogin, serverId, playlist_id);
      
      if (!smilResult.success) {
        console.warn('Aviso ao gerar SMIL:', smilResult.error);
      } else {
        console.log(`✅ Arquivo SMIL gerado: ${smilResult.smil_path}`);
      }
    } catch (smilError) {
      console.warn('Erro ao atualizar arquivo SMIL:', smilError.message);
    }

    // Gerar streamId único
    const streamId = `stream_${userId}_${Date.now()}`;

    // Iniciar stream SMIL no Wowza
    const wowzaResult = await wowzaService.startSMILStream({
      streamId,
      userId,
      userLogin,
      userConfig: {
        ...userConfig,
        bitrate: allowedBitrate,
        gravar_stream: enable_recording ? 'sim' : userConfig.status_gravando
      },
      playlistId: playlist_id,
      playlistName: playlist.nome,
      platforms: platforms.map(p => ({
        platform: { codigo: p.codigo, nome: p.nome, rtmp_base_url: p.rtmp_base_url },
        rtmp_url: p.rtmp_url,
        stream_key: p.stream_key
      }))
    });

    if (!wowzaResult.success) {
      return res.status(500).json({ success: false, error: wowzaResult.error || 'Erro ao iniciar stream no Wowza' });
    }

    // Salvar transmissão
    const [transmissionResult] = await db.execute(
      `INSERT INTO transmissoes (
        codigo_stm, titulo, descricao, codigo_playlist, 
        wowza_stream_id, status, data_inicio, settings, bitrate_usado, use_smil,
        auto_finalize, loop_playlist, playlist_finalizacao_id
      ) VALUES (?, ?, ?, ?, ?, 'ativa', NOW(), ?, ?, 1, 1, 0, ?)`,
      [userId, titulo, descricao || '', playlist_id, streamId, JSON.stringify(settings), allowedBitrate, settings.playlist_finalizacao_id || null]
    );

    const transmissionId = transmissionResult.insertId;

    // Salvar plataformas conectadas na transmissão
    for (const platformId of platform_ids) {
      await db.execute(
        `INSERT INTO transmissoes_plataformas (
          transmissao_id, user_platform_id, status
        ) VALUES (?, ?, 'conectando')`,
        [transmissionId, platformId]
      );
    }
    // Iniciar monitoramento da transmissão para finalização automática
    setTimeout(() => {
      monitorTransmissionProgress(transmissionId, userId, userLogin, serverId);
    }, 30000); // Aguardar 30 segundos antes de iniciar monitoramento

    res.json({
      success: true,
      transmission: {
        id: transmissionId,
        titulo,
        codigo_playlist: playlist_id,
        wowza_stream_id: streamId,
        bitrate_usado: allowedBitrate,
        use_smil: true,
        smil_file: `playlists_agendamentos.smil`
      },
      wowza_data: wowzaResult.data,
      user_limits: limitsCheck.limits,
      warnings: limitsCheck.warnings,
      player_urls: {
        base_url: process.env.NODE_ENV === 'production' ? 'http://samhost.wcore.com.br:3001' : 'http://localhost:3001',
        iframe_url: `${process.env.NODE_ENV === 'production' ? 'http://samhost.wcore.com.br:3001' : 'http://localhost:3001'}/api/player-port/iframe?playlist=${playlist_id}&login=${userLogin}`,
        hls_url: `http://${process.env.NODE_ENV === 'production' ? 'samhost.wcore.com.br' : '51.222.156.223'}:1935/${userLogin}/${userLogin}/playlist.m3u8`,
        smil_url: `http://${process.env.NODE_ENV === 'production' ? 'samhost.wcore.com.br' : '51.222.156.223'}:1935/${userLogin}/${userLogin}/playlist.m3u8`
      }
    });
  } catch (error) {
    console.error('Erro ao iniciar transmissão:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// Função para monitorar progresso da transmissão
async function monitorTransmissionProgress(transmissionId, userId, userLogin, serverId) {
  try {
    console.log(`🔍 Iniciando monitoramento da transmissão ${transmissionId}...`);
    
    const monitorInterval = setInterval(async () => {
      try {
        // Verificar se transmissão ainda está ativa
        const [transmissionRows] = await db.execute(
          'SELECT * FROM transmissoes WHERE codigo = ? AND status = "ativa"',
          [transmissionId]
        );
        
        if (transmissionRows.length === 0) {
          console.log(`⏹️ Transmissão ${transmissionId} não está mais ativa, parando monitoramento`);
          clearInterval(monitorInterval);
          return;
        }
        
        const transmission = transmissionRows[0];
        
        // Verificar se playlist ainda está sendo reproduzida no Wowza
        const wowzaService = new WowzaStreamingService();
        const initialized = await wowzaService.initializeFromDatabase(userId);
        
        if (initialized) {
          const streamStats = await wowzaService.getStreamStats(transmission.wowza_stream_id);
          
          // Se não há mais atividade por mais de 2 minutos, considerar finalizada
          if (!streamStats.isActive) {
            console.log(`🔚 Playlist ${transmission.codigo_playlist} finalizada automaticamente`);
            
            // Verificar se deve iniciar playlist de finalização
            if (transmission.playlist_finalizacao_id) {
              console.log(`🔄 Iniciando playlist de finalização: ${transmission.playlist_finalizacao_id}`);
              await startFinalizationPlaylist(transmissionId, transmission.playlist_finalizacao_id, userId, userLogin, serverId);
            } else if (transmission.loop_playlist) {
              console.log(`🔁 Reiniciando playlist em loop: ${transmission.codigo_playlist}`);
              await restartPlaylistLoop(transmissionId, transmission.codigo_playlist, userId, userLogin, serverId);
            } else {
              // Finalizar transmissão automaticamente
              await finalizeTransmission(transmissionId, userId);
              clearInterval(monitorInterval);
            }
          }
        }
        
      } catch (monitorError) {
        console.error('Erro no monitoramento da transmissão:', monitorError);
      }
    }, 60000); // Verificar a cada 1 minuto
    
    // Parar monitoramento após 24 horas para evitar loops infinitos
    setTimeout(() => {
      clearInterval(monitorInterval);
      console.log(`⏰ Monitoramento da transmissão ${transmissionId} finalizado por timeout`);
    }, 24 * 60 * 60 * 1000);
    
  } catch (error) {
    console.error('Erro ao iniciar monitoramento:', error);
  }
}

// Função para iniciar playlist de finalização
async function startFinalizationPlaylist(transmissionId, playlistFinalizacaoId, userId, userLogin, serverId) {
  try {
    console.log(`🎬 Iniciando playlist de finalização: ${playlistFinalizacaoId}`);
    
    // Atualizar arquivo SMIL com playlist de finalização
    const PlaylistSMILService = require('../services/PlaylistSMILService');
    const smilResult = await PlaylistSMILService.generatePlaylistSMIL(userId, userLogin, serverId, playlistFinalizacaoId);
    
    if (smilResult.success) {
      // Atualizar transmissão para usar playlist de finalização
      await db.execute(
        'UPDATE transmissoes SET codigo_playlist = ?, titulo = CONCAT(titulo, " - Finalização") WHERE codigo = ?',
        [playlistFinalizacaoId, transmissionId]
      );
      
      console.log(`✅ Playlist de finalização ${playlistFinalizacaoId} iniciada`);
    } else {
      console.error('Erro ao gerar SMIL de finalização:', smilResult.error);
      await finalizeTransmission(transmissionId, userId);
    }
  } catch (error) {
    console.error('Erro ao iniciar playlist de finalização:', error);
    await finalizeTransmission(transmissionId, userId);
  }
}

// Função para reiniciar playlist em loop
async function restartPlaylistLoop(transmissionId, playlistId, userId, userLogin, serverId) {
  try {
    console.log(`🔁 Reiniciando playlist em loop: ${playlistId}`);
    
    // Regenerar arquivo SMIL
    const PlaylistSMILService = require('../services/PlaylistSMILService');
    const smilResult = await PlaylistSMILService.generatePlaylistSMIL(userId, userLogin, serverId, playlistId);
    
    if (smilResult.success) {
      console.log(`✅ Playlist ${playlistId} reiniciada em loop`);
    } else {
      console.error('Erro ao reiniciar playlist em loop:', smilResult.error);
      await finalizeTransmission(transmissionId, userId);
    }
  } catch (error) {
    console.error('Erro ao reiniciar playlist em loop:', error);
    await finalizeTransmission(transmissionId, userId);
  }
}

// Função para finalizar transmissão automaticamente
async function finalizeTransmission(transmissionId, userId) {
  try {
    console.log(`🔚 Finalizando transmissão automaticamente: ${transmissionId}`);
    
    // Atualizar status da transmissão
    await db.execute(
      'UPDATE transmissoes SET status = "finalizada", data_fim = NOW(), finalizacao_automatica = 1 WHERE codigo = ?',
      [transmissionId]
    );
    
    // Desconectar plataformas
    await db.execute(
      'UPDATE transmissoes_plataformas SET status = "desconectada" WHERE transmissao_id = ?',
      [transmissionId]
    );
    
    // Parar stream no Wowza
    const wowzaService = new WowzaStreamingService();
    const initialized = await wowzaService.initializeFromDatabase(userId);
    
    if (initialized) {
      const [transmissionRows] = await db.execute(
        'SELECT wowza_stream_id FROM transmissoes WHERE codigo = ?',
        [transmissionId]
      );
      
      if (transmissionRows.length > 0) {
        await wowzaService.stopStream(transmissionRows[0].wowza_stream_id);
      }
    }
    
    console.log(`✅ Transmissão ${transmissionId} finalizada automaticamente`);
  } catch (error) {
    console.error('Erro ao finalizar transmissão automaticamente:', error);
  }
}

// --- ROTA POST /stop ---
router.post('/stop', authMiddleware, async (req, res) => {
  try {
    const { transmission_id, stream_type = 'playlist' } = req.body;
    const userId = req.user.id;

    // Inicializar serviço Wowza
    const wowzaService = new WowzaStreamingService();

    // Para usuários de streaming, usar o próprio ID. Para revendas, usar o ID do cliente
    const targetUserId = req.user.tipo === 'streaming' ? userId : userId;
    const initialized = await wowzaService.initializeFromDatabase(targetUserId);

    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao conectar com servidor de streaming'
      });
    }

    if (stream_type === 'obs') {
      // Parar stream OBS
      const result = await wowzaService.stopOBSStream(userId);

      return res.json({
        success: result.success,
        message: result.message || 'Stream OBS finalizado',
        error: result.error
      });
    } else {
      // Parar transmissão de playlist
      let transmissionRows = [];
      
      if (transmission_id) {
        [transmissionRows] = await db.execute(
          'SELECT * FROM transmissoes WHERE codigo = ? AND codigo_stm = ? AND status = "ativa"',
          [transmission_id, userId]
        );
      } else {
        // Se não foi fornecido ID, buscar transmissão ativa do usuário
        [transmissionRows] = await db.execute(
          'SELECT * FROM transmissoes WHERE codigo_stm = ? AND status = "ativa" ORDER BY data_inicio DESC LIMIT 1',
          [userId]
        );
      }

      if (transmissionRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Transmissão não encontrada ou já finalizada' });
      }

      const transmission = transmissionRows[0];
      const wowzaResult = await wowzaService.stopStream(transmission.wowza_stream_id);

      await db.execute('UPDATE transmissoes SET status = "finalizada", data_fim = NOW() WHERE codigo = ?', [transmission.codigo]);
      await db.execute('UPDATE transmissoes_plataformas SET status = "desconectada" WHERE transmissao_id = ?', [transmission.codigo]);

      res.json({ success: true, message: 'Transmissão finalizada com sucesso', wowza_result: wowzaResult });
    }
  } catch (error) {
    console.error('Erro ao parar transmissão:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA POST /pause - Pausar transmissão ---
router.post('/pause', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { transmission_id } = req.body;

    // Buscar transmissão ativa
    let transmissionRows = [];
    
    if (transmission_id) {
      [transmissionRows] = await db.execute(
        'SELECT * FROM transmissoes WHERE codigo = ? AND codigo_stm = ? AND status = "ativa"',
        [transmission_id, userId]
      );
    } else {
      [transmissionRows] = await db.execute(
        'SELECT * FROM transmissoes WHERE codigo_stm = ? AND status = "ativa" ORDER BY data_inicio DESC LIMIT 1',
        [userId]
      );
    }

    if (transmissionRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Nenhuma transmissão ativa encontrada' });
    }

    const transmission = transmissionRows[0];

    // Atualizar status para pausada
    await db.execute(
      'UPDATE transmissoes SET status = "pausada", data_pausa = NOW() WHERE codigo = ?',
      [transmission.codigo]
    );

    // Pausar stream no Wowza (se possível)
    try {
      const wowzaService = new WowzaStreamingService();
      const initialized = await wowzaService.initializeFromDatabase(userId);
      
      if (initialized) {
        // Para SMIL, pausar significa parar temporariamente
        await wowzaService.pauseSMILStream(transmission.wowza_stream_id);
      }
    } catch (wowzaError) {
      console.warn('Erro ao pausar no Wowza:', wowzaError.message);
    }

    res.json({ 
      success: true, 
      message: 'Transmissão pausada com sucesso',
      transmission_id: transmission.codigo
    });
  } catch (error) {
    console.error('Erro ao pausar transmissão:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA POST /resume - Retomar transmissão pausada ---
router.post('/resume', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { transmission_id } = req.body;

    // Buscar transmissão pausada
    let transmissionRows = [];
    
    if (transmission_id) {
      [transmissionRows] = await db.execute(
        'SELECT * FROM transmissoes WHERE codigo = ? AND codigo_stm = ? AND status = "pausada"',
        [transmission_id, userId]
      );
    } else {
      [transmissionRows] = await db.execute(
        'SELECT * FROM transmissoes WHERE codigo_stm = ? AND status = "pausada" ORDER BY data_pausa DESC LIMIT 1',
        [userId]
      );
    }

    if (transmissionRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Nenhuma transmissão pausada encontrada' });
    }

    const transmission = transmissionRows[0];

    // Atualizar status para ativa
    await db.execute(
      'UPDATE transmissoes SET status = "ativa", data_retomada = NOW() WHERE codigo = ?',
      [transmission.codigo]
    );

    // Retomar stream no Wowza
    try {
      const wowzaService = new WowzaStreamingService();
      const initialized = await wowzaService.initializeFromDatabase(userId);
      
      if (initialized) {
        await wowzaService.resumeSMILStream(transmission.wowza_stream_id);
      }
    } catch (wowzaError) {
      console.warn('Erro ao retomar no Wowza:', wowzaError.message);
    }

    res.json({ 
      success: true, 
      message: 'Transmissão retomada com sucesso',
      transmission_id: transmission.codigo
    });
  } catch (error) {
    console.error('Erro ao retomar transmissão:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA GET /platforms ---
router.get('/platforms', authMiddleware, async (req, res) => {
  try {
    const [platforms] = await db.execute(
      `SELECT codigo as id, nome, codigo, rtmp_base_url, requer_stream_key
       FROM plataformas 
       WHERE ativo = 1
       ORDER BY nome`
    );
    res.json({ success: true, platforms });
  } catch (error) {
    console.error('Erro ao buscar plataformas:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA GET /user-platforms ---
router.get('/user-platforms', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [platforms] = await db.execute(
      `SELECT 
        up.codigo as id,
        up.platform_id as id_platform,
        up.stream_key,
        up.rtmp_url,
        up.titulo_padrao,
        up.descricao_padrao,
        up.ativo,
        p.nome,
        p.codigo,
        p.rtmp_base_url,
        p.requer_stream_key
       FROM user_platforms up
       JOIN plataformas p ON up.platform_id = p.codigo
       WHERE up.codigo_stm = ?
       ORDER BY p.nome`,
      [userId]
    );

    res.json({
      success: true,
      platforms: platforms.map(p => ({
        ...p,
        platform: {
          id: p.codigo,
          nome: p.nome,
          codigo: p.codigo,
          rtmp_base_url: p.rtmp_base_url,
          requer_stream_key: p.requer_stream_key
        }
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar plataformas do usuário:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA POST /configure-platform ---
router.post('/configure-platform', authMiddleware, async (req, res) => {
  try {
    const {
      platform_id,
      stream_key,
      rtmp_url,
      titulo_padrao,
      descricao_padrao
    } = req.body;

    const userId = req.user.id;

    if (!platform_id || !stream_key) {
      return res.status(400).json({ success: false, error: 'Platform ID e Stream Key são obrigatórios' });
    }

    console.log(`🔧 Configurando plataforma para usuário ${userId}:`, {
      platform_id,
      stream_key: stream_key ? 'CONFIGURADO' : 'VAZIO',
      rtmp_url: rtmp_url || 'PADRÃO'
    });
    const [platformRows] = await db.execute('SELECT * FROM plataformas WHERE codigo = ?', [platform_id]);
    if (platformRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plataforma não encontrada' });
    }

    const platform = platformRows[0];
    const [existingRows] = await db.execute(
      'SELECT codigo FROM user_platforms WHERE codigo_stm = ? AND platform_id = ?',
      [userId, platform_id]
    );

    if (existingRows.length > 0) {
      console.log(`📝 Atualizando plataforma existente: ${platform.nome}`);
      await db.execute(
        `UPDATE user_platforms SET 
         stream_key = ?, rtmp_url = ?, titulo_padrao = ?, descricao_padrao = ?, ativo = 1
         WHERE codigo_stm = ? AND platform_id = ?`,
        [stream_key, rtmp_url || platform.rtmp_base_url, titulo_padrao || '', descricao_padrao || '', userId, platform_id]
      );
    } else {
      console.log(`➕ Criando nova configuração de plataforma: ${platform.nome}`);
      await db.execute(
        `INSERT INTO user_platforms (
          codigo_stm, platform_id, stream_key, rtmp_url, 
          titulo_padrao, descricao_padrao, ativo
        ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [userId, platform_id, stream_key, rtmp_url || platform.rtmp_base_url, titulo_padrao || '', descricao_padrao || '']
      );
    }

    console.log(`✅ Plataforma ${platform.nome} configurada com sucesso`);
    res.json({ success: true, message: 'Plataforma configurada com sucesso' });
  } catch (error) {
    console.error('Erro ao configurar plataforma:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// --- ROTA DELETE /user-platforms/:id ---
router.delete('/user-platforms/:id', authMiddleware, async (req, res) => {
  try {
    const platformId = req.params.id;
    const userId = req.user.id;

    const [result] = await db.execute(
      'DELETE FROM user_platforms WHERE codigo = ? AND codigo_stm = ?',
      [platformId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Plataforma não encontrada' });
    }

    res.json({ success: true, message: 'Plataforma removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover plataforma:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

module.exports = router;