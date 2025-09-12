<!DOCTYPE html>
<html lang="pt-br">
<head>
    <title><?php echo htmlspecialchars($title); ?></title>
    <meta name="apple-touch-fullscreen" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>
    <script type="text/javascript" src="//cdn.jsdelivr.net/npm/clappr@latest/dist/clappr.min.js"></script>
    <script type="text/javascript" src="//cdn.jsdelivr.net/gh/clappr/clappr-level-selector-plugin@latest/dist/level-selector.min.js"></script>
    <link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/bootstrap/3.3.5/css/bootstrap.min.css">
    <link type="text/css" rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" />
    <style>
        * { margin: 0; }
        html, body { 
            height: 100%; 
            background-color: #000000; 
        }
        .icone-contador {
            position: absolute;
            left: 0;
            top: 0;
            background: rgba(255,0,0, 1.0);
            min-width: 50px;
            height: 20px;
            padding-left: 5px;
            padding-bottom: 10px;
            margin: 10px;
            border-radius: 3px;
            color: #FFFFFF;
            font-size: 14px;
            text-align: center;
            z-index: 10000;
        }
        .live-info:before { display: none !important; }
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
    <div class="icone-contador">
        <i class="fa fa-eye"></i> 
        <strong><span id="contador_online">0</span></strong>
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
    </div>
    <script>
        setTimeout(function() { location.reload(); }, 30000);
    </script>
    <?php else: ?>
    <!-- Player Clappr -->
    <div class="container-fluid">
        <div class="row">
            <div class="embed-responsive embed-responsive-<?php echo $aspectratio === '4:3' ? '4by3' : '16by9'; ?>">
                <div id="player_webtv" class="embed-responsive-item"></div>
            </div>
        </div>
    </div>

    <script>
        window.onload = function() {
            var player = new Clappr.Player({
                plugins: [LevelSelector],
                levelSelectorConfig: {
                    labelCallback: function(playbackLevel, customLabel) {
                        return playbackLevel.level.height + 'p';
                    }
                },
                source: '<?php echo htmlspecialchars($url_source); ?>',
                parentId: '#player_webtv',
                width: '100%',
                height: '100%',
                mute: <?php echo $muted === 'true' ? 'true' : 'false'; ?>,
                autoPlay: <?php echo $autoplay === 'true' ? 'true' : 'false'; ?>,
                loop: <?php echo $loop === 'true' ? 'true' : 'false'; ?>
            });

            <?php if ($contador === 'true'): ?>
            function contador() {
                var count = Math.floor(Math.random() * 50) + 5;
                $("#contador_online").html(count);
            }
            contador();
            setInterval(contador, 30000);
            <?php endif; ?>

            <?php if ($compartilhamento === 'true'): ?>
            <?php echo generateSocialJS(); ?>
            <?php endif; ?>
        };
    </script>
    <?php endif; ?>
</body>
</html>