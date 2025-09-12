# Sistema de Player Externo - playerv.samhost.wcore.com.br

## 🎯 Objetivo

Sistema de player externo que integra com o painel de streaming para transmitir playlists ativas ou mostrar "sem sinal" quando não há transmissão.

## 🚀 Funcionalidades

### ✅ Detecção Automática de Transmissão
- Verifica automaticamente se há playlist ou stream OBS ativo
- Mostra "sem sinal" quando não há transmissão
- Recarregamento automático para verificar novas transmissões

### ✅ Múltiplos Players
- **Player 1:** Video.js (Padrão) - Player profissional com HLS
- **Player 2:** Clappr - Player moderno e responsivo
- **Player 3:** JW Player - Player comercial avançado
- **Player 4:** Fluid Player - Player HTML5 fluido
- **Player 5:** FWDUVPlayer - Player com recursos avançados
- **Player 6:** Prontus Player - Player customizável
- **Player 7:** FWDUVPlayer Metal - Tema escuro
- **Player 8:** Radiant Player - Player otimizado
- **HTML5:** Player nativo (fallback)

### ✅ Recursos Avançados
- Contador de espectadores em tempo real
- Compartilhamento social (Facebook, Twitter, WhatsApp, etc.)
- Suporte a diferentes proporções (16:9, 4:3)
- Autoplay, mudo e loop configuráveis
- Marca d'água/watermark
- Responsivo para mobile e desktop

## 📡 URLs de Acesso

### URL Base
```
https://playerv.samhost.wcore.com.br/?login=usuario&player=1
```

### Parâmetros Disponíveis
- `login` (obrigatório): Login do usuário
- `player` (opcional): Tipo de player (1-8, padrão: 1)
- `aspectratio` (opcional): Proporção do vídeo (16:9, 4:3, padrão: 16:9)
- `autoplay` (opcional): Reprodução automática (true/false, padrão: false)
- `muted` (opcional): Iniciar sem som (true/false, padrão: false)
- `loop` (opcional): Repetir vídeo (true/false, padrão: false)
- `contador` (opcional): Mostrar contador (true/false, padrão: false)
- `compartilhamento` (opcional): Botões sociais (true/false, padrão: false)
- `vod` (opcional): Vídeo específico (pasta/arquivo.mp4)

### Exemplos de Uso

#### Stream ao Vivo com Video.js
```
https://playerv.samhost.wcore.com.br/?login=usuario&player=1&contador=true&compartilhamento=true
```

#### VOD Específico
```
https://playerv.samhost.wcore.com.br/?login=usuario&vod=pasta/video.mp4&player=1
```

#### Player Mobile Otimizado
```
https://playerv.samhost.wcore.com.br/?login=usuario&player=2&aspectratio=16:9&autoplay=true&muted=true
```

## 🔧 Integração com Painel

### Detecção de Transmissão
O sistema verifica automaticamente:
1. **Transmissões de Playlist:** Consulta tabela `transmissoes` por status 'ativa'
2. **Streams OBS:** Verifica se há stream ativo no Wowza
3. **Fallback:** Mostra "sem sinal" se nada estiver ativo

### URLs de Streaming
- **Playlist:** `http://samhost.wcore.com.br:1935/samhost/{usuario}_playlist/playlist.m3u8`
- **OBS:** `http://samhost.wcore.com.br:1935/samhost/{usuario}_live/playlist.m3u8`
- **VOD:** `http://samhost.wcore.com.br:1935/vod/_definst_/mp4:{usuario}/{pasta}/{arquivo}/playlist.m3u8`

## 📊 APIs Disponíveis

### Stream Status
```
GET /api/stream-status.php?login=usuario
```
Retorna status da transmissão e URL do stream.

### Viewer Count
```
GET /api/viewer-count.php?login=usuario
```
Retorna contador de espectadores.

## 🛠️ Instalação

### 1. Configurar Subdomínio
Criar entrada DNS para `playerv.samhost.wcore.com.br` apontando para o servidor.

### 2. Configurar Virtual Host
```apache
<VirtualHost *:80>
    ServerName playerv.samhost.wcore.com.br
    DocumentRoot /var/www/playerv
    
    <Directory /var/www/playerv>
        AllowOverride All
        Require all granted
    </Directory>
    
    # Logs
    ErrorLog /var/log/apache2/playerv_error.log
    CustomLog /var/log/apache2/playerv_access.log combined
</VirtualHost>
```

### 3. Upload dos Arquivos
Fazer upload de todos os arquivos para `/var/www/playerv/`

### 4. Configurar Permissões
```bash
sudo chown -R www-data:www-data /var/www/playerv/
sudo chmod -R 755 /var/www/playerv/
```

## 🔗 Integração com Painel React

### Atualizar Players.tsx
```typescript
const generatePlayerCode = () => {
  const playerUrl = `https://playerv.samhost.wcore.com.br/?login=${userLogin}&player=${selectedPlayer}&contador=true&compartilhamento=true`;
  
  return `<iframe 
    src="${playerUrl}" 
    width="640" 
    height="360" 
    frameborder="0" 
    allowfullscreen
    allow="autoplay; fullscreen; picture-in-picture">
  </iframe>`;
};
```

### Atualizar Backend Routes
```javascript
// Em backend/routes/players.js
router.get('/external-url', authMiddleware, async (req, res) => {
  const { login, player = '1', vod } = req.query;
  const userLogin = req.user.usuario || req.user.email.split('@')[0];
  
  let url = `https://playerv.samhost.wcore.com.br/?login=${userLogin}&player=${player}`;
  
  if (vod) {
    url += `&vod=${encodeURIComponent(vod)}`;
  }
  
  res.json({ 
    success: true, 
    external_url: url,
    embed_code: `<iframe src="${url}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`
  });
});
```

## 🎨 Personalização

### Temas e Cores
Cada player pode ser personalizado através de CSS e configurações específicas.

### Watermark/Logo
O sistema suporta marca d'água configurável por usuário.

### Controles
- Contador de espectadores
- Botões de compartilhamento social
- Controles de reprodução avançados

## 🔒 Segurança

- Validação de usuário no banco de dados
- Sanitização de parâmetros de entrada
- Headers de segurança configurados
- CORS configurado para APIs

## 📱 Compatibilidade

- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari, Android Chrome
- **Smart TV:** WebOS, Tizen, Android TV
- **Streaming:** HLS nativo e via JavaScript

## 🚨 Troubleshooting

### Player não carrega
1. Verificar se usuário existe no banco
2. Verificar conectividade com Wowza
3. Verificar logs do Apache/Nginx

### Sem sinal permanente
1. Verificar se há transmissão ativa no painel
2. Verificar URLs de streaming no Wowza
3. Verificar configuração do banco de dados

### Contador não funciona
1. Verificar API de viewer-count
2. Verificar JavaScript no console
3. Verificar CORS headers

## 📞 Suporte

Para problemas:
1. Verificar logs em `/var/log/apache2/playerv_error.log`
2. Testar APIs diretamente
3. Verificar conectividade com banco de dados
4. Verificar status do Wowza