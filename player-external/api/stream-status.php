<?php
// API para verificar status de transmissão
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Configurações do banco
$db_config = [
    'host' => '104.251.209.68',
    'port' => 35689,
    'user' => 'admin',
    'password' => 'Adr1an@',
    'database' => 'db_SamCast'
];

try {
    $pdo = new PDO(
        "mysql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['database']};charset=utf8mb4",
        $db_config['user'],
        $db_config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$login = $_GET['login'] ?? '';

if (empty($login)) {
    http_response_code(400);
    echo json_encode(['error' => 'Login parameter required']);
    exit;
}

try {
    // Buscar usuário
    $stmt = $pdo->prepare("
        SELECT s.codigo_cliente, s.usuario, s.email,
               COALESCE(s.usuario, SUBSTRING_INDEX(s.email, '@', 1)) as user_login
        FROM streamings s 
        WHERE (s.usuario = ? OR SUBSTRING_INDEX(s.email, '@', 1) = ?) 
        AND s.status = 1 
        LIMIT 1
    ");
    $stmt->execute([$login, $login]);
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }
    
    // Verificar transmissão ativa
    $stmt = $pdo->prepare("
        SELECT t.*, p.nome as playlist_nome
        FROM transmissoes t
        LEFT JOIN playlists p ON t.codigo_playlist = p.id
        WHERE t.codigo_stm = ? AND t.status = 'ativa'
        ORDER BY t.data_inicio DESC
        LIMIT 1
    ");
    $stmt->execute([$user['codigo_cliente']]);
    $transmission = $stmt->fetch();
    
    $response = [
        'user_login' => $user['user_login'],
        'has_active_transmission' => !!$transmission,
        'transmission_type' => $transmission ? 'playlist' : null,
        'stream_url' => null,
        'title' => null
    ];
    
    if ($transmission) {
        $userLogin = $user['user_login'];
        $response['stream_url'] = "http://samhost.wcore.com.br:1935/samhost/{$userLogin}_playlist/playlist.m3u8";
        $response['title'] = $transmission['titulo'];
        $response['playlist_name'] = $transmission['playlist_nome'];
    } else {
        // Verificar stream OBS (simulado)
        $userLogin = $user['user_login'];
        $obsStreamUrl = "http://samhost.wcore.com.br:1935/samhost/{$userLogin}_live/playlist.m3u8";
        
        // Verificar se stream está ativo
        $headers = @get_headers($obsStreamUrl, 1);
        if ($headers && strpos($headers[0], '200') !== false) {
            $response['has_active_transmission'] = true;
            $response['transmission_type'] = 'obs';
            $response['stream_url'] = $obsStreamUrl;
            $response['title'] = "Transmissão OBS - {$userLogin}";
        }
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}
?>