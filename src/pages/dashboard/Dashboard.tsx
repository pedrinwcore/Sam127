import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStream } from '../../context/StreamContext';
import { 
  Activity, Users, Zap, Clock, Play, Square, Radio, Video, Pause,
  TrendingUp, Globe, Monitor, Smartphone, Eye, Settings,
  AlertCircle, CheckCircle, Wifi, WifiOff, Server, HardDrive
} from 'lucide-react';
import { toast } from 'react-toastify';
import IFrameVideoPlayer from '../../components/IFrameVideoPlayer';

interface DashboardStats {
  totalVideos: number;
  totalPlaylists: number;
  totalEspaco: number;
  espacoUsado: number;
  transmissaoAtiva: boolean;
  espectadoresAtivos: number;
  ultimaTransmissao?: string;
}

interface StreamStatus {
  is_live: boolean;
  stream_type?: 'playlist' | 'obs';
  transmission?: {
    id: number;
    titulo: string;
    codigo_playlist: number;
    stats: {
      viewers: number;
      bitrate: number;
      uptime: string;
    };
    platforms: any[];
  };
  obs_stream?: {
    is_live: boolean;
    viewers: number;
    bitrate: number;
    uptime: string;
    recording: boolean;
  };
}

interface RecentVideo {
  id: number;
  nome: string;
  url: string;
  duracao?: number;
  data_upload: string;
}

