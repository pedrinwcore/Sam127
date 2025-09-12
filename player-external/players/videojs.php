<!DOCTYPE html>
<html lang="pt-br">
<head>
    <title><?php echo htmlspecialchars($title); ?></title>
    <meta name="apple-touch-fullscreen" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <link href="//vjs.zencdn.net/7.8.4/video-js.css" rel="stylesheet">
    <script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>
    <link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/bootstrap/3.3.5/css/bootstrap.min.css">
    <link type="text/css" rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" />
    <style>
        * { margin: 0; }
        body, html { height: 100%; background: #000; }
        .video-js { height: 100% !important; }
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
        <?php if (!$isLive): ?>
        .video-js .vjs-time-control { display: block; }
        .video-js .vjs-progress-control { display: block; }
        <?php else: ?>
        .video-js .vjs-time-control { display: none; }
        .video-js .vjs-progress-control { display: none; }
        <?php endif; ?>
        .video-js .vjs-big-play-button {
            top: 50%;
            left: 50%;
            margin-left: -1.5em;
            margin-top: -1em;
            background-color: rgba(14,34,61,.7);
            font-size: 3.5em;
            border-radius: 12%;
            height: 1.4em !important;
            line-height: 1.4em !important;
            margin-top: -.7em !important;
            z-index: 999999999;
        }
        .video-js .vjs-control-bar {
            background-color: #0e223d !important;
            color: #fff;
            font-size: 14px;
            z-index: 999999999;
        }
        .vjs-watermark {
            position: absolute;
            display: inline;
            z-index: 2000;
            bottom: 0px;
        }
        .vjs-watermark img {
            width: 50%;
            height: auto;
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
        .no-signal .signal-bars {
            display: inline-block;
            margin: 20px 0;
        }
        .no-signal .bar {
            display: inline-block;
            width: 8px;
            height: 30px;
            background: #333;
            margin: 0 2px;
            animation: signal-fade 2s infinite;
        }
        .no-signal .bar:nth-child(2) { animation-delay: 0.2s; }
        .no-signal .bar:nth-child(3) { animation-delay: 0.4s; }
        .no-signal .bar:nth-child(4) { animation-delay: 0.6s; }
        .no-signal .bar:nth-child(5) { animation-delay: 0.8s; }
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
        // Recarregar página a cada 30 segundos para verificar transmissão
        setTimeout(function() { 
            location.reload(); 
        }, 30000);
    </script>
    <?php else: ?>
    <!-- Player ativo -->
    <video id="player_webtv" 
           crossorigin="anonymous" 
           class="video-js vjs-fluid vjs-default-skin" 
           <?php echo $autoplayAttr; ?> 
           <?php echo $mutedAttr; ?> 
           <?php echo $loopAttr; ?> 
           controls 
           preload="none" 
           width="100%" 
           height="100%" 
           data-setup='{ "fluid":true,"aspectRatio":"<?php echo $aspectratio; ?>" }'>
        <source src="<?php echo htmlspecialchars($url_source); ?>" type="application/x-mpegURL">
    </video>

    <script src="//vjs.zencdn.net/7.8.4/video.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/videojs-contrib-hls/5.12.0/videojs-contrib-hls.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/videojs-contrib-quality-levels/2.0.9/videojs-contrib-quality-levels.min.js"></script>
    <script src="//www.unpkg.com/videojs-hls-quality-selector@1.0.5/dist/videojs-hls-quality-selector.min.js"></script>

    <script>
        var myPlayer = videojs('player_webtv', {
            html5: {
                hls: {
                    overrideNative: true
                }
            }
        }, function() {
            var player = this;
            player.hlsQualitySelector({ 
                displayCurrentQuality: true
            });
            
            player.on("pause", function() {
                player.one("play", function() {
                    player.load();
                    player.play();
                });
            });

            // Auto-reload em caso de erro para streams ao vivo
            <?php if ($isLive): ?>
            player.on('error', function() {
                setTimeout(function() {
                    player.load();
                }, 5000);
            });
            <?php endif; ?>
        });

        <?php if ($contador === 'true'): ?>
        function contador() {
            // Simular contador para demonstração
            var count = Math.floor(Math.random() * 50) + 5;
            $("#contador_online").html(count);
        }
        contador();
        setInterval(contador, 30000);
        <?php endif; ?>

        <?php if ($compartilhamento === 'true'): ?>
        <?php echo generateSocialJS(); ?>
        <?php endif; ?>

        <?php if ($isLive): ?>
        // Recarregar página se stream parar
        setInterval(function() {
            if (myPlayer.error()) {
                location.reload();
            }
        }, 60000);
        <?php endif; ?>
    </script>
    <?php endif; ?>
</body>
</html>

<?php
// Funções auxiliares para componentes sociais
function generateSocialCSS() {
    return '
    .circle-nav-wrapper {
        position: absolute;
        z-index: 9999;
        right: 0;
        top: 0;
        width: 50px;
        height: 50px;
        overflow: hidden;
    }
    .circle-nav-wrapper .circle-nav-toggle {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        z-index: 999999;
        width: 30px;
        height: 30px;
        border: 2px solid #FFFFFF;
        right: 10px;
        top: 10px;
        cursor: pointer;
    }
    .circle-nav-wrapper .circle-nav-toggle i {
        color: #FFFFFF;
    }
    .circle-nav-wrapper .circle-nav-panel {
        background: linear-gradient(to right,#ff5f6d,#ffc371);
        width: 0;
        height: 0;
        border-radius: 50%;
        transition: width .2s, height .2s;
        margin-left: 261px;
    }
    .circle-nav-wrapper .circle-nav-panel.circle-nav-open {
        width: 500px;
        height: 500px;
        opacity: .7;
    }
    .circle-nav-wrapper .circle-nav-menu {
        width: 250px;
        height: 250px;
    }
    .circle-nav-wrapper .circle-nav-menu .circle-nav-item {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #fff;
        border-radius: 50%;
        width: 15px;
        height: 15px;
        visibility: hidden;
        transition: all .3s;
    }
    .circle-nav-wrapper .circle-nav-menu.circle-nav-open .circle-nav-item {
        width: 40px;
        height: 40px;
        visibility: visible;
        cursor: pointer;
    }
    .circle-nav-wrapper .circle-nav-menu .circle-nav-item i {
        color: #ff5f6d;
        font-size: .6em;
    }
    .circle-nav-wrapper .circle-nav-menu.circle-nav-open .circle-nav-item i {
        font-size: 1.4em;
    }
    ';
}

function generateSocialHTML() {
    $currentUrl = "https://" . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
    return '
    <nav id="circle-nav-wrapper" class="circle-nav-wrapper" data-status-botao="fechado">
        <div class="circle-nav-toggle"><i class="fa fa-plus"></i></div>
        <div class="circle-nav-panel"></div>
        <ul class="circle-nav-menu">
            <a href="https://facebook.com/sharer/sharer.php?u=' . urlencode($currentUrl) . '" target="_blank">
                <li class="circle-nav-item circle-nav-item-1"><i class="fa fa-facebook fa-2x"></i></li>
            </a>
            <a href="https://twitter.com/share?url=' . urlencode($currentUrl) . '" target="_blank">
                <li class="circle-nav-item circle-nav-item-2"><i class="fa fa-twitter fa-2x"></i></li>
            </a>
            <a href="https://pinterest.com/pin/create/bookmarklet/?url=' . urlencode($currentUrl) . '" target="_blank">
                <li class="circle-nav-item circle-nav-item-3"><i class="fa fa-pinterest fa-2x"></i></li>
            </a>
            <a href="tg://msg_url?url=' . urlencode($currentUrl) . '" target="_blank">
                <li class="circle-nav-item circle-nav-item-4"><i class="fa fa-telegram fa-2x"></i></li>
            </a>
            <a href="whatsapp://send?text=WebTV ' . urlencode($currentUrl) . '" target="_blank">
                <li class="circle-nav-item circle-nav-item-5"><i class="fa fa-whatsapp fa-2x"></i></li>
            </a>
        </ul>
    </nav>';
}

function generateSocialJS() {
    return '
    $(".circle-nav-toggle").on("click", function() {
        var wrapper = $("#circle-nav-wrapper");
        var status = wrapper.data("status-botao");
        
        if (status === "fechado") {
            wrapper.css({"width": "250px", "height": "250px"});
            $(".circle-nav-menu").addClass("circle-nav-open");
            $(".circle-nav-panel").addClass("circle-nav-open");
            wrapper.data("status-botao", "aberto");
        } else {
            wrapper.css({"width": "50px", "height": "50px"});
            $(".circle-nav-menu").removeClass("circle-nav-open");
            $(".circle-nav-panel").removeClass("circle-nav-open");
            wrapper.data("status-botao", "fechado");
        }
    });
    ';
}
?>