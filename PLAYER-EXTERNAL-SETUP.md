# 🎬 Setup do Sistema de Player Externo

## 📋 Visão Geral

Sistema completo de player externo para `playerv.samhost.wcore.com.br` que integra com o painel de streaming e detecta automaticamente transmissões ativas.

## 🚀 Funcionalidades Implementadas

### ✅ Detecção Inteligente
- **Transmissões de Playlist:** Detecta automaticamente quando há playlist ativa
- **Streams OBS:** Verifica streams ao vivo vindos do OBS
- **Sem Sinal:** Mostra tela de "sem sinal" quando não há transmissão
- **Auto-reload:** Recarrega automaticamente para verificar novas transmissões

### ✅ Múltiplos Players
- **Player 1:** Video.js (Padrão) - Player profissional com HLS
- **Player 2:** Clappr - Player moderno e responsivo  
- **Player 3:** JW Player - Player comercial avançado
- **Player 4:** Fluid Player - Player HTML5 fluido
- **Players 5-8:** Outros players especializados
- **HTML5:** Player nativo como fallback

### ✅ Recursos Avançados
- Contador de espectadores em tempo real
- Compartilhamento social integrado
- Suporte a VOD específico
- Configurações de autoplay, mudo, loop
- Marca d'água/watermark por usuário
- Responsivo para todos os dispositivos

## 🔧 Configuração do Servidor

### 1. Criar Subdomínio
```bash
# Adicionar entrada DNS
playerv.samhost.wcore.com.br A 104.251.209.68
```

### 2. Configurar Virtual Host (Apache)
```apache
<VirtualHost *:80>
    ServerName playerv.samhost.wcore.com.br
    DocumentRoot /var/www/playerv
    
    <Directory /var/www/playerv>
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog /var/log/apache2/playerv_error.log
    CustomLog /var/log/apache2/playerv_access.log combined
</VirtualHost>
```

### 3. Configurar Virtual Host (Nginx)
```nginx
server {
    listen 80;
    server_name playerv.samhost.wcore.com.br;
    
    root /var/www/playerv;
    index index.php index.html;
    
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
}
```

### 4. Upload dos Arquivos
```bash
# Criar diretório
sudo mkdir -p /var/www/playerv

# Fazer upload dos arquivos do player-external/
# - index.php
# - players/
# - api/
# - .htaccess

# Configurar permissões
sudo chown -R www-data:www-data /var/www/playerv/
sudo chmod -R 755 /var/www/playerv/
```

## 📡 URLs de Acesso

### URL Base
```
https://playerv.samhost.wcore.com.br/?login=usuario&player=1
```

### Parâmetros Disponíveis
- `login` (obrigatório): Login do usuário
- `player` (opcional): Tipo de player (1-8, padrão: 1)
- `aspectratio` (opcional): Proporção (16:9, 4:3, padrão: 16:9)
- `autoplay` (opcional): Reprodução automática (true/false)
- `muted` (opcional): Iniciar sem som (true/false)
- `loop` (opcional): Repetir vídeo (true/false)
- `contador` (opcional): Mostrar contador (true/false)
- `compartilhamento` (opcional): Botões sociais (true/false)
- `vod` (opcional): Vídeo específico (pasta/arquivo.mp4)

### Exemplos de Uso

#### Stream ao Vivo Automático
```
https://playerv.samhost.wcore.com.br/?login=usuario&player=1&contador=true&compartilhamento=true
```

#### VOD Específico
```
https://playerv.samhost.wcore.com.br/?login=usuario&vod=filmes/filme.mp4&player=1
```

#### Player Clappr com Autoplay
```
https://playerv.samhost.wcore.com.br/?login=usuario&player=2&autoplay=true&muted=true
```

## 🔗 Integração com Painel

### Backend - Nova Rota
```javascript
// /api/player-external/url
// Gera URL do player externo baseado no usuário logado

// /api/player-external/status  
// Verifica status de transmissão para o player externo

// /api/player-external/embed-code
// Gera código de incorporação responsivo
```

