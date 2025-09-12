import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, AlertCircle, RotateCcw, ExternalLink, Activity, Eye, Clock } from 'lucide-react';

interface VideoJSPlayerProps {
  src?: string;
  title?: string;
  isLive?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
  streamStats?: {
    viewers?: number;
    bitrate?: number;
    uptime?: string;
    quality?: string;
    isRecording?: boolean;
  };
}

declare global {
  interface Window {
    videojs: any;
  }
}

const VideoJSPlayer: React.FC<VideoJSPlayerProps> = ({
  src,
  title,
  isLive = false,
  autoplay = false,
  muted = false,
  controls = true,
  className = '',
  onReady,
  onPlay,
  onPause,
  onEnded,
  onError,
  streamStats
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isDisposed, setIsDisposed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isMounted, setIsMounted] = useState(true);
  const [initializationAttempts, setInitializationAttempts] = useState(0);
  const maxRetries = 3;
  const maxInitAttempts = 5;

  // Cleanup function melhorada
  const cleanupPlayer = () => {
    if (playerRef.current && !isDisposed && isMounted) {
      try {
        console.log('🧹 Limpando Video.js player...');
        setIsDisposed(true);
        
        // Verificar se o player ainda existe e tem métodos válidos
        if (typeof playerRef.current === 'object' && playerRef.current !== null) {
          // Remove all event listeners first
          if (typeof playerRef.current.off === 'function') {
            try {
              playerRef.current.off();
            } catch (offError) {
              console.warn('Erro ao remover listeners:', offError);
            }
          }
          
          // Pause and reset
          if (typeof playerRef.current.pause === 'function') {
            try {
              playerRef.current.pause();
            } catch (pauseError) {
              console.warn('Erro ao pausar player:', pauseError);
            }
          }
          
          // Clear source
          if (typeof playerRef.current.src === 'function') {
            try {
              playerRef.current.src('');
            } catch (srcError) {
              console.warn('Erro ao limpar fonte:', srcError);
            }
          }
          
          // Dispose of the player
          if (typeof playerRef.current.dispose === 'function') {
            try {
              playerRef.current.dispose();
            } catch (disposeError) {
              console.warn('Erro ao fazer dispose do player:', disposeError);
            }
          }
        }
        
        playerRef.current = null;
        setIsPlayerReady(false);
        console.log('✅ Video.js player limpo com sucesso');
      } catch (error) {
        console.warn('⚠️ Erro ao limpar Video.js player:', error);
        // Force cleanup
        playerRef.current = null;
        setIsPlayerReady(false);
      }
    }
  };

  // Verificar se elemento está no DOM
  const isElementInDOM = (element: HTMLElement | null): boolean => {
    if (!element) return false;
    return document.body.contains(element);
  };

  // Aguardar elemento estar no DOM
  const waitForElementInDOM = (element: HTMLElement | null, maxWait = 5000): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!element) {
        resolve(false);
        return;
      }

      if (isElementInDOM(element)) {
        resolve(true);
        return;
      }

      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (isElementInDOM(element)) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  };

  // Carregar Video.js dinamicamente com verificações robustas
  useEffect(() => {
    setIsMounted(true);
    
    const loadVideoJS = async () => {
      // Verificar se Video.js já está carregado
      if (window.videojs) {
        if (isMounted && !isDisposed) {
          await initializePlayer();
        }
        return;
      }

      try {
        // Carregar CSS do Video.js
        if (!document.querySelector('link[href*="video-js.css"]')) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://vjs.zencdn.net/8.6.1/video-js.css';
          document.head.appendChild(cssLink);
        }

        // Carregar JavaScript do Video.js
        if (!document.querySelector('script[src*="video.min.js"]')) {
          const script = document.createElement('script');
          script.src = 'https://vjs.zencdn.net/8.6.1/video.min.js';
          script.onload = () => {
            // Carregar plugin HLS
            if (!document.querySelector('script[src*="videojs-contrib-hls"]')) {
              const hlsScript = document.createElement('script');
              hlsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/videojs-contrib-hls/5.15.0/videojs-contrib-hls.min.js';
              hlsScript.onload = () => {
                if (isMounted && !isDisposed) {
                  initializePlayer();
                }
              };
              hlsScript.onerror = () => {
                if (isMounted) {
                  setError('Erro ao carregar plugin HLS');
                  setLoading(false);
                }
              };
              document.head.appendChild(hlsScript);
            } else {
              if (isMounted && !isDisposed) {
                initializePlayer();
              }
            }
          };
          script.onerror = () => {
            if (isMounted) {
              setError('Erro ao carregar Video.js');
              setLoading(false);
            }
          };
          document.head.appendChild(script);
        } else {
          if (isMounted && !isDisposed) {
            initializePlayer();
          }
        }
      } catch (error) {
        console.error('Erro ao carregar Video.js:', error);
        if (isMounted) {
          setError('Erro ao carregar player');
          setLoading(false);
        }
      }
    };

    const initializePlayer = async () => {
      if (!videoRef.current || !window.videojs || isDisposed || !isMounted) {
        return;
      }

      // Incrementar tentativas de inicialização
      setInitializationAttempts(prev => prev + 1);
      
      if (initializationAttempts >= maxInitAttempts) {
        console.error('❌ Máximo de tentativas de inicialização atingido');
        setError('Erro ao inicializar player após múltiplas tentativas');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setIsDisposed(false);

        // Aguardar elemento estar no DOM
        const elementInDOM = await waitForElementInDOM(videoRef.current, 3000);
        if (!elementInDOM) {
          console.warn('⚠️ Video element não está no DOM, tentando novamente...');
          if (isMounted && !isDisposed && initializationAttempts < maxInitAttempts) {
            setTimeout(() => {
              if (isMounted && !isDisposed) {
                initializePlayer();
              }
            }, 500);
          }
          return;
        }

        // Verificar se o elemento já tem um player
        if (videoRef.current.hasAttribute('data-vjs-player')) {
          console.log('🔄 Elemento já tem player, limpando...');
          try {
            const existingPlayer = window.videojs.getPlayer(videoRef.current);
            if (existingPlayer && typeof existingPlayer.dispose === 'function') {
              existingPlayer.dispose();
            }
          } catch (cleanupError) {
            console.warn('Erro ao limpar player existente:', cleanupError);
          }
          
          // Aguardar limpeza
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Verificar novamente se ainda está montado
        if (!isMounted || isDisposed) {
          return;
        }

        console.log('🎥 Inicializando Video.js player...');

        const player = window.videojs(videoRef.current, {
          controls: controls,
          responsive: true,
          fluid: true,
          playbackRates: [0.5, 1, 1.25, 1.5, 2],
          html5: {
            hls: {
              overrideNative: true,
              enableLowInitialPlaylist: isLive,
              smoothQualityChange: true,
              handlePartialData: true
            },
            vhs: {
              overrideNative: true
            }
          },
          liveui: isLive,
          liveTracker: isLive ? {
            trackingThreshold: 20,
            liveTolerance: 15
          } : false,
          inactivityTimeout: 0,
          userActions: {
            hotkeys: true
          }
        });

        // Verificar se player foi criado com sucesso
        if (!player || typeof player !== 'object') {
          throw new Error('Player não foi criado corretamente');
        }

        // Store player reference
        playerRef.current = player;

        // Event listeners com verificações robustas
        player.ready(() => {
          if (!isMounted || isDisposed || !playerRef.current) return;
          
          console.log('✅ Video.js player pronto');
          setIsPlayerReady(true);
          setLoading(false);
          setRetryCount(0);
          setInitializationAttempts(0);
          
          if (onReady) {
            try {
              onReady();
            } catch (callbackError) {
              console.warn('Erro no callback onReady:', callbackError);
            }
          }
          
          // Configurar fonte inicial se disponível
          if (src && isMounted && !isDisposed) {
            setTimeout(() => {
              if (isMounted && !isDisposed && playerRef.current) {
                updatePlayerSource();
              }
            }, 100);
          }
        });

        // Event listeners com verificações de segurança
        const safeEventListener = (eventName: string, callback: () => void) => {
          player.on(eventName, () => {
            if (!isMounted || isDisposed || !playerRef.current) return;
            try {
              callback();
            } catch (callbackError) {
              console.warn(`Erro no callback ${eventName}:`, callbackError);
            }
          });
        };

        safeEventListener('play', () => {
          console.log('▶️ Video.js play');
          if (onPlay) onPlay();
        });

        safeEventListener('pause', () => {
          console.log('⏸️ Video.js pause');
          if (onPause) onPause();
        });

        safeEventListener('ended', () => {
          console.log('🔚 Video.js ended');
          if (onEnded) onEnded();
        });

        player.on('error', (e: any) => {
          if (!isMounted || isDisposed) return;
          
          console.error('❌ Video.js error:', e);
          const errorObj = player.error();
          
          let errorMessage = 'Erro ao carregar vídeo';
          if (errorObj) {
            switch (errorObj.code) {
              case 1:
                errorMessage = 'Reprodução abortada';
                break;
              case 2:
                errorMessage = 'Erro de rede';
                break;
              case 3:
                errorMessage = 'Erro de decodificação';
                break;
              case 4:
                errorMessage = 'Formato não suportado';
                break;
              default:
                errorMessage = errorObj.message || 'Erro desconhecido';
            }
          }
          
          setError(errorMessage);
          setLoading(false);
          
          if (onError) {
            try {
              onError(e);
            } catch (callbackError) {
              console.warn('Erro no callback onError:', callbackError);
            }
          }
        });

        safeEventListener('loadstart', () => {
          setLoading(true);
          setError(null);
        });

        safeEventListener('canplay', () => {
          setLoading(false);
        });

        safeEventListener('waiting', () => {
          setLoading(true);
        });

        safeEventListener('playing', () => {
          setLoading(false);
        });

      } catch (error) {
        console.error('Erro ao inicializar Video.js:', error);
        if (isMounted) {
          setError('Erro ao inicializar player');
          setLoading(false);
          
          // Retry logic com limite
          if (retryCount < maxRetries && initializationAttempts < maxInitAttempts) {
            console.log(`🔄 Tentativa ${retryCount + 1}/${maxRetries} de reinicializar player...`);
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              if (isMounted && !isDisposed) {
                initializePlayer();
              }
            }, 1000 * (retryCount + 1));
          }
        }
      }
    };

    loadVideoJS();

    return () => {
      setIsMounted(false);
      cleanupPlayer();
    };
  }, []); // Only run once on mount

  // Atualizar fonte quando src mudar
  useEffect(() => {
    if (isPlayerReady && playerRef.current && src && !isDisposed && isMounted) {
      // Aguardar um pouco antes de atualizar fonte para evitar conflitos
      const timeoutId = setTimeout(() => {
        if (isMounted && !isDisposed && playerRef.current) {
          updatePlayerSource();
        }
      }, 200);

      return () => clearTimeout(timeoutId);
    }
  }, [src, isPlayerReady]);

  const updatePlayerSource = () => {
    if (!playerRef.current || !src || isDisposed || !isMounted) return;

    try {
      console.log('🎥 Atualizando fonte Video.js:', src);
      
      // Verificar se player ainda é válido
      if (typeof playerRef.current !== 'object' || playerRef.current === null) {
        console.warn('Player não é válido, pulando atualização de fonte');
        return;
      }
      
      // Detectar tipo de fonte
      const isHLS = src.includes('.m3u8') || isLive;
      
      // Para playlist, construir URL correta
      let finalSrc = src;
      if (src.includes('/playlist/') && src.includes('_playlist.mp4')) {
        // Converter URL de playlist para HLS
        const userLogin = src.split('/')[0];
        finalSrc = `http://samhost.wcore.com.br:1935/${userLogin}/${userLogin}/playlist.m3u8`;
        console.log('🎵 URL de playlist convertida:', finalSrc);
      }
      
      const sourceConfig = {
        src: finalSrc,
        type: isHLS ? 'application/x-mpegURL' : 'video/mp4',
        withCredentials: false
      };

      // Configurar headers de autenticação se necessário
      if (finalSrc.includes('/content/') || finalSrc.includes('/api/')) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          sourceConfig.withCredentials = true;
          // Para Video.js, configurar headers via xhr
          try {
            const tech = playerRef.current.tech();
            if (tech && tech.hls) {
              tech.hls.xhr.beforeRequest = (options: any) => {
                options.headers = options.headers || {};
                options.headers['Authorization'] = `Bearer ${token}`;
                return options;
              };
            }
          } catch (techError) {
            console.warn('Erro ao configurar headers:', techError);
          }
        }
      }

      // Verificar se métodos do player existem antes de usar
      if (typeof playerRef.current.pause === 'function') {
        try {
          playerRef.current.pause();
        } catch (pauseError) {
          console.warn('Erro ao pausar antes de trocar fonte:', pauseError);
        }
      }
      
      if (typeof playerRef.current.src === 'function') {
        try {
          playerRef.current.src('');
        } catch (srcError) {
          console.warn('Erro ao limpar fonte:', srcError);
        }
      }
      
      // Wait a bit before setting new source
      setTimeout(() => {
        if (playerRef.current && !isDisposed && isMounted && typeof playerRef.current.src === 'function') {
          try {
            playerRef.current.src(sourceConfig);
            
            if (autoplay) {
              setTimeout(() => {
                if (playerRef.current && !isDisposed && isMounted && typeof playerRef.current.play === 'function') {
                  playerRef.current.play().catch((error: any) => {
                    console.warn('Autoplay falhou:', error);
                  });
                }
              }, 500);
            }
          } catch (sourceError) {
            console.error('Erro ao definir nova fonte:', sourceError);
            setError('Erro ao carregar vídeo');
          }
        }
      }, 200);
      
    } catch (error) {
      console.error('Erro ao atualizar fonte:', error);
      setError('Erro ao carregar vídeo');
    }
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    setRetryCount(0);
    setInitializationAttempts(0);
    
    // Limpar player atual
    cleanupPlayer();
    
    // Aguardar limpeza e reinicializar
    setTimeout(() => {
      if (!isDisposed && isMounted) {
        setIsDisposed(false);
        setIsPlayerReady(false);
        
        // Recarregar página como último recurso se muitas tentativas falharam
        if (initializationAttempts >= maxInitAttempts) {
          console.log('🔄 Muitas tentativas falharam, recarregando página...');
          window.location.reload();
        }
      }
    }, 500);
  };

  const openInNewTab = () => {
    if (src) {
      // Para vídeos que precisam de token, construir URL externa
      if (src.includes('/content/') || src.includes('/api/')) {
        const token = localStorage.getItem('auth_token');
        const separator = src.includes('?') ? '&' : '?';
        const externalUrl = `${src}${separator}auth_token=${encodeURIComponent(token || '')}`;
        window.open(externalUrl, '_blank');
      } else {
        window.open(src, '_blank');
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsMounted(false);
      cleanupPlayer();
    };
  }, []);

  // Não renderizar se não há src
  if (!src) {
    return (
      <div className={`aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex flex-col items-center justify-center text-white ${className}`}>
        <Play className="h-16 w-16 mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold mb-2">Video.js Player</h3>
        <p className="text-gray-400 text-center max-w-md">
          Player profissional com suporte completo a HLS, MP4 e recursos avançados
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`videojs-player-container relative ${className}`}>
      {/* Estatísticas do stream */}
      {streamStats && showStats && (
        <div className="absolute top-4 left-4 z-20 bg-black bg-opacity-80 text-white p-3 rounded-lg text-sm">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Eye className="h-3 w-3" />
              <span>{streamStats.viewers || 0} espectadores</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="h-3 w-3" />
              <span>{streamStats.bitrate || 0} kbps</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-3 w-3" />
              <span>{streamStats.uptime || '00:00:00'}</span>
            </div>
            {streamStats.quality && (
              <div className="flex items-center space-x-2">
                <Settings className="h-3 w-3" />
                <span>{streamStats.quality}</span>
              </div>
            )}
            {streamStats.isRecording && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span>Gravando</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Indicador de transmissão ao vivo */}
      {isLive && (
        <div className="absolute top-4 right-4 z-20">
          <div className="bg-red-600 text-white px-3 py-1 rounded-full flex items-center space-x-2 text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>AO VIVO</span>
          </div>
        </div>
      )}

      {/* Botão de estatísticas */}
      {streamStats && (
        <div className="absolute top-4 right-20 z-20">
          <button
            onClick={() => setShowStats(!showStats)}
            className="bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-opacity"
            title="Estatísticas"
          >
            <Activity className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-50 rounded-lg">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <span className="text-white text-sm">
              {retryCount > 0 ? `Tentativa ${retryCount}/${maxRetries}...` : 
               initializationAttempts > 0 ? `Inicializando (${initializationAttempts}/${maxInitAttempts})...` :
               'Carregando Video.js...'}
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-75 rounded-lg">
          <div className="flex flex-col items-center space-y-4 text-white text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Erro de Reprodução</h3>
              <p className="text-sm text-gray-300 mb-4">{error}</p>
              <div className="flex space-x-3">
                <button
                  onClick={retry}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Tentar Novamente</span>
                </button>
                <button
                  onClick={openInNewTab}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Abrir em Nova Aba</span>
                </button>
              </div>
              {initializationAttempts > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Tentativas de inicialização: {initializationAttempts}/{maxInitAttempts}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Elemento de vídeo para Video.js */}
      <video
        ref={videoRef}
        className="video-js vjs-default-skin w-full"
        controls={controls}
        preload="auto"
        data-setup="{}"
        playsInline
        crossOrigin="anonymous"
      />

      {/* Título do vídeo */}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pointer-events-none rounded-b-lg">
          <h3 className="text-white text-lg font-semibold truncate">{title}</h3>
          {streamStats && (
            <div className="text-white text-sm opacity-80 mt-1">
              {streamStats.quality && <span>{streamStats.quality}</span>}
              {streamStats.bitrate && <span> • {streamStats.bitrate} kbps</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoJSPlayer;