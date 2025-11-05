
<?php
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

$query_raw = isset($_GET['q']) ? trim(stripslashes($_GET['q'])) : '';

if (empty($query_raw)) {
    header('Location: index.html');
    exit();
}

if (strlen($query_raw) > 200) {
    header('Location: index.html');
    exit();
}

$query_display = htmlspecialchars($query_raw, ENT_QUOTES, 'UTF-8');
$google_url = 'https://www.google.com/search?q=' . urlencode($query_raw . ' jewelry perhiasan');
$page_title = 'Mencari: ' . $query_display . ' - BukitCuan';
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    
    <title><?php echo $page_title; ?></title>
    
    <link rel="icon" type="image/png" sizes="32x32" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💎</text></svg>">
    
    <link rel="preconnect" href="https://www.google.com">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    
    <script async src="https://www.googletagmanager.com/gtag/js?id=VITE_GA_MEASUREMENT_ID"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'VITE_GA_MEASUREMENT_ID', {
            'page_title': 'Search Results',
            'page_path': '/search.php'
        });
        
        gtag('event', 'search', {
            'search_term': <?php echo json_encode($query_raw, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>
        });
    </script>
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            color: #f8f8f8;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 2rem;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            position: relative;
            overflow-x: hidden;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: 
                radial-gradient(circle at 30% 40%, rgba(212, 175, 55, 0.08) 0%, transparent 50%),
                radial-gradient(circle at 70% 60%, rgba(244, 228, 193, 0.08) 0%, transparent 50%);
            animation: shimmer 8s ease-in-out infinite;
            z-index: 0;
            pointer-events: none;
        }

        @keyframes shimmer {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
        }

        .container {
            text-align: center;
            max-width: 700px;
            width: 100%;
            position: relative;
            z-index: 1;
        }

        .logo {
            font-size: 3.5rem;
            margin-bottom: 1.5rem;
            animation: rotate 6s linear infinite;
            user-select: none;
            filter: drop-shadow(0 8px 24px rgba(212, 175, 55, 0.4));
        }

        @keyframes rotate {
            0%, 100% { transform: rotate(0deg) scale(1); }
            25% { transform: rotate(5deg) scale(1.05); }
            50% { transform: rotate(0deg) scale(1); }
            75% { transform: rotate(-5deg) scale(1.05); }
        }

        h1 {
            font-family: 'Playfair Display', serif;
            background: linear-gradient(135deg, #d4af37 0%, #f4e4c1 50%, #d4af37 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-size: 2.5rem;
            margin-bottom: 1.5rem;
            letter-spacing: 2px;
        }

        .search-query {
            font-size: 1.25rem;
            color: #e2e8f0;
            margin-bottom: 2.5rem;
            padding: 2rem 2.5rem;
            background: rgba(26, 26, 26, 0.8);
            backdrop-filter: blur(30px);
            -webkit-backdrop-filter: blur(30px);
            border-radius: 20px;
            font-weight: 500;
            word-wrap: break-word;
            border: 2px solid rgba(212, 175, 55, 0.3);
            box-shadow: 
                0 12px 32px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(244, 228, 193, 0.1);
        }

        .search-query strong {
            color: #d4af37;
            font-weight: 700;
        }

        .loading {
            font-size: 1.1rem;
            color: #b8b8b8;
            margin-bottom: 2rem;
            font-family: 'Inter', sans-serif;
        }

        .spinner {
            width: 60px;
            height: 60px;
            border: 5px solid rgba(212, 175, 55, 0.2);
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 2rem auto;
            box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .ads-container {
            margin: 2.5rem 0;
            padding: 2.5rem;
            background: rgba(26, 26, 26, 0.6);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 20px;
            border: 1px solid rgba(212, 175, 55, 0.15);
            min-height: 250px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .ads-placeholder {
            color: #b8b8b8;
            font-size: 1rem;
            font-style: italic;
        }

        .ads-top {
            margin-bottom: 2.5rem;
            min-height: 90px;
        }

        .ads-bottom {
            margin-top: 2.5rem;
            min-height: 250px;
        }

        .manual-link {
            margin-top: 2.5rem;
        }

        .manual-link a {
            display: inline-block;
            background: linear-gradient(135deg, #d4af37 0%, #f4e4c1 50%, #d4af37 100%);
            color: #0a0a0a;
            padding: 1.4rem 3.5rem;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 700;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 
                0 12px 32px rgba(212, 175, 55, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.3);
            letter-spacing: 1px;
            text-transform: uppercase;
            position: relative;
            overflow: hidden;
        }

        .manual-link a::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: left 0.6s;
        }

        .manual-link a:hover::before {
            left: 100%;
        }

        .manual-link a:hover {
            transform: translateY(-5px) scale(1.03);
            box-shadow: 
                0 20px 48px rgba(212, 175, 55, 0.5),
                inset 0 1px 0 rgba(255, 255, 255, 0.4);
            filter: brightness(1.1);
        }

        .manual-link a:active {
            transform: translateY(-2px) scale(0.98);
        }

        .back-link {
            margin-top: 2rem;
        }

        .back-link a {
            color: #b8b8b8;
            text-decoration: none;
            font-size: 0.95rem;
            transition: color 0.3s;
            display: inline-flex;
            align-items: center;
            gap: 0.6rem;
        }

        .back-link a:hover {
            color: #d4af37;
        }

        @media (max-width: 768px) {
            body {
                padding: 1.5rem;
            }

            .logo {
                font-size: 3rem;
            }

            h1 {
                font-size: 2rem;
            }

            .search-query {
                font-size: 1.15rem;
                padding: 1.5rem 1.8rem;
            }

            .ads-container {
                padding: 2rem;
                min-height: 200px;
            }

            .ads-top {
                min-height: 70px;
            }

            .manual-link a {
                padding: 1.2rem 2.5rem;
                font-size: 0.95rem;
            }
        }

        @media (max-width: 480px) {
            .search-query {
                font-size: 1.05rem;
                padding: 1.2rem 1.5rem;
            }

            .ads-container {
                padding: 1.5rem;
                min-height: 150px;
            }

            .manual-link a {
                width: 100%;
                padding: 1.2rem;
            }
        }

        noscript .no-js-warning {
            background: rgba(212, 175, 55, 0.1);
            border: 2px solid rgba(212, 175, 55, 0.3);
            color: #f4e4c1;
            padding: 1.2rem 2rem;
            border-radius: 16px;
            margin: 1.5rem 0;
            font-size: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo" role="img" aria-label="Diamond">💎</div>
        <h1>BukitCuan</h1>
        
        <div class="search-query">
            Mencari: <strong><?php echo $query_display; ?></strong>
        </div>

        <div class="loading" id="loadingText">Membuka hasil pencarian perhiasan...</div>
        <div class="spinner" id="spinner"></div>

        <div class="ads-container ads-top">
            <div class="ads-placeholder">
                <!-- Paste kode iklan Google AdSense (Header Ad) di sini -->
                💎 Premium Advertising Space
            </div>
        </div>

        <div class="ads-container">
            <div class="ads-placeholder">
                <!-- Paste kode iklan Google AdSense (Main Ad) di sini -->
                💎 Luxury Advertising Space
            </div>
        </div>

        <div class="manual-link">
            <a href="<?php echo htmlspecialchars($google_url, ENT_QUOTES, 'UTF-8'); ?>" 
               target="_blank" 
               rel="noopener noreferrer"
               id="manualLink">
                Klik di sini jika tidak otomatis
            </a>
        </div>

        <div class="ads-container ads-bottom">
            <div class="ads-placeholder">
                <!-- Paste kode iklan Google AdSense (Footer Ad) di sini -->
                💎 Exclusive Advertising Space
            </div>
        </div>

        <div class="back-link">
            <a href="index.html">
                <span>←</span>
                <span>Kembali ke BukitCuan</span>
            </a>
        </div>

        <noscript>
            <div class="no-js-warning">
                ⚠️ JavaScript tidak aktif. Silakan <a href="<?php echo htmlspecialchars($google_url, ENT_QUOTES, 'UTF-8'); ?>" target="_blank" rel="noopener noreferrer" style="color: #d4af37; text-decoration: underline;">klik di sini</a> untuk melanjutkan pencarian.
            </div>
        </noscript>
    </div>

    <script src="/ab-test.js"></script>
    <script>
        (function() {
            'use strict';
            
            const googleUrl = <?php echo json_encode($google_url, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
            const abTest = new ABTest();
            const redirectDelay = abTest.getRedirectDelay();
            
            abTest.trackEvent('search_page_loaded', {
                'search_term': <?php echo json_encode($query_raw, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>
            });
            
            function openSearchResults() {
                try {
                    const opened = window.open(googleUrl, '_blank', 'noopener,noreferrer');
                    
                    if (opened) {
                        if (typeof gtag !== 'undefined') {
                            gtag('event', 'search_redirect', {
                                'event_category': 'engagement',
                                'event_label': 'auto_redirect_success'
                            });
                        }
                    } else {
                        document.getElementById('loadingText').textContent = 'Pop-up diblokir! Silakan klik tombol di bawah.';
                        document.getElementById('spinner').style.display = 'none';
                        
                        if (typeof gtag !== 'undefined') {
                            gtag('event', 'popup_blocked', {
                                'event_category': 'error',
                                'event_label': 'popup_blocker'
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error opening window:', e);
                    document.getElementById('loadingText').textContent = 'Terjadi kesalahan. Silakan klik tombol di bawah.';
                    document.getElementById('spinner').style.display = 'none';
                }
            }
            
            setTimeout(openSearchResults, redirectDelay);
            
            window.addEventListener('beforeunload', () => {
                abTest.trackEvent('page_exit', {
                    'time_on_page': Date.now() - performance.timing.navigationStart
                });
                abTest.sendBeacon();
            });
            
            document.getElementById('manualLink').addEventListener('click', function() {
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'manual_click', {
                        'event_category': 'engagement',
                        'event_label': 'manual_redirect'
                    });
                }
            });
        })();
    </script>
</body>
</html>