### Frontend - Players.tsx Atualizado
- URLs agora apontam para playerv.samhost.wcore.com.br
- Códigos de incorporação usam sistema externo
- Detecção automática de transmissões ativas

## 🎯 Fluxo de Funcionamento

### 1. Usuário Acessa Player
```
https://playerv.samhost.wcore.com.br/?login=usuario&player=1
```

### 2. Sistema Verifica Transmissão
- Consulta banco de dados por transmissões ativas
- Verifica streams OBS no Wowza
- Determina URL de streaming ou "sem sinal"

### 3. Exibe Conteúdo
- **Com transmissão:** Carrega player com stream ativo
- **Sem transmissão:** Mostra tela "sem sinal" com auto-reload

### 4. Monitoramento Contínuo
- Recarrega automaticamente a cada 30 segundos (sem sinal)
- Monitora erros de stream e reconecta automaticamente
- Atualiza contador de espectadores

## 🛠️ Comandos de Deploy

### Upload Inicial
```bash
# Fazer upload dos arquivos
scp -r player-external/* root@samhost.wcore.com.br:/var/www/playerv/

# Configurar permissões
ssh root@samhost.wcore.com.br "chown -R www-data:www-data /var/www/playerv/ && chmod -R 755 /var/www/playerv/"
```

### Configurar Apache/Nginx
```bash
# Apache
sudo a2ensite playerv.samhost.wcore.com.br
sudo systemctl reload apache2

# Nginx  
sudo ln -s /etc/nginx/sites-available/playerv.samhost.wcore.com.br /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

### Testar Funcionamento
```bash
# Testar acesso básico
curl -I https://playerv.samhost.wcore.com.br/?login=teste&player=1

# Testar API
curl https://playerv.samhost.wcore.com.br/api/stream-status.php?login=teste
```

## 📊 Monitoramento

### Logs
- **Apache:** `/var/log/apache2/playerv_access.log` e `/var/log/apache2/playerv_error.log`
- **Nginx:** `/var/log/nginx/playerv_access.log` e `/var/log/nginx/playerv_error.log`

### Health Check
```bash
# Verificar se subdomínio responde
curl -f https://playerv.samhost.wcore.com.br/?login=teste

# Verificar API de status
curl https://playerv.samhost.wcore.com.br/api/stream-status.php?login=teste
```

## 🔒 Segurança

- Validação de usuário no banco de dados
- Sanitização de todos os parâmetros de entrada
- Headers de segurança configurados
- CORS configurado para APIs
- Proteção contra XSS e injection

## 📱 Compatibilidade

- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari, Android Chrome, Samsung Internet
- **Smart TV:** WebOS, Tizen, Android TV
- **Streaming:** HLS nativo e JavaScript
- **Incorporação:** iFrame seguro em qualquer site

## 🎨 Personalização

### Por Usuário
- Cada usuário tem seu próprio stream
- Watermark/logo personalizado
- Configurações específicas do plano

### Por Player
- Diferentes engines de reprodução
- Temas e estilos únicos
- Recursos específicos de cada player

## 🚨 Troubleshooting

### Player não carrega
1. Verificar DNS do subdomínio
2. Verificar configuração do virtual host
3. Verificar permissões dos arquivos
4. Verificar logs do servidor web

### Sem sinal permanente
1. Verificar se há transmissão ativa no painel
2. Verificar conectividade com Wowza
3. Verificar configuração do banco de dados
4. Verificar URLs de streaming

### Contador não funciona
1. Verificar API de viewer-count
2. Verificar JavaScript no console do navegador
3. Verificar CORS headers

## 📞 Próximos Passos

1. ✅ Configurar subdomínio playerv.samhost.wcore.com.br
2. ✅ Fazer upload dos arquivos do sistema
3. ✅ Configurar virtual host no servidor
4. ✅ Testar com usuários reais
5. ✅ Integrar com painel React
6. ✅ Configurar SSL/HTTPS
7. ✅ Monitorar logs e performance
8. ✅ Documentar para usuários finais