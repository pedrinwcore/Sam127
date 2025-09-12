import React, { useState, useEffect } from 'react';
import { ChevronLeft, Video, Settings, Play, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import IFrameVideoPlayer from '../../components/IFrameVideoPlayer';

interface VideoConversion {
  id: number;
  nome: string;
  url: string;
  duracao?: number;
  tamanho?: number;
  bitrate_video?: number;
  formato_original?: string;
  codec_video?: string;
  largura?: number;
  altura?: number;
  status_conversao?: 'nao_iniciada' | 'em_andamento' | 'concluida' | 'erro';
  path_video_mp4?: string;
  data_conversao?: string;
  is_mp4: boolean;
  current_bitrate: number;
  user_bitrate_limit: number;
  available_qualities: Array<{
    quality: string;
    bitrate: number;
    resolution: string;
    canConvert: boolean;
    reason?: string;
    description: string;
  }>;
  can_use_current: boolean;
  needs_conversion: boolean;
  conversion_status: string;
  compatibility_status?: string;
  compatibility_message?: string;
  qualidade_conversao?: string;
}

interface Folder {
  id: number;
  nome: string;
}

interface QualityPreset {
  quality: string;
  label: string;
  bitrate: number;
  resolution: string;
  available: boolean;
  description: string;
}

interface ConversionSettings {
  quality?: string;
  custom_bitrate?: number;
  custom_resolution?: string;
  use_custom: boolean;
}

const ConversaoVideos: React.FC = () => {
  const { getToken, user } = useAuth();
  const [videos, setVideos] = useState<VideoConversion[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState<Record<number, boolean>>({});
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoConversion | null>(null);
  const [conversionSettings, setConversionSettings] = useState<ConversionSettings>({
    quality: 'custom',
    custom_bitrate: 2500,
    custom_resolution: '1920x1080',
    use_custom: false
  });
  const [qualityPresets, setQualityPresets] = useState<QualityPreset[]>([]);

  // Player modal state
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoConversion | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoHlsUrl, setVideoHlsUrl] = useState('');

  // Função para construir URL do player externo
  const buildExternalPlayerUrl = (videoPath: string) => {
    if (!videoPath) return '';

    if (videoPath.includes('play.php') || videoPath.includes('/api/players/iframe')) {
      return videoPath;
    }

    const cleanPath = videoPath.replace(/^\/+/, '').replace(/^(content\/|streaming\/)?/, '');
    const pathParts = cleanPath.split('/');

    if (pathParts.length >= 3) {
      const userLogin = pathParts[0];
      const folderName = pathParts[1];
      const fileName = pathParts[2];
      const finalFileName = fileName.endsWith('.mp4') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp4');
      const domain = window.location.hostname === 'localhost' ? 'stmv1.udicast.com' : 'samhost.wcore.com.br';
      return `https://${domain}:1443/play.php?login=${userLogin}&video=${folderName}/${finalFileName}`;
    }
    return '';
  };

  useEffect(() => {
    loadFolders();
    loadQualityPresets();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      loadVideos();
    }
  }, [selectedFolder]);

  useEffect(() => {
    if (!currentVideo) return;
    const playerUrl = buildExternalPlayerUrl(currentVideo.url);
    setVideoUrl(playerUrl);
    setVideoHlsUrl(playerUrl);
  }, [currentVideo]);

  const loadFolders = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/folders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setFolders(data);
      if (data.length > 0) {
        setSelectedFolder(data[0].id.toString());
      }
    } catch {
      toast.error('Erro ao carregar pastas');
    }
  };

  const loadQualityPresets = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/conversion/qualities', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setQualityPresets(data.qualities);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar qualidades:', error);
    }
  };

  const loadVideos = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`/api/conversion/videos?folder_id=${selectedFolder}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVideos(data.videos);
        }
      }
    } catch {
      toast.error('Erro ao carregar vídeos');
    } finally {
      setLoading(false);
    }
  };

  const openConversionModal = (video: VideoConversion) => {
    setSelectedVideo(video);
    const currentBitrate = video.current_bitrate || user?.bitrate || 2500;
    const maxBitrate = user?.bitrate || 2500;
    setConversionSettings({
      quality: 'custom',
      custom_bitrate: Math.min(currentBitrate, maxBitrate),
      custom_resolution: '1920x1080',
      use_custom: true
    });
    setShowConversionModal(true);
  };

  const openVideoPlayer = (video: VideoConversion) => {
    setCurrentVideo(video);
    setShowPlayerModal(true);
  };

  const closeVideoPlayer = () => {
    setShowPlayerModal(false);
    setCurrentVideo(null);
    setIsFullscreen(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
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

  const getStatusIcon = (video: VideoConversion) => {
    if (converting[video.id]) {
      return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
    }
    switch (video.status_conversao) {
      case 'concluida':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'em_andamento':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'erro':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Video className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = (video: VideoConversion) => {
    if (converting[video.id]) return 'Convertendo...';
    if (video.compatibility_message === 'Otimizado') return 'Otimizado';
    if (video.compatibility_message === 'Necessário Conversão') return 'Necessário Conversão';
    switch (video.conversion_status) {
      case 'concluida':
        return 'Otimizado';
      case 'em_andamento':
        return 'Convertendo...';
      case 'erro':
        return 'Erro na conversão';
      case 'disponivel':
        return 'Otimizado';
      default:
        return video.can_use_current && !video.needs_conversion ? 'Otimizado' : 'Necessário Conversão';
    }
  };

  const getStatusColor = (video: VideoConversion) => {
    if (converting[video.id]) return 'text-blue-600';
    if (video.compatibility_message === 'Otimizado') return 'text-green-600';
    if (video.compatibility_message === 'Necessário Conversão') return 'text-red-600';
    switch (video.conversion_status) {
      case 'concluida':
        return 'text-green-600';
      case 'em_andamento':
        return 'text-blue-600';
      case 'erro':
        return 'text-red-600';
      default:
        return video.can_use_current && !video.needs_conversion ? 'text-green-600' : 'text-red-600';
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Conversão de Vídeos</h1>
      {loading && <p>Carregando vídeos...</p>}
      {!loading && videos.length === 0 && <p>Nenhum vídeo encontrado.</p>}

      <div className="space-y-2">
        {videos.map(video => (
          <div key={video.id} className="flex items-center gap-3 border p-2 rounded">
            {getStatusIcon(video)}
            <div className="flex-1">
              <p className="font-semibold">{video.nome}</p>
              <p className={`text-sm ${getStatusColor(video)}`}>{getStatusText(video)}</p>
            </div>
            <button
              onClick={() => openConversionModal(video)}
              className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
            >
              Converter
            </button>
            <button
              onClick={() => openVideoPlayer(video)}
              className="px-2 py-1 bg-green-500 text-white rounded text-sm"
            >
              Reproduzir
            </button>
          </div>
        ))}
      </div>

      {showPlayerModal && currentVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-3/4 h-3/4 relative">
            <button onClick={closeVideoPlayer} className="absolute top-2 right-2 text-gray-600">
              ✕
            </button>
            <IFrameVideoPlayer src={videoUrl} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversaoVideos;