const Dashboard: React.FC = () => {
  const { user, getToken } = useAuth();
  const { streamData } = useStream();
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    totalPlaylists: 0,
    totalEspaco: 0,
    espacoUsado: 0,
    transmissaoAtiva: false,
    espectadoresAtivos: 0
  });
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');
  const [showPlayer, setShowPlayer] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [playlistName, setPlaylistName] = useState<string>('');
  const [playerError, setPlayerError] = useState<string | null>(null);

  const userLogin = user?.usuario || (user?.email ? user.email.split('@')[0] : `user_${user?.id || 'usuario'}`);

  useEffect(() => {
    loadDashboardData();
    
    // Carregar HLS.js se não estiver disponível
    if (typeof window !== 'undefined' && !window.Hls) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.onload = () => {
        console.log('✅ HLS.js carregado');
      };
      document.head.appendChild(script);
    }
    
    // Atualizar dados a cada 60 segundos (reduzido para melhor performance)
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handlePauseTransmission = async () => {
    if (!confirm('Deseja pausar a transmissão atual?')) return;
    
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Transmissão pausada');
        loadStreamStatus();
      } else {
        toast.error(result.error || 'Erro ao pausar transmissão');
      }
    } catch (error) {
      console.error('Erro ao pausar transmissão:', error);
      toast.error('Erro ao pausar transmissão');
    }
  };

  const handleStopTransmission = async () => {
    if (!confirm('Deseja finalizar a transmissão atual?')) return;
    
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transmission_id: streamStatus?.transmission?.id,
          stream_type: streamStatus?.stream_type || 'playlist'
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Transmissão finalizada');
        loadStreamStatus();
        setShowPlayer(false);
        setCurrentVideoUrl('');
      } else {
        toast.error(result.error || 'Erro ao finalizar transmissão');
      }
    } catch (error) {
      console.error('Erro ao finalizar transmissão:', error);
      toast.error('Erro ao finalizar transmissão');
    }
  };
  const loadDashboardData = async () => {
    if (loadingStats) return; // Evitar múltiplas chamadas simultâneas
    
    setLoadingStats(true);
    try {
      await Promise.all([
        loadStats(),
        loadStreamStatus(),
        // loadRecentVideos() // Comentado para melhor performance inicial
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
      setLoadingStats(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = await getToken();
      
      // Carregar apenas dados essenciais para melhor performance
      const [foldersResponse, playlistsResponse] = await Promise.all([
        fetch('/api/folders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/playlists', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let espacoUsado = 0;
      let totalVideos = 0;

      if (foldersResponse.ok) {
        const folders = await foldersResponse.json();
        espacoUsado = folders.reduce((acc: number, folder: any) => acc + (folder.espaco_usado || 0), 0);
        totalVideos = folders.reduce((acc: number, folder: any) => acc + (folder.video_count_db || 0), 0);
      }


      let totalPlaylists = 0;
      if (playlistsResponse.ok) {
        const playlists = await playlistsResponse.json();
        totalPlaylists = Array.isArray(playlists) ? playlists.length : 0;
      }

      setStats({
        totalVideos,
        totalPlaylists,
        totalEspaco: user?.espaco || 1000,
        espacoUsado,
        transmissaoAtiva: streamStatus?.is_live || false,
        espectadoresAtivos: streamStatus?.transmission?.stats.viewers || streamStatus?.obs_stream?.viewers || 0
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const loadStreamStatus = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStreamStatus(data);
        
        // Definir URL do player e nome baseado no status
        if (data.is_live) {
          if (data.stream_type === 'obs' || data.obs_stream?.is_live) {
            // Para OBS, usar URL do player na porta do sistema
            const baseUrl = process.env.NODE_ENV === 'production' 
              ? 'http://samhost.wcore.com.br:3001'
              : 'http://localhost:3001';
            setCurrentVideoUrl(`${baseUrl}/api/player-port/iframe?login=${userLogin}&stream=${userLogin}_live&player=1&contador=true`);
            setPlaylistName('Transmissão OBS');
          } else if (data.transmission) {
            // Para playlist, usar URL do player na porta do sistema
            const baseUrl = process.env.NODE_ENV === 'production' 
              ? 'http://samhost.wcore.com.br:3001'
              : 'http://localhost:3001';
            setCurrentVideoUrl(`${baseUrl}/api/player-port/iframe?login=${userLogin}&playlist=${data.transmission.codigo_playlist}&player=1&contador=true`);
            
            // Buscar nome da playlist
            if (data.transmission.codigo_playlist) {
              try {
                const playlistResponse = await fetch(`/api/playlists`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (playlistResponse.ok) {
                  const playlists = await playlistResponse.json();
                  const playlist = playlists.find((p: any) => p.id === data.transmission.codigo_playlist);
                  setPlaylistName(playlist ? `📺 Playlist: ${playlist.nome}` : data.transmission.titulo);
                }
              } catch (error) {
                setPlaylistName(data.transmission.titulo);
              }
            } else {
              setPlaylistName(data.transmission.titulo);
            }
          }
          setShowPlayer(true);
        } else {
          setShowPlayer(false);
          setPlaylistName('');
          setPlayerError(null);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar status de transmissão:', error);
      setPlayerError('Erro ao carregar status de transmissão');
    }
  };

  const loadRecentVideos = async () => {
    try {
      const token = await getToken();
      
      // Tentar carregar vídeos da primeira pasta disponível
      const foldersResponse = await fetch('/api/folders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (foldersResponse.ok) {
        const folders = await foldersResponse.json();
        if (folders.length > 0) {
          const videosResponse = await fetch(`/api/videos?folder_id=${folders[0].id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (videosResponse.ok) {
            const videos = await videosResponse.json();
            setRecentVideos(Array.isArray(videos) ? videos.slice(0, 5) : []);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vídeos recentes:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStoragePercentage = () => {
    return Math.round((stats.espacoUsado / stats.totalEspaco) * 100);
  };

  const getStorageColor = () => {
    const percentage = getStoragePercentage();
    if (percentage > 90) return 'bg-red-500';
    if (percentage > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Olá, {user?.nome || 'Usuário'}! 👋
              </h1>
              <p className="text-purple-100 text-lg">
                Bem-vindo ao seu painel de streaming
              </p>
              <div className="mt-4 flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4" />
                  <span>Plano: {user?.tipo === 'revenda' ? 'Revenda' : 'Streaming'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4" />
                  <span>Bitrate: {user?.bitrate || 2500} kbps</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Espectadores: {user?.espectadores || 100}</span>
                </div>
              </div>
            </div>
            
            {streamStatus?.is_live && (
              <div className="text-right">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-lg font-semibold">AO VIVO</span>
                </div>
                <div className="text-purple-100 text-sm">
                  {streamStatus.stream_type === 'obs' ? 'Transmissão OBS' : 'Transmissão Playlist'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Vídeos</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalVideos}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <TrendingUp className="h-4 w-4 mr-1" />
            <span>Biblioteca de conteúdo</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Playlists</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPlaylists}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Play className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <Activity className="h-4 w-4 mr-1" />
            <span>Conteúdo organizado</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Espectadores</p>
              <p className="text-3xl font-bold text-gray-900">{stats.espectadoresAtivos}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            {streamStatus?.is_live ? (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                <span>Ao vivo agora</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                <span>Audiência total</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Armazenamento</p>
              <p className="text-3xl font-bold text-gray-900">{getStoragePercentage()}%</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <HardDrive className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
              <span>{stats.espacoUsado} MB usado</span>
              <span>{stats.totalEspaco} MB total</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStorageColor()}`}
                style={{ width: `${getStoragePercentage()}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stream Status */}
      {streamStatus?.is_live && (
        <div className={`rounded-2xl p-6 text-white ${
          streamStatus.stream_type === 'playlist' 
            ? 'bg-gradient-to-r from-blue-500 to-purple-600' 
            : 'bg-gradient-to-r from-red-500 to-pink-600'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
              <h2 className="text-xl font-bold">
                {streamStatus.stream_type === 'obs' ? 'TRANSMISSÃO OBS ATIVA' : 
                 streamStatus.stream_type === 'playlist' ? 'PLAYLIST EM TRANSMISSÃO' : 
                 'TRANSMISSÃO ATIVA'}
              </h2>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>
                  {streamStatus.transmission?.stats.viewers || streamStatus.obs_stream?.viewers || 0} espectadores
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap className="h-4 w-4" />
                <span>
                  {streamStatus.transmission?.stats.bitrate || streamStatus.obs_stream?.bitrate || 0} kbps
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>
                  {streamStatus.transmission?.stats.uptime || streamStatus.obs_stream?.uptime || '00:00:00'}
                </span>
              </div>
            </div>
          </div>
          
          {streamStatus.transmission && playlistName && streamStatus.stream_type === 'playlist' && (
            <p className="text-purple-100">
              <strong>Playlist:</strong> {playlistName}
            </p>
          )}
          
          {streamStatus.stream_type === 'playlist' && (
            <div className="mt-3 p-3 bg-white bg-opacity-20 rounded-lg">
              <p className="text-sm">
                <strong>📺 Transmissão de Playlist:</strong> A playlist está sendo transmitida automaticamente.
                Os vídeos são reproduzidos em sequência conforme configurado.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Player Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Player Universal</h2>
              <div className="flex items-center space-x-2">
                {streamStatus?.is_live ? (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 rounded-full">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-red-700">AO VIVO</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-600">OFFLINE</span>
                  </div>
                )}
              </div>
            </div>

            <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden">
              {showPlayer && currentVideoUrl ? (
                <IFrameVideoPlayer
                  src={currentVideoUrl}
                  title={playlistName || streamStatus?.transmission?.titulo || 'Transmissão ao Vivo'}
                  isLive={streamStatus?.is_live || false}
                  autoplay={false}
                  controls={true}
                  className="w-full h-full"
                  onLoad={() => console.log('IFrame Dashboard carregado')}
                  onError={(error) => {
                    console.error('Erro no IFrame Dashboard:', error);
                    setPlayerError('Erro ao carregar player');
                  }}
                  onReady={() => {
                    console.log('IFrame Dashboard pronto');
                    setPlayerError(null);
                  }}
                  streamStats={streamStatus?.is_live ? {
                    viewers: streamStatus.transmission?.stats.viewers || streamStatus.obs_stream?.viewers || 0,
                    bitrate: streamStatus.transmission?.stats.bitrate || streamStatus.obs_stream?.bitrate || 0,
                    uptime: streamStatus.transmission?.stats.uptime || streamStatus.obs_stream?.uptime || '00:00:00',
                    quality: '1080p',
                    isRecording: streamStatus.obs_stream?.recording || false
                  } : undefined}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white">
                  <div className="w-20 h-20 bg-white bg-opacity-10 rounded-2xl flex items-center justify-center mb-4">
                    <Play className="h-10 w-10" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {playerError ? 'Erro no Player' :
                     streamStatus?.is_live ? 'Carregando transmissão...' : 'Nenhuma transmissão ativa'}
                  </h3>
                  <p className="text-gray-300 text-center max-w-md">
                    {playerError ? playerError :
                     streamStatus?.is_live 
                      ? 'Aguarde o carregamento da transmissão'
                      : 'Inicie uma playlist ou transmissão OBS para visualizar aqui'
                    }
                  </p>
                  {playerError && (
                    <button
                      onClick={() => {
                        setPlayerError(null);
                        loadStreamStatus();
                      }}
                      className="mt-4 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tentar Novamente
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar with recent content and quick actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-3">
              {streamStatus?.is_live ? (
                <>
                  <button
                    onClick={handleStopTransmission}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-600 text-white p-3 rounded-xl font-medium hover:from-red-600 hover:to-pink-700 transition-all duration-200 flex items-center justify-center"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    Finalizar Transmissão
                  </button>
                  
                  <button
                    onClick={() => window.location.href = '/dashboard/iniciar-transmissao'}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-3 rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center"
                  >
                    <Settings className="h-5 w-5 mr-2" />
                    Gerenciar Transmissão
                  </button>
                </>
              ) : (
                <button
                  onClick={() => window.location.href = '/dashboard/iniciar-transmissao'}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-600 text-white p-3 rounded-xl font-medium hover:from-red-600 hover:to-pink-700 transition-all duration-200 flex items-center justify-center"
                >
                  <Radio className="h-5 w-5 mr-2" />
                  Iniciar Transmissão
                </button>
              )}
              
              <button
                onClick={() => window.location.href = '/dashboard/gerenciarvideos'}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-3 rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center"
              >
                <Video className="h-5 w-5 mr-2" />
                Gerenciar Vídeos
              </button>
              
              <button
                onClick={() => window.location.href = '/dashboard/espectadores'}
                className="w-full bg-gradient-to-r from-purple-500 to-violet-600 text-white p-3 rounded-xl font-medium hover:from-purple-600 hover:to-violet-700 transition-all duration-200 flex items-center justify-center"
              >
                <Users className="h-5 w-5 mr-2" />
                Ver Espectadores
              </button>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Status do Sistema</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-700">Servidor</span>
                </div>
                <span className="text-sm font-medium text-green-600">Online</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-700">Wowza</span>
                </div>
                <span className="text-sm font-medium text-blue-600">Conectado</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-gray-700">API</span>
                </div>
                <span className="text-sm font-medium text-purple-600">Funcionando</span>
              </div>
            </div>
          </div>

          {/* Recent Videos - Só mostrar se não há transmissão ativa */}
          {!streamStatus?.is_live && (
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Vídeos Recentes</h3>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-600">Últimos vídeos enviados</span>
                <button
                  onClick={loadRecentVideos}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Carregar
                </button>
              </div>
              {recentVideos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Video className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Nenhum vídeo encontrado</p>
                  <button
                    onClick={() => window.location.href = '/dashboard/gerenciarvideos'}
                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Enviar primeiro vídeo
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentVideos.map((video) => (
                    <div key={video.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Video className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {video.nome}
                        </p>
                        <p className="text-xs text-gray-500">
                          {video.duracao ? formatDuration(video.duracao) : 'N/A'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          // Usar IFrame player
                          setCurrentVideoUrl(video.url);
                          setShowPlayer(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Uso de Recursos</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Armazenamento</span>
                <span className="text-sm text-gray-500">
                  {stats.espacoUsado} MB / {stats.totalEspaco} MB
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getStorageColor()}`}
                  style={{ width: `${getStoragePercentage()}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Bitrate Máximo</span>
                <span className="text-sm text-gray-500">{user?.bitrate || 2500} kbps</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full w-full"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Atividade Recente</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Sistema inicializado</span>
              <span className="text-xs text-gray-500 ml-auto">Agora</span>
            </div>
            
            {streamStatus?.is_live && (
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-700">Transmissão iniciada</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {streamStatus.transmission?.stats.uptime || streamStatus.obs_stream?.uptime}
                </span>
              </div>
            )}
            
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Usuário conectado</span>
              <span className="text-xs text-gray-500 ml-auto">Hoje</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Visão Geral da Plataforma</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Radio className="h-8 w-8 text-red-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">Transmissão</h4>
            <p className="text-sm text-gray-500">Múltiplas plataformas</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Video className="h-8 w-8 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">VOD</h4>
            <p className="text-sm text-gray-500">Biblioteca completa</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users className="h-8 w-8 text-purple-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">Audiência</h4>
            <p className="text-sm text-gray-500">Análise em tempo real</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Globe className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">Global</h4>
            <p className="text-sm text-gray-500">Alcance mundial</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;