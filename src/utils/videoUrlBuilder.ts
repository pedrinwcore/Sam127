/**
 * Utilitário para construir URLs de vídeo baseadas no padrão fornecido
 * Formato: https://domain:1443/play.php?login=usuario&video=pasta/arquivo.mp4 (Player Externo)
 * Novo: Suporte a iFrame para incorporação no painel
 */

export interface VideoUrlParts {
  userLogin: string;
  folderName: string;
  fileName: string;
}

export class VideoUrlBuilder {
  private static readonly PRODUCTION_DOMAIN = 'stmv1.udicast.com';
  private static readonly DEV_DOMAIN = 'stmv1.udicast.com';
  private static readonly PORT = '1443';

  /**
   * Constrói URL direta baseada no padrão fornecido
   * Agora retorna URL do player externo que já possui o player integrado
   */
  static buildDirectUrl(videoPath: string): string {
    if (!videoPath) return '';

    // Se já é uma URL completa, usar como está
    if (videoPath.startsWith('http')) {
      return videoPath;
    }

    const parts = this.parseVideoPath(videoPath);
    if (!parts) return '';

    const domain = this.getDomain();
    const finalFileName = this.ensureMp4Extension(parts.fileName);

    return `https://${domain}:${this.PORT}/play.php?login=${parts.userLogin}&video=${parts.folderName}/${finalFileName}`;
  }

  /**
   * Constrói URL para iframe (mesmo que direct, pois o player externo já é otimizado)
   */
  static buildIFrameUrl(videoPath: string): string {
    return this.buildDirectUrl(videoPath);
  }
  /**
   * Extrai partes do caminho do vídeo
   */
  private static parseVideoPath(videoPath: string): VideoUrlParts | null {
    const cleanPath = videoPath.replace(/^\/+/, '').replace(/^(content\/|streaming\/)?/, '');
    const pathParts = cleanPath.split('/');
    
    if (pathParts.length >= 3) {
      return {
        userLogin: pathParts[0],
        folderName: pathParts[1],
        fileName: pathParts[2]
      };
    }
    
    return null;
  }

  /**
   * Garante que o arquivo tem extensão .mp4
   */
  private static ensureMp4Extension(fileName: string): string {
    return fileName.endsWith('.mp4') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp4');
  }

  /**
   * Obtém o domínio baseado no ambiente
   */
  private static getDomain(): string {
    // SEMPRE usar o domínio do servidor Wowza, NUNCA o domínio da aplicação
    return this.DEV_DOMAIN; // stmv1.udicast.com
  }

  /**
   * Valida se uma URL está no formato correto
   */
  static isValidDirectUrl(url: string): boolean {
    const pattern = /^https:\/\/[^:]+:1443\/play\.php\?login=[^&]+&video=[^&]+$/;
    return pattern.test(url);
  }

  /**
   * Extrai informações de uma URL direta
   */
  static parseDirectUrl(url: string): VideoUrlParts | null {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      const login = params.get('login');
      const video = params.get('video');
      
      if (!login || !video) return null;
      
      const videoParts = video.split('/');
      if (videoParts.length !== 2) return null;
      
      return {
        userLogin: login,
        folderName: videoParts[0],
        fileName: videoParts[1]
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Constrói URL de download direto
   */
  static buildDownloadUrl(videoPath: string): string {
    // Para download, usar a mesma URL direta
    return this.buildDirectUrl(videoPath);
  }

  /**
   * Constrói URL para embed/iframe
   * Agora usa o player externo que já possui todos os recursos
   */
  static buildEmbedUrl(videoPath: string, options: {
    autoplay?: boolean;
    controls?: boolean;
    aspectRatio?: string;
  } = {}): string {
    // Para embed, usar a mesma URL direta pois o player externo já é otimizado
    return this.buildDirectUrl(videoPath);
  }

  /**
   * Constrói código HTML para incorporação via iframe
   */
  static buildIFrameCode(videoPath: string, options: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    allowFullscreen?: boolean;
  } = {}): string {
    const url = this.buildDirectUrl(videoPath);
    if (!url) return '';

    const {
      width = 640,
      height = 360,
      aspectRatio = '16:9',
      allowFullscreen = true
    } = options;

    return `<iframe 
  src="${url}" 
  width="${width}" 
  height="${height}" 
  frameborder="0" 
  ${allowFullscreen ? 'allowfullscreen' : ''}
  allow="autoplay; fullscreen; picture-in-picture"
  style="max-width: 100%; aspect-ratio: ${aspectRatio};">
</iframe>`;
  }
}

export default VideoUrlBuilder;