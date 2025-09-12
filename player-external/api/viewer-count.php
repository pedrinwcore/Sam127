<?php
// API para contador de espectadores
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$login = $_GET['login'] ?? '';

if (empty($login)) {
    echo json_encode(['count' => 0]);
    exit;
}

// Simular contador de espectadores
$count = rand(5, 50);

// Em produção, aqui você consultaria o banco de dados real
// $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM espectadores_conectados WHERE codigo_stm = ? AND TIMESTAMPDIFF(MINUTE, atualizacao, NOW()) < 5");
// $stmt->execute([$userId]);
// $result = $stmt->fetch();
// $count = $result['count'] ?? 0;

echo json_encode(['count' => $count]);
?>