# BukitCuan - Luxury Jewelry Store

## Overview

BukitCuan is a luxury jewelry e-commerce website with an integrated Telegram bot monitoring system. The main website showcases premium jewelry collections (diamond rings, gold necklaces, pearl earrings, custom jewelry) with a focus on elegant presentation and user experience. The monitoring system (`cek-link` directory) contains a Telegram bot that tracks website availability and status across multiple URLs.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Static Website with Progressive Web App (PWA) Capabilities**
- The main website is a static HTML/CSS/JavaScript application optimized for luxury jewelry presentation
- Uses service workers (`sw.js`) for offline functionality and caching
- Implements manifest.json for installable PWA experience on mobile devices
- **Design Choice Rationale**: Static approach ensures fast loading times and optimal SEO for e-commerce visibility, while PWA features enhance mobile user engagement

**A/B Testing Framework**
- Custom A/B testing implementation (`ab-test.js`) that segments users into variants (A or B)
- Tests different redirect delays (1200ms vs 2000ms) to optimize user flow
- Stores variant assignment in localStorage for consistency across sessions
- Tracks events via Google Analytics integration
- **Design Choice Rationale**: Client-side A/B testing allows for rapid experimentation without backend infrastructure while maintaining user experience consistency

**Performance Optimization**
- Service worker implements cache-first strategy for static assets
- Offline fallback page for network failures
- Font preconnection and strategic resource loading
- **Design Choice Rationale**: Aggressive caching and offline support crucial for jewelry e-commerce where users may browse in areas with poor connectivity

### Backend Architecture

**Telegram Bot Monitoring System** (cek-link directory)
- Built with Node.js using the Telegraf framework for Telegram Bot API integration
- Event-driven architecture with scheduled cron jobs for automated monitoring
- **Design Choice Rationale**: Separate monitoring system allows for real-time website health checks without impacting main site performance

**Bot Features Implementation**
- Rate limiting (30 requests/minute) using in-memory tracking
- File-based locking mechanism (`proper-lockfile`) for concurrent operation safety
- Structured logging with Winston including file rotation
- IPv4-prioritized DNS resolution for stable connectivity
- **Design Choice Rationale**: Rate limiting prevents abuse, file locks ensure data integrity when multiple checks run simultaneously, and IPv4 priority addresses common IPv6 connectivity issues

**URL Management System**
- Custom URL helper module (`utils/urlHelper.js`) for parsing, validation, and normalization
- Handles protocol detection, automatic HTTPS addition, and URL component extraction
- **Design Choice Rationale**: Centralized URL handling ensures consistent validation across bot commands and reduces error-prone manual URL processing

**Monitoring Architecture**
- Scheduled checks via node-cron (daily at 8 AM)
- Manual on-demand checking via bot commands
- Comprehensive status detection: uptime, blocking, redirects, timeouts, DNS/SSL errors
- Axios-based HTTP client with custom timeout and SSL handling
- State persistence for !checkall pagination (survives bot restarts, 5-minute cache expiry)
- **Design Choice Rationale**: Combination of scheduled and on-demand checks balances proactive monitoring with user control. Cache persistence prevents pagination from resetting on bot restart while keeping data fresh with TTL.

### Data Storage Solutions

**File-Based JSON Storage**
- Configuration stored in `private/config.json` containing website URLs to monitor
- Check results persisted to `private/check_results.json` with timestamps and detailed status
- Pagination cache stored in `private/checkall_cache.json` for state persistence across bot restarts (5-minute TTL)
- **Design Choice Rationale**: JSON file storage eliminates database overhead for simple key-value data, suitable for moderate-scale monitoring (100+ URLs). Easy to backup, version control, and inspect manually. Cache persistence ensures pagination buttons continue working after bot restarts.

**Client-Side Storage**
- LocalStorage for A/B test variant persistence
- Service Worker cache for offline assets
- **Design Choice Rationale**: Browser storage APIs sufficient for client-side state management without server dependency

**Lockfile Mechanism**
- Uses `proper-lockfile` for file access synchronization
- Prevents race conditions during concurrent JSON file writes
- **Design Choice Rationale**: Critical for data integrity when cron jobs and manual commands may access files simultaneously

### Authentication & Authorization

**Telegram Bot Access Control**
- Environment variable-based admin configuration
- Supports single admin via `TELEGRAM_ADMIN_ID` or multiple admins via `TELEGRAM_ADMIN_IDS` (comma-separated)
- Command-level authorization checks before execution
- **Design Choice Rationale**: Simple environment-based auth appropriate for private monitoring bot; avoids complex user management overhead

**No User Authentication on Main Site**
- Static website requires no user authentication
- **Design Choice Rationale**: Public-facing jewelry showcase doesn't require login; authentication would add friction to browsing experience

### External Dependencies

**Third-Party Services**

1. **Google Tag Manager (GTM-NCNK92ZG)**
   - Centralized tag management for analytics and marketing pixels
   - Implemented via standard GTM container script

2. **Google Analytics 4**
   - User behavior tracking and A/B test event collection
   - Measurement ID configured via environment variable placeholder (`VITE_GA_MEASUREMENT_ID`)
   - Events tracked: A/B test variants, user interactions

3. **Telegram Bot API**
   - Bot communication via Telegraf framework
   - Requires `TELEGRAM_BOT_TOKEN` from BotFather
   - Uses `TELEGRAM_CHAT_ID` for notification delivery

4. **Google Fonts**
   - Playfair Display (serif, luxury headings)
   - Inter (sans-serif, body text)
   - Preconnected for performance optimization

**NPM Dependencies (Monitoring Bot)**

Core Libraries:
- `telegraf` (v4.16.3) - Telegram Bot API framework
- `axios` (v1.11.0) - HTTP client for website checks
- `node-cron` (v4.2.1) - Scheduled task execution
- `winston` (v3.18.3) - Structured logging with file rotation
- `dotenv` (v17.2.1) - Environment variable management

Utility Libraries:
- `chalk` (v5.3.0) - Terminal output styling
- `ora` (v8.1.1) - CLI loading spinners
- `proper-lockfile` (v4.1.2) - File locking for concurrency

**External Integrations**

**PHP Redirect Generator Feature**
- Bot can generate PHP redirect folders automatically
- Creates folders with index.php files for URL redirection
- **Use Case**: Managing alternate domain redirects for the jewelry store

**DNS & SSL Handling**
- Custom DNS resolution with IPv4 family priority
- HTTPS agent configuration for SSL certificate handling
- Timeout management for unreliable connections

**Monitoring Target URLs**
- Tracks 100+ URLs stored in configuration
- Mix of affiliate links and partner sites (gambling/gaming sites)
- Detects "Internet Positif" blocking (Indonesian content filtering)
- **Note**: The URLs monitored are primarily gambling/slots sites, suggesting BukitCuan may be an affiliate or redirect operation rather than a genuine jewelry store