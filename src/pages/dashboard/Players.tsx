import React, { useState, useEffect } from 'react';
import { ChevronLeft, Play, Copy, Eye, Settings, Monitor, Smartphone, Globe, Code, ExternalLink, X, Maximize, Minimize, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import IFrameVideoPlayer from '../../components/IFrameVideoPlayer';

interface PlayerConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  type: 'universal' | 'iframe' | 'html5' | 'mobile' | 'facebook' | 'android';
  features: string[];
  code: string;
  previewUrl: string;
  isActive: boolean;
}

interface Video {
  id: number;
  nome: string;
  url: string;
  duracao?: number;
}

const Players: React.FC = () => {
  const { user, getToken } = useAuth();
  const [activePlayer, setActivePlayer] = useState<string>('iframe-port');
  const [showPreview, setShowPreview] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sampleVideos, setSampleVideos] = useState<Video[]>([]);
  const [liveStreamActive, setLiveStreamActive] = useState(false);
  const [obsStreamActive, setObsStreamActive] = useState(false);
  const [playerUrl, setPlayerUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [playlistTransmissionActive, setPlaylistTransmissionActive] = useState(false);
  const [activePlaylistName, setActivePlaylistName] = useState<string>('');

  const userLogin = user?.usuario || (user?.email ? user.email.split('@')[0] : `user_${user?.id || 'usuario'}`);

  useEffect(() => {
    loadSampleVideos();
    checkLiveStreams();
    generatePlayerUrls();
    
    // Verificar streams a cada 30 segundos
    const interval = setInterval(checkLiveStreams, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkLiveStreams = async () => {
    try {
      const token = await getToken();
      
      // Verificar stream OBS
      const obsResponse = await fetch('/api/streaming/obs-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (obsResponse.ok) {
        const obsData = await obsResponse.json();
        setObsStreamActive(obsData.success && obsData.obs_stream?.is_live);
      }
      
      // Verificar transmissão de playlist
      const streamResponse = await fetch('/api/streaming/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (streamResponse.ok) {
        const streamData = await streamResponse.json();
        const isPlaylistActive = streamData.success && streamData.is_live && streamData.stream_type === 'playlist';
        setLiveStreamActive(isPlaylistActive);
        setPlaylistTransmissionActive(isPlaylistActive);
        
        if (isPlaylistActive && streamData.transmission) {
          // Buscar nome da playlist
          try {
            const playlistsResponse = await fetch('/api/playlists', {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (playlistsResponse.ok) {
              const playlists = await playlistsResponse.json();
              const playlist = playlists.find((p: any) => p.id === streamData.transmission.codigo_playlist);
              setActivePlaylistName(playlist ? playlist.nome : streamData.transmission.titulo);
            }
          } catch (error) {
            setActivePlaylistName(streamData.transmission.titulo);
          }
        } else {
          setActivePlaylistName('');
        }
      }
    } catch (error) {
      console.error('Erro ao verificar streams:', error);
    }
  };

  const loadSampleVideos = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/folders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const folders = await response.json();
      
      if (folders.length > 0) {
        const videosResponse = await fetch(`/api/videos?folder_id=${folders[0].id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const videos = await videosResponse.json();
        setSampleVideos(Array.isArray(videos) ? videos.slice(0, 3) : []);
      }
    } catch (error) {
      console.error('Erro ao carregar vídeos de exemplo:', error);
    }
  };

  const generatePlayerUrls = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/player-port/url', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPlayerUrl(data.player_url);
          setEmbedCode(data.embed_code);
        }
      }
    } catch (error) {
      console.error('Erro ao gerar URLs do player:', error);
    }
  };

  const getActiveStreamUrl = () => {
    if (playlistTransmissionActive) {
      // Priorizar playlist se estiver ativa
      return `http://samhost.wcore.com.br:1935/samhost/${userLogin}_playlist/playlist.m3u8`;
    } else if (obsStreamActive) {
      return `http://samhost.wcore.com.br:1935/samhost/${userLogin}_live/playlist.m3u8`;
    } else if (sampleVideos.length > 0) {
      return getVideoUrl(sampleVideos[0].url);
    }
    return `http://samhost.wcore.com.br:1935/samhost/${userLogin}_live/playlist.m3u8`;
  };

  const getActiveStreamName = () => {
    if (playlistTransmissionActive) {
      return `${userLogin}_playlist`;
    } else if (obsStreamActive) {
      return `${userLogin}_live`;
    }
    return `${userLogin}_live`;
  };

  const getVideoUrl = (url: string) => {
    if (!url) return '';
    
    // Se já é uma URL completa, usar como está
    if (url.startsWith('http')) {
      return url;
    }
    
    // Para URLs do sistema, construir URL do player iframe na porta
    const pathParts = url.split('/');
    if (pathParts.length >= 3) {
      const userPath = pathParts[0];
      const folderName = pathParts[1];
      const fileName = pathParts[2];
      
      // Usar player na porta do sistema
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'http://samhost.wcore.com.br:3001'
        : 'http://localhost:3001';
      
      return `${baseUrl}/api/player-port/iframe?login=${userPath}&vod=${folderName}/${fileName}&aspectratio=16:9&player_type=1&autoplay=false`;
    }
    
    // Fallback
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'http://samhost.wcore.com.br:3001'
      : 'http://localhost:3001';
    
    return `${baseUrl}/api/player-port/iframe?stream=${userLogin}_live`;
  };

  const playerConfigs: PlayerConfig[] = [
    {
      id: 'iframe-port',
      name: 'Player iFrame (Porta do Sistema)',
      description: 'Player via iFrame usando a porta 3001 do sistema atual',
      icon: Monitor,
      type: 'iframe',
      features: ['Mesma Porta', 'Sem Subdomínio', 'Integração Direta', 'Fácil Deploy'],
      code: embedCode || `<iframe src="${playerUrl}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`,
      previewUrl: playerUrl || '',
      isActive: true
    },
    {
      id: 'universal',
      name: 'Player Universal',
      description: 'Player completo com suporte a HLS, MP4 e controles avançados',
      icon: Monitor,
      type: 'universal',
      features: ['HLS/M3U8', 'MP4/AVI/MOV', 'Controles Customizados', 'Fullscreen', 'Estatísticas'],
      code: `<div id="universal-player"></div>
<script>
  // Player Universal - Suporte completo
  const player = new UniversalPlayer({
    container: '#universal-player',
    src: '${getActiveStreamUrl()}',
    autoplay: true,
    controls: true,
    responsive: true
  });
</script>`,
      previewUrl: getActiveStreamUrl(),
      isActive: false
    },
    {
      id: 'iframe-external',
      name: 'Player iFrame (Subdomínio)',
      description: 'Player via subdomínio externo (playerv.samhost.wcore.com.br)',
      icon: Globe,
      type: 'iframe',
      features: ['Subdomínio Dedicado', 'Isolado', 'Múltiplos Players', 'Detecção Automática'],
      code: `<iframe 
  src="https://playerv.samhost.wcore.com.br/?login=${userLogin}&player=1" 
  width="640" 
  height="360" 
  frameborder="0" 
  allowfullscreen>
</iframe>`,
      previewUrl: `https://playerv.samhost.wcore.com.br/?login=${userLogin}&player=1`,
      isActive: false
    },
    {
      id: 'html5',
      name: 'Player HTML5',
      description: 'Player nativo HTML5 para máxima compatibilidade',
      icon: Code,
      type: 'html5',
      features: ['HTML5 Nativo', 'Leve', 'Compatível', 'Sem Dependências'],
      code: `<video 
  width="640" 
  height="360" 
  controls 
  autoplay 
  muted>
  <source src="${getActiveStreamUrl()}" type="application/vnd.apple.mpegurl">
  Seu navegador não suporta vídeo HTML5.
</video>`,
      previewUrl: getActiveStreamUrl(),
      isActive: false
    },
    {
      id: 'mobile',
      name: 'Player Mobile',
      description: 'Otimizado para dispositivos móveis e touch',
      icon: Smartphone,
      type: 'mobile',
      features: ['Touch Friendly', 'Responsivo', 'Baixo Consumo', 'Gestos'],
      code: `<div id="mobile-player" class="mobile-player">
  <video 
    playsinline 
    webkit-playsinline 
    controls 
    width="100%" 
    height="auto">
    <source src="${getActiveStreamUrl()}" type="application/vnd.apple.mpegurl">
  </video>
</div>
<style>
.mobile-player { 
  max-width: 100%; 
  touch-action: manipulation; 
}
</style>`,
      previewUrl: getActiveStreamUrl(),
      isActive: false
    }
  ];

  const activatePlayer = (playerId: string) => {
    setActivePlayer(playerId);
    
    // Regenerar URLs se for o player da porta
    if (playerId === 'iframe-port') {
      generatePlayerUrls();
    }
    
    toast.success(`Player ${playerConfigs.find(p => p.id === playerId)?.name} ativado!`);
  };

  const copyCode = (code: string, playerName: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Código do ${playerName} copiado!`);
  };

  const openPreview = (video?: Video) => {
    if (video) {
      setPreviewVideo(video);
    } else {
      setPreviewVideo({
        id: 0,
        nome: 'Stream ao Vivo',
        url: getActiveStreamUrl()
      });
    }
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewVideo(null);
    setIsFullscreen(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const renderPlayerPreview = (config: PlayerConfig) => {
    const isActive = config.id === activePlayer;
    
    if (!isActive) {
      return (
        <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <config.icon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Clique em "Ativar" para usar este player</p>
          </div>
        </div>
      );
    }

    switch (config.type) {
      case 'iframe':
        if (config.id === 'iframe-port' && playerUrl) {
          return (
            <div className="h-48 bg-black rounded-lg overflow-hidden">
              <IFrameVideoPlayer
                src={playerUrl}
                title="Player na Porta do Sistema"
                autoplay={false}
                controls={true}
                className="w-full h-full"
                onError={(error) => {
                  console.error('Erro no IFrame player:', error);
                }}
                onReady={() => {
                  console.log('IFrame player pronto');
                }}
              />
            </div>
          );
        } else {
          return (
            <div className="h-48 bg-black rounded-lg overflow-hidden">
              <iframe
                src={config.previewUrl}
                className="w-full h-full"
                frameBorder="0"
                allowFullScreen
                title="Player Preview"
              />
            </div>
          );
        }

      case 'html5':
        return (
          <div className="h-48 bg-black rounded-lg overflow-hidden">
            <video
              className="w-full h-full object-contain"
              controls
              muted
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23000'/%3E%3Ctext x='320' y='180' text-anchor='middle' fill='white' font-family='Arial' font-size='24'%3EHTML5 Player%3C/text%3E%3C/svg%3E"
            >
              <source src={sampleVideos[0]?.url || getActiveStreamUrl()} type="application/vnd.apple.mpegurl" />
              <source src={sampleVideos[0]?.url || getActiveStreamUrl()} type="video/mp4" />
            </video>
          </div>
        );

      case 'mobile':
        return (
          <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <div className="text-center text-white">
              <Smartphone className="h-12 w-12 mx-auto mb-3" />
              <div className="text-lg font-semibold">Player Mobile Ativo</div>
              <div className="text-sm opacity-80">Otimizado para touch</div>
              <div className="mt-3 flex justify-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <config.icon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Player em desenvolvimento</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <Link to="/dashboard" className="flex items-center text-primary-600 hover:text-primary-800">
          <ChevronLeft className="h-5 w-5 mr-1" />
          <span>Voltar ao Dashboard</span>
        </Link>
      </div>

      <div className="flex items-center space-x-3">
        <Play className="h-8 w-8 text-primary-600" />
        <h1 className="text-3xl font-bold text-gray-900">Players de Vídeo</h1>
      </div>

      {/* Informações sobre o novo sistema */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start">
          <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-green-900 font-medium mb-2">🚀 Sistema de Player na Porta do Sistema</h3>
            <ul className="text-green-800 text-sm space-y-1">
              <li>• <strong>Mesma porta do sistema:</strong> Usa a porta 3001 (backend) em vez de subdomínio</li>
              <li>• <strong>Deploy simplificado:</strong> Não precisa configurar subdomínio separado</li>
              <li>• <strong>Integração direta:</strong> Acesso direto às APIs e autenticação</li>
              <li>• <strong>Fallback automático:</strong> Se porta não funcionar, usa subdomínio</li>
              <li>• <strong>URLs de exemplo:</strong></li>
              <li>&nbsp;&nbsp;- Desenvolvimento: http://localhost:3001/api/player-port/iframe</li>
              <li>&nbsp;&nbsp;- Produção: http://samhost.wcore.com.br:3001/api/player-port/iframe</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Player Ativo */}
      <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Player Ativo</h2>
          <div className="flex items-center space-x-3">
            {(obsStreamActive || liveStreamActive) && (
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  playlistTransmissionActive ? 'bg-blue-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm font-medium text-red-600">
                  {playlistTransmissionActive ? `📺 PLAYLIST: ${activePlaylistName}` :
                   obsStreamActive ? 'OBS AO VIVO' : 'PLAYLIST AO VIVO'}
                </span>
              </div>
            )}
            <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
              {playerConfigs.find(p => p.id === activePlayer)?.name}
            </span>
            <button
              onClick={generatePlayerUrls}
              disabled={loading}
              className="text-primary-600 hover:text-primary-800 flex items-center text-sm"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar URLs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            {renderPlayerPreview(playerConfigs.find(p => p.id === activePlayer)!)}
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Recursos Ativos</h3>
              <div className="flex flex-wrap gap-2">
                {playerConfigs.find(p => p.id === activePlayer)?.features.map((feature, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => openPreview()}
                className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 flex items-center justify-center"
              >
                <Eye className="h-4 w-4 mr-2" />
                {playlistTransmissionActive ? `📺 Visualizar Playlist: ${activePlaylistName}` :
                 obsStreamActive ? 'Visualizar OBS ao Vivo' : 
                 'Visualizar Stream'}
              </button>

              {sampleVideos.length > 0 && (
                <button
                  onClick={() => openPreview(sampleVideos[0])}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Testar com Vídeo
                </button>
              )}
              
              <button
                onClick={() => {
                  const streamName = getActiveStreamName();
                  const url = playerUrl || `/api/player-port/iframe?stream=${streamName}`;
                  window.open(url, '_blank');
                }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {playlistTransmissionActive ? '📺 Abrir Playlist Externa' :
                 obsStreamActive ? 'Abrir OBS Externo' : 
                 'Abrir Player Externo'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Players Disponíveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playerConfigs.map((config) => (
          <div key={config.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${config.id === activePlayer ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <config.icon className={`h-6 w-6 ${config.id === activePlayer ? 'text-green-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{config.name}</h3>
                  {config.id === activePlayer && (
                    <span className="text-xs text-green-600 font-medium">ATIVO</span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-4">{config.description}</p>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Recursos:</h4>
              <div className="flex flex-wrap gap-1">
                {config.features.map((feature, index) => (
                  <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {config.id !== activePlayer ? (
                <button
                  onClick={() => activatePlayer(config.id)}
                  className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 flex items-center justify-center"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Ativar Player
                </button>
              ) : (
                <button
                  disabled
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md flex items-center justify-center cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Player Ativo
                </button>
              )}

              <button
                onClick={() => copyCode(config.code, config.name)}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center justify-center"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Código
              </button>
              
              {config.type === 'iframe' && config.previewUrl && (
                <button
                  onClick={() => window.open(config.previewUrl, '_blank')}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Externamente
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Códigos de Incorporação */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Códigos de Incorporação</h2>
        
        <div className="space-y-6">
          {playerConfigs.map((config) => (
            <div key={config.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-800">{config.name}</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyCode(config.code, config.name)}
                    className="text-primary-600 hover:text-primary-800 flex items-center"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar
                  </button>
                  {config.type === 'iframe' && config.previewUrl && (
                    <button
                      onClick={() => window.open(config.previewUrl, '_blank')}
                      className="text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Testar
                    </button>
                  )}
                </div>
              </div>
              
              <pre className="bg-gray-50 p-3 rounded-md text-sm overflow-x-auto">
                <code>{config.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Visualização */}
      {showPreview && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closePreview();
            }
          }}
        >
          <div className={`bg-black rounded-lg relative ${
            isFullscreen ? 'w-screen h-screen' : 'max-w-4xl w-full h-[70vh]'
          }`}>
            {/* Controles do Modal */}
            <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
              <button
                onClick={toggleFullscreen}
                className="text-white bg-blue-600 hover:bg-blue-700 rounded-full p-3 transition-colors duration-200 shadow-lg"
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
              
              <button
                onClick={closePreview}
                className="text-white bg-red-600 hover:bg-red-700 rounded-full p-3 transition-colors duration-200 shadow-lg"
                title="Fechar player"
              >
                <X size={20} />
              </button>
            </div>

            {/* Título do Vídeo */}
            <div className="absolute top-4 left-4 z-20 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg">
              <h3 className="font-medium">{previewVideo?.nome || 'Visualização'}</h3>
              <p className="text-xs opacity-80">Player: {playerConfigs.find(p => p.id === activePlayer)?.name}</p>
            </div>

            {/* Player */}
            <div className={`w-full h-full ${isFullscreen ? 'p-0' : 'p-4 pt-16'}`}>
              <IFrameVideoPlayer
                src={playerUrl || previewVideo?.url || getActiveStreamUrl()}
                title={previewVideo?.nome}
                isLive={previewVideo?.id === 0}
                autoplay={true}
                controls={true}
                className="w-full h-full"
                onError={(error) => {
                  console.error('Erro no player de preview:', error);
                  toast.error('Erro ao carregar vídeo');
                }}
                onReady={() => {
                  console.log('Player de preview pronto');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Informações Técnicas */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-blue-900 font-medium mb-3">📋 Comparação de Sistemas</h3>
        
        {/* Status das transmissões */}
        <div className="mb-4 p-3 bg-white rounded-md">
          <h4 className="font-medium mb-2">Status das Transmissões:</h4>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${playlistTransmissionActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
              <span className={playlistTransmissionActive ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                Playlist {playlistTransmissionActive ? `"${activePlaylistName}" AO VIVO` : 'OFFLINE'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${obsStreamActive ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
              <span className={obsStreamActive ? 'text-red-600 font-medium' : 'text-gray-500'}>
                OBS {obsStreamActive ? 'AO VIVO' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-blue-800 text-sm">
          <div>
            <h4 className="font-medium mb-2">Sistema de Porta (Recomendado):</h4>
            <ul className="space-y-1">
              <li>• <strong>URL:</strong> samhost.wcore.com.br:3001/api/player-port/iframe</li>
              <li>• <strong>Vantagem:</strong> Não precisa configurar subdomínio</li>
              <li>• <strong>Deploy:</strong> Funciona automaticamente</li>
              <li>• <strong>Autenticação:</strong> Integrada ao sistema</li>
              <li>• <strong>Manutenção:</strong> Mais simples</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Sistema de Subdomínio (Alternativo):</h4>
            <ul className="space-y-1">
              <li>• <strong>URL:</strong> playerv.samhost.wcore.com.br</li>
              <li>• <strong>Vantagem:</strong> Isolamento completo</li>
              <li>• <strong>Deploy:</strong> Requer configuração DNS</li>
              <li>• <strong>Recursos:</strong> Múltiplos players</li>
              <li>• <strong>Detecção:</strong> Automática de transmissões</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-100 rounded-md">
          <p className="text-blue-900 text-sm">
            <strong>💡 Recomendação:</strong> Use o sistema de porta para deploy mais simples. 
            O player funciona na mesma porta do backend (3001) e não requer configuração adicional de DNS ou subdomínio.
          </p>
        </div>
        
        {(obsStreamActive || playlistTransmissionActive) && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 text-sm font-medium">
              🎉 {playlistTransmissionActive ? `📺 Playlist "${activePlaylistName}" em transmissão!` : 'Transmissão OBS ativa!'} Os players agora mostram seu conteúdo ao vivo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Players;