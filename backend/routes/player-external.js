const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// GET /api/player-external/url - Gerar URL do player externo
router.get('/url', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userLogin = req.user.usuario || (req.user.email ? req.user.email.split('@')[0] : `user_${userId}`);
    
    const {
      player = '1',
      aspectratio = '16:9',
      autoplay = 'false',
      muted = 'false',
      loop = 'false',
      contador = 'true',
      compartilhamento = 'true',
      vod
    } = req.query;

    // URL base do player externo
    let externalUrl = `https://playerv.samhost.wcore.com.br/?login=${userLogin}&player=${player}`;
    
    // Adicionar parâmetros
    const params = new URLSearchParams({
      aspectratio,
      autoplay,
      muted,
      loop,
      contador,
      compartilhamento
    });

    if (vod) {
      params.append('vod', vod);
    }

    externalUrl += '&' + params.toString();

    // Gerar código de incorporação
    const embedCode = `<iframe 
  src="${externalUrl}" 
  width="640" 
  height="360" 
  frameborder="0" 
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture">
</iframe>`;

    res.json({
      success: true,
      external_url: externalUrl,
      embed_code: embedCode,
      user_login: userLogin,
      player_type: player,
      parameters: Object.fromEntries(params)
    });

  } catch (error) {
    console.error('Erro ao gerar URL do player externo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/player-external/status - Verificar status para player externo
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userLogin = req.user.usuario || (req.user.email ? req.user.email.split('@')[0] : `user_${userId}`);

    // Verificar transmissão de playlist ativa
    const [transmissionRows] = await db.execute(
      `SELECT t.*, p.nome as playlist_nome
       FROM transmissoes t
       LEFT JOIN playlists p ON t.codigo_playlist = p.id
       WHERE t.codigo_stm = ? AND t.status = 'ativa'
       ORDER BY t.data_inicio DESC
       LIMIT 1`,
      [userId]
    );

    let streamStatus = {
      user_login: userLogin,
      has_active_transmission: false,
      transmission_type: null,
      stream_url: null,
      title: null,
      playlist_name: null
    };

    if (transmissionRows.length > 0) {
      const transmission = transmissionRows[0];
      streamStatus = {
        user_login: userLogin,
        has_active_transmission: true,
        transmission_type: 'playlist',
        stream_url: `http://samhost.wcore.com.br:1935/${userLogin}/${userLogin}/playlist.m3u8`,
        title: transmission.titulo,
        playlist_name: transmission.playlist_nome
      };
    } else {
      // Verificar stream OBS (através do status)
      try {
        const obsResponse = await fetch('/api/streaming/obs-status', {
          headers: { Authorization: req.headers.authorization }
        });
        
        if (obsResponse.ok) {
          const obsData = await obsResponse.json();
          if (obsData.success && obsData.obs_stream?.is_live) {
            streamStatus = {
              user_login: userLogin,
              has_active_transmission: true,
              transmission_type: 'obs',
              stream_url: `http://samhost.wcore.com.br:1935/samhost/${userLogin}_live/playlist.m3u8`,
              title: `Transmissão OBS - ${userLogin}`,
              playlist_name: null
            };
          }
        }
      } catch (obsError) {
        console.warn('Erro ao verificar stream OBS:', obsError.message);
      }
    }

    res.json({
      success: true,
      ...streamStatus
    });

  } catch (error) {
    console.error('Erro ao verificar status para player externo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/player-external/embed-code - Gerar código de incorporação
router.get('/embed-code', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userLogin = req.user.usuario || (req.user.email ? req.user.email.split('@')[0] : `user_${userId}`);
    
    const {
      player = '1',
      width = '640',
      height = '360',
      responsive = 'true'
    } = req.query;

    const baseUrl = `https://playerv.samhost.wcore.com.br/?login=${userLogin}&player=${player}&contador=true&compartilhamento=true`;

    let embedCode;
    
    if (responsive === 'true') {
      embedCode = `<!-- Player Responsivo -->
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe 
    src="${baseUrl}" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    frameborder="0" 
    allowfullscreen
    allow="autoplay; fullscreen; picture-in-picture">
  </iframe>
</div>`;
    } else {
      embedCode = `<!-- Player Fixo -->
<iframe 
  src="${baseUrl}" 
  width="${width}" 
  height="${height}" 
  frameborder="0" 
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture">
</iframe>`;
    }

    res.json({
      success: true,
      embed_code: embedCode,
      external_url: baseUrl,
      user_login: userLogin,
      player_type: player,
      responsive: responsive === 'true'
    });

  } catch (error) {
    console.error('Erro ao gerar código de incorporação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;