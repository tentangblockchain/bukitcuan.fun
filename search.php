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
$google_url = 'https://www.google.com/search?q=' . urlencode($query_raw);
$page_title = 'Mencari: ' . $query_display . ' - BukitCuan';
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    
    <title><?php echo $page_title; ?></title>
    
    <link rel="icon" type="image/png" sizes="32x32" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💰</text></svg>">
    
    <link rel="preconnect" href="https://www.google.com">
    
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0f1e 0%, #1a1f3a 100%);
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 2rem;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .container {
            text-align: center;
            max-width: 700px;
            width: 100%;
        }

        .logo {
            font-size: 3rem;
            margin-bottom: 1rem;
            animation: bounce 1s ease-in-out infinite;
            user-select: none;
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        h1 {
            background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-size: 2rem;
            margin-bottom: 1rem;
        }

        .search-query {
            font-size: 1.2rem;
            color: #e2e8f0;
            margin-bottom: 2rem;
            padding: 1.5rem 2rem;
            background: rgba(21, 27, 46, 0.6);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 16px;
            font-weight: 500;
            word-wrap: break-word;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 
                0 8px 24px rgba(0, 0, 0, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .search-query strong {
            color: #14b8a6;
            font-weight: 700;
        }

        .loading {
            font-size: 1rem;
            color: #94a3b8;
            margin-bottom: 1.5rem;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(20, 184, 166, 0.2);
            border-top-color: #14b8a6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 1.5rem auto;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .ads-container {
            margin: 2rem 0;
            padding: 2rem;
            background: rgba(21, 27, 46, 0.4);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            min-height: 250px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        }

        .ads-placeholder {
            color: #94a3b8;
            font-size: 0.9rem;
            font-style: italic;
        }

        .ads-top {
            margin-bottom: 2rem;
            min-height: 90px;
        }

        .ads-bottom {
            margin-top: 2rem;
            min-height: 250px;
        }

        .manual-link {
            margin-top: 2rem;
        }

        .manual-link a {
            display: inline-block;
            background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%);
            color: white;
            padding: 1.2rem 3rem;
            border-radius: 16px;
            text-decoration: none;
            font-weight: 700;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 
                0 8px 24px rgba(20, 184, 166, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
            letter-spacing: 0.5px;
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
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
        }

        .manual-link a:hover::before {
            left: 100%;
        }

        .manual-link a:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 
                0 16px 40px rgba(20, 184, 166, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .manual-link a:active {
            transform: translateY(-2px) scale(0.98);
        }

        .back-link {
            margin-top: 1.5rem;
        }

        .back-link a {
            color: #94a3b8;
            text-decoration: none;
            font-size: 0.9rem;
            transition: color 0.3s;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }

        .back-link a:hover {
            color: #14b8a6;
        }

        .error-message {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            margin: 1rem 0;
            font-size: 0.95rem;
        }

        @media (max-width: 768px) {
            body {
                padding: 1.5rem;
            }

            .logo {
                font-size: 2.5rem;
            }

            h1 {
                font-size: 1.75rem;
            }

            .search-query {
                font-size: 1.1rem;
                padding: 1rem;
            }

            .ads-container {
                padding: 1.5rem;
                min-height: 200px;
            }

            .ads-top {
                min-height: 70px;
            }

            .manual-link a {
                padding: 0.9rem 2rem;
                font-size: 0.95rem;
            }
        }

        @media (max-width: 480px) {
            .search-query {
                font-size: 1rem;
            }

            .ads-container {
                padding: 1rem;
                min-height: 150px;
            }

            .manual-link a {
                width: 100%;
                padding: 1rem;
            }
        }

        noscript .no-js-warning {
            background: rgba(251, 191, 36, 0.1);
            border: 1px solid rgba(251, 191, 36, 0.3);
            color: #fcd34d;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            margin: 1rem 0;
            font-size: 0.95rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo" role="img" aria-label="Money Bag">💰</div>
        <h1>BukitCuan</h1>
        
        <div class="search-query">
            Mencari: <strong><?php echo $query_display; ?></strong>
        </div>

        <div class="loading" id="loadingText">Membuka hasil pencarian...</div>
        <div class="spinner" id="spinner"></div>

        <div class="ads-container ads-top">
            <div class="ads-placeholder">
                <!-- Paste kode iklan Google AdSense (Header Ad) di sini -->
                <!-- Contoh: Horizontal Banner 728x90 atau Responsive -->
                📢 Space Iklan Header
            </div>
        </div>

        <div class="ads-container">
            <div class="ads-placeholder">
                <!-- Paste kode iklan Google AdSense (Main Ad) di sini -->
                <!-- Contoh: Large Rectangle 336x280 atau Responsive -->
                📢 Space Iklan Utama
            </div>
        </div>

        <div class="manual-link">
            <a href="<?php echo htmlspecialchars($google_url, ENT_QUOTES, 'UTF-8'); ?>" 
               target="_blank" 
               rel="noopener noreferrer"
               id="manualLink">
                Klik di sini jika tidak otomatis terbuka
            </a>
        </div>

        <div class="ads-container ads-bottom">
            <div class="ads-placeholder">
                <!-- Paste kode iklan Google AdSense (Footer Ad) di sini -->
                <!-- Contoh: Large Rectangle 336x280 atau Responsive -->
                📢 Space Iklan Footer
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
                ⚠️ JavaScript tidak aktif. Silakan <a href="<?php echo htmlspecialchars($google_url, ENT_QUOTES, 'UTF-8'); ?>" target="_blank" rel="noopener noreferrer" style="color: #fcd34d; text-decoration: underline;">klik di sini</a> untuk melanjutkan pencarian.
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
