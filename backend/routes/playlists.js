const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// GET /api/playlists - Lista playlists do usuário
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      `SELECT 
        id,
        nome,
        data_criacao,
        total_videos,
        duracao_total
       FROM playlists 
       WHERE (codigo_stm = ? OR codigo_stm IN (
         SELECT codigo_cliente FROM streamings WHERE codigo = ?
       ))
       ORDER BY data_criacao DESC`,
      [userId, userId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar playlists:', err);
    res.status(500).json({ error: 'Erro ao buscar playlists', details: err.message });
  }
});

// POST /api/playlists - Cria nova playlist
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { nome } = req.body;
    const userId = req.user.id;

    if (!nome) {
      return res.status(400).json({ error: 'Nome da playlist é obrigatório' });
    }

    const [result] = await db.execute(
      `INSERT INTO playlists (codigo_stm, nome, data_criacao, total_videos, duracao_total) 
       VALUES (?, ?, NOW(), 0, 0)`,
      [userId, nome]
    );

    res.status(201).json({
      id: result.insertId,
      nome: nome,
      message: 'Playlist criada com sucesso'
    });
  } catch (err) {
    console.error('Erro ao criar playlist:', err);
    res.status(500).json({ error: 'Erro ao criar playlist', details: err.message });
  }
});

// PUT /api/playlists/:id - Atualiza playlist
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const playlistId = req.params.id;
    const { nome, videos } = req.body;
    const userId = req.user.id;

    // Verificar se playlist pertence ao usuário
    const [playlistRows] = await db.execute(
      'SELECT id FROM playlists WHERE id = ? AND codigo_stm = ?',
      [playlistId, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada' });
    }

    // Atualizar nome da playlist
    if (nome) {
      await db.execute(
        'UPDATE playlists SET nome = ? WHERE id = ?',
        [nome, playlistId]
      );
    }

    // Atualizar vídeos da playlist se fornecidos
    if (videos && Array.isArray(videos)) {
      // Remover vídeos existentes da playlist
      await db.execute(
        'UPDATE videos SET playlist_id = NULL WHERE playlist_id = ?',
        [playlistId]
      );

      // Adicionar novos vídeos
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        await db.execute(
          'UPDATE videos SET playlist_id = ?, ordem_playlist = ? WHERE id = ? AND codigo_cliente = ?',
          [playlistId, i, video.id, userId]
        );
      }

      // Atualizar estatísticas da playlist
      const [statsRows] = await db.execute(
        `SELECT COUNT(*) as total_videos, SUM(duracao) as duracao_total
         FROM videos 
         WHERE playlist_id = ?`,
        [playlistId]
      );

      const stats = statsRows[0];
      await db.execute(
        'UPDATE playlists SET total_videos = ?, duracao_total = ? WHERE id = ?',
        [stats.total_videos || 0, stats.duracao_total || 0, playlistId]
      );
    }

    // Atualizar arquivo SMIL do usuário após modificar playlist
    try {
      const userLogin = req.user.usuario || (req.user.email ? req.user.email.split('@')[0] : `user_${req.user.id}`);
      const [serverRows] = await db.execute(
        'SELECT servidor_id FROM folders WHERE user_id = ? LIMIT 1',
        [req.user.id]
      );
      const serverId = serverRows.length > 0 ? serverRows[0].servidor_id : 1;
      
      const PlaylistSMILService = require('../services/PlaylistSMILService');
      await PlaylistSMILService.updateUserSMIL(req.user.id, userLogin, serverId);
      console.log(`✅ Arquivo SMIL atualizado após modificar playlist ${playlistId}`);
    } catch (smilError) {
      console.warn('Erro ao atualizar arquivo SMIL:', smilError.message);
    }

    res.json({ success: true, message: 'Playlist atualizada com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar playlist:', err);
    res.status(500).json({ error: 'Erro ao atualizar playlist', details: err.message });
  }
});

