<?php
// Sistema de Player Externo - playerv.samhost.wcore.com.br
// Integração com painel de streaming

// Configurações do banco de dados
$db_config = [
    'host' => '104.251.209.68',
    'port' => 35689,
    'user' => 'admin',
    'password' => 'Adr1an@',
    'database' => 'db_SamCast'
];

// Conectar ao banco
try {
    $pdo = new PDO(
        "mysql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['database']};charset=utf8mb4",
        $db_config['user'],
        $db_config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 10
        ]
    );
} catch (PDOException $e) {
    die('Erro de conexão: ' . $e->getMessage());
}

// Função para obter parâmetros da URL
function getParam($name, $default = '') {
    return isset($_GET[$name]) ? trim($_GET[$name]) : $default;
}

// Função para validar login do usuário
function validateUser($pdo, $login) {
    $stmt = $pdo->prepare("
        SELECT s.*, 
               COALESCE(s.usuario, SUBSTRING_INDEX(s.email, '@', 1)) as user_login
        FROM streamings s 
        WHERE (s.usuario = ? OR SUBSTRING_INDEX(s.email, '@', 1) = ?) 
        AND s.status = 1 
        LIMIT 1
    ");
    $stmt->execute([$login, $login]);
    return $stmt->fetch();
}

// Função para verificar transmissão ativa
function checkActiveTransmission($pdo, $userId) {
    // Verificar transmissão de playlist
    $stmt = $pdo->prepare("
        SELECT t.*, p.nome as playlist_nome
        FROM transmissoes t
        LEFT JOIN playlists p ON t.codigo_playlist = p.id
        WHERE t.codigo_stm = ? AND t.status = 'ativa'
        ORDER BY t.data_inicio DESC
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $transmission = $stmt->fetch();
    
    if ($transmission) {
        return [
            'type' => 'playlist',
            'active' => true,
            'data' => $transmission
        ];
    }
    
    // Verificar se há stream OBS ativo (simulado)
    $stmt = $pdo->prepare("
        SELECT codigo_cliente, usuario, email
        FROM streamings 
        WHERE codigo_cliente = ? AND status = 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if ($user) {
        // Simular verificação de stream OBS
        $userLogin = $user['usuario'] ?: explode('@', $user['email'])[0];
        $obsStreamUrl = "http://samhost.wcore.com.br:1935/samhost/{$userLogin}_live/playlist.m3u8";
        
        // Verificar se stream está ativo (simplificado)
        $headers = @get_headers($obsStreamUrl, 1);
        if ($headers && strpos($headers[0], '200') !== false) {
            return [
                'type' => 'obs',
                'active' => true,
                'data' => [
                    'stream_url' => $obsStreamUrl,
                    'user_login' => $userLogin
                ]
            ];
        }
    }
    
    return [
        'type' => 'none',
        'active' => false,
        'data' => null
    ];
}

// Função para obter vídeos da playlist
function getPlaylistVideos($pdo, $playlistId) {
    $stmt = $pdo->prepare("
        SELECT v.nome, v.url, v.caminho, v.duracao
        FROM videos v
        WHERE v.playlist_id = ?
        ORDER BY v.id
    ");
    $stmt->execute([$playlistId]);
    return $stmt->fetchAll();
}

// Função para construir URL de streaming
function buildStreamUrl($userData, $transmissionData = null) {
    $userLogin = $userData['user_login'];
    $domain = 'samhost.wcore.com.br';
    
    if ($transmissionData) {
        if ($transmissionData['type'] === 'playlist') {
            return "http://{$domain}:1935/samhost/{$userLogin}_playlist/playlist.m3u8";
        } elseif ($transmissionData['type'] === 'obs') {
            return "http://{$domain}:1935/samhost/{$userLogin}_live/playlist.m3u8";
        }
    }
    
    // Fallback para stream padrão
    return "http://{$domain}:1935/samhost/{$userLogin}_live/playlist.m3u8";
}

// Parâmetros da URL
$login = getParam('login');
$player = getParam('player', '1');
$aspectratio = getParam('aspectratio', '16:9');
$autoplay = getParam('autoplay', 'false');
$muted = getParam('muted', 'false');
$loop = getParam('loop', 'false');
$contador = getParam('contador', 'false');
$compartilhamento = getParam('compartilhamento', 'false');
$vod = getParam('vod');

// Validar login obrigatório
if (empty($login)) {
    die('<!DOCTYPE html><html><head><title>Erro</title></head><body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:Arial"><div style="text-align:center"><h2>Erro</h2><p>Parâmetro login é obrigatório</p><p>Uso: ?login=usuario&player=1</p></div></body></html>');
}

// Validar usuário
$userData = validateUser($pdo, $login);
if (!$userData) {
    die('<!DOCTYPE html><html><head><title>Usuário não encontrado</title></head><body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:Arial"><div style="text-align:center"><h2>Usuário não encontrado</h2><p>Login: ' . htmlspecialchars($login) . '</p></div></body></html>');
}

$userLogin = $userData['user_login'];

// Se é VOD específico
if (!empty($vod)) {
    $url_source = "http://samhost.wcore.com.br:1935/vod/_definst_/mp4:{$userLogin}/{$vod}/playlist.m3u8";
    $isLive = false;
    $title = "VOD: " . basename($vod);
} else {
    // Verificar transmissão ativa
    $transmissionStatus = checkActiveTransmission($pdo, $userData['codigo_cliente']);
    
    if ($transmissionStatus['active']) {
        $url_source = buildStreamUrl($userData, $transmissionStatus);
        $isLive = true;
        $title = $transmissionStatus['data']['titulo'] ?? "Transmissão ao Vivo - {$userLogin}";
    } else {
        // Sem transmissão ativa - mostrar "sem sinal"
        $url_source = '';
        $isLive = false;
        $title = "Sem Sinal - {$userLogin}";
    }
}

// Configurações do player
$autoplayAttr = ($autoplay === 'true') ? 'autoplay' : '';
$mutedAttr = ($muted === 'true') ? 'muted' : '';
$loopAttr = ($loop === 'true') ? 'loop' : '';

// Incluir arquivo do player baseado no tipo selecionado
switch ($player) {
    case '1':
        include 'players/videojs.php';
        break;
    case '2':
        include 'players/clappr.php';
        break;
    case '3':
        include 'players/jwplayer.php';
        break;
    case '4':
        include 'players/fluidplayer.php';
        break;
    case '5':
        include 'players/fwduvplayer.php';
        break;
    case '6':
        include 'players/prontusplayer.php';
        break;
    case '7':
        include 'players/fwduvplayer_metal.php';
        break;
    case '8':
        include 'players/radiantplayer.php';
        break;
    default:
        include 'players/html5.php';
        break;
}
?>