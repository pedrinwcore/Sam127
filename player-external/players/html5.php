<!DOCTYPE html>
<html lang="pt-br">
<head>
    <title><?php echo htmlspecialchars($title); ?></title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="apple-touch-fullscreen" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>
    <link type="text/css" rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" />
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            background: #000; 
            overflow: hidden; 
            font-family: Arial, sans-serif;
        }
        video { 
            width: 100%; 
            height: 100vh; 
            object-fit: contain; 
        }
        .counter { 
            position: absolute; 
            top: 10px; 
            left: 10px; 
            background: rgba(255,0,0,0.8); 
            color: white; 
            padding: 5px 10px; 
            border-radius: 3px; 
            font-size: 14px; 
            z-index: 1000; 
        }
        .no-signal {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: white;
            z-index: 1000;
        }
        .no-signal h2 {
            font-size: 2em;
            margin-bottom: 20px;
        }
        .signal-bars {
            display: inline-block;
            margin: 20px 0;
        }
        .bar {
            display: inline-block;
            width: 8px;
            height: 30px;
            background: #333;
            margin: 0 2px;
            animation: signal-fade 2s infinite;
        }
        .bar:nth-child(2) { animation-delay: 0.2s; }
        .bar:nth-child(3) { animation-delay: 0.4s; }
        .bar:nth-child(4) { animation-delay: 0.6s; }
        .bar:nth-child(5) { animation-delay: 0.8s; }
        @keyframes signal-fade {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
        }
        <?php echo generateSocialCSS(); ?>
    </style>
</head>
<body>
    <?php if ($contador === 'true'): ?>
    <div class="counter">
        <i class="fa fa-eye"></i> 
        <span id="viewer-count">0</span>
    </div>
    <?php endif; ?>

    <?php if ($compartilhamento === 'true'): ?>
    <?php echo generateSocialHTML(); ?>
    <?php endif; ?>

    <?php if (empty($url_source)): ?>
    <!-- Sem sinal -->
    <div class="no-signal">
        <h2>SEM SINAL</h2>
        <div class="signal-bars">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
        </div>
        <p>Nenhuma transmissão ativa</p>
        <p style="font-size: 0.8em; opacity: 0.7;">Usuário: <?php echo htmlspecialchars($userLogin); ?></p>
        <p style="font-size: 0.7em; opacity: 0.5; margin-top: 20px;">
            Recarregando automaticamente...
        </p>
    </div>
    <script>
        // Recarregar página a cada 15 segundos
        setTimeout(function() { 
            location.reload(); 
        }, 15000);
    </script>
    <?php else: ?>
    <!-- Player ativo -->
    <video id="video" controls <?php echo $autoplayAttr; ?> <?php echo $mutedAttr; ?> <?php echo $loopAttr; ?> crossorigin="anonymous">
        <source src="<?php echo htmlspecialchars($url_source); ?>" type="application/vnd.apple.mpegurl">
        <source src="<?php echo htmlspecialchars($url_source); ?>" type="video/mp4">
    </video>
    
    <script>
        const video = document.querySelector('video');
        
        if (Hls.isSupported() && '<?php echo $url_source; ?>'.includes('.m3u8')) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: <?php echo $isLive ? 'true' : 'false'; ?>,
                debug: false
            });
            hls.loadSource('<?php echo htmlspecialchars($url_source); ?>');
            hls.attachMedia(video);
            
            hls.on(Hls.Events.ERROR, function(event, data) {
                if (data.fatal) {
                    console.error('HLS Error:', data);
                    <?php if ($isLive): ?>
                    // Recarregar em caso de erro em stream ao vivo
                    setTimeout(function() {
                        location.reload();
                    }, 5000);
                    <?php endif; ?>
                }
            });
        }
        
        <?php if ($contador === 'true'): ?>
        function updateCounter() {
            const count = Math.floor(Math.random() * 50) + 5;
            const counter = document.getElementById('viewer-count');
            if (counter) counter.textContent = count;
        }
        updateCounter();
        setInterval(updateCounter, 30000);
        <?php endif; ?>

        <?php if ($compartilhamento === 'true'): ?>
        <?php echo generateSocialJS(); ?>
        <?php endif; ?>

        <?php if ($isLive): ?>
        // Verificar se stream ainda está ativo
        setInterval(function() {
            if (video.error || video.networkState === video.NETWORK_NO_SOURCE) {
                location.reload();
            }
        }, 60000);
        <?php endif; ?>
    </script>
    <?php endif; ?>
</body>
</html>