// GET /api/playlists/:id/videos - Lista vídeos de uma playlist
router.get('/:id/videos', authMiddleware, async (req, res) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;

    // Verificar se playlist pertence ao usuário
    const [playlistRows] = await db.execute(
      'SELECT id FROM playlists WHERE id = ? AND codigo_stm = ?',
      [playlistId, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada' });
    }

    // Buscar vídeos da playlist
    const [rows] = await db.execute(
      `SELECT 
        v.id,
        v.nome,
        v.url,
        v.caminho,
        v.duracao,
        v.tamanho_arquivo as tamanho,
        v.bitrate_video,
        v.formato_original,
        v.codec_video,
        v.is_mp4,
        v.compativel,
        v.ordem_playlist
       FROM videos v
       WHERE v.playlist_id = ? AND v.codigo_cliente = ?
       ORDER BY v.ordem_playlist ASC, v.id ASC`,
      [playlistId, userId]
    );

    // Formatar resposta para compatibilidade com frontend
    const videos = rows.map(video => ({
      videos: video // Manter estrutura esperada pelo frontend
    }));

    res.json(videos);
  } catch (err) {
    console.error('Erro ao buscar vídeos da playlist:', err);
    res.status(500).json({ error: 'Erro ao buscar vídeos da playlist', details: err.message });
  }
});

// DELETE /api/playlists/:id - Remove playlist
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;

    // Verificar se playlist pertence ao usuário
    const [playlistRows] = await db.execute(
      'SELECT id, nome FROM playlists WHERE id = ? AND codigo_stm = ?',
      [playlistId, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada' });
    }

    const playlist = playlistRows[0];

    // Verificar se playlist está sendo usada em transmissão ativa
    const [activeTransmission] = await db.execute(
      'SELECT codigo FROM transmissoes WHERE codigo_playlist = ? AND status = "ativa"',
      [playlistId]
    );

    if (activeTransmission.length > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir playlist em transmissão',
        details: 'Finalize a transmissão antes de excluir a playlist'
      });
    }

    // Verificar se playlist está sendo usada em agendamentos
    const [agendamentos] = await db.execute(
      'SELECT COUNT(*) as count FROM playlists_agendamentos WHERE codigo_playlist = ?',
      [playlistId]
    );

    if (agendamentos[0].count > 0) {
      return res.status(400).json({ 
        error: 'Playlist está sendo usada em agendamentos',
        details: `A playlist "${playlist.nome}" está sendo usada em ${agendamentos[0].count} agendamento(s). Remova os agendamentos primeiro.`
      });
    }

    // Remover vídeos da playlist (apenas limpar referência)
    await db.execute(
      'UPDATE videos SET playlist_id = NULL, ordem_playlist = NULL WHERE playlist_id = ?',
      [playlistId]
    );

    // Remover playlist
    await db.execute(
      'DELETE FROM playlists WHERE id = ?',
      [playlistId]
    );

    // Atualizar arquivo SMIL do usuário após remover playlist
    try {
      const userLogin = req.user.usuario || (req.user.email ? req.user.email.split('@')[0] : `user_${req.user.id}`);
      const [serverRows] = await db.execute(
        'SELECT servidor_id FROM folders WHERE user_id = ? LIMIT 1',
        [req.user.id]
      );
      const serverId = serverRows.length > 0 ? serverRows[0].servidor_id : 1;
      
      const PlaylistSMILService = require('../services/PlaylistSMILService');
      await PlaylistSMILService.updateUserSMIL(req.user.id, userLogin, serverId);
    } catch (smilError) {
      console.warn('Erro ao atualizar arquivo SMIL:', smilError.message);
    }

    res.json({ success: true, message: 'Playlist excluída com sucesso' });
  } catch (err) {
    console.error('Erro ao remover playlist:', err);
    res.status(500).json({ error: 'Erro ao remover playlist', details: err.message });
  }
});

module.exports = router;