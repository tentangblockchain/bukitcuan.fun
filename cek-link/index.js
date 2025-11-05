import { Telegraf } from 'telegraf';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import cron from 'node-cron';
import dotenv from 'dotenv';
import https from 'https';
import dns from 'dns';
import winston from 'winston';
import lockfile from 'proper-lockfile';
import urlHelper from './utils/urlHelper.js';
import chalk from 'chalk';
import ora from 'ora';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// ============ CHALK THEME CONFIGURATION ============
const theme = {
  success: chalk.bold.green,
  error: chalk.bold.red,
  warning: chalk.bold.yellow,
  info: chalk.bold.cyan,
  primary: chalk.bold.magenta,
  secondary: chalk.gray,
  highlight: chalk.bold.white.bgBlue,
  url: chalk.underline.blue,
  status: {
    up: chalk.green('✅'),
    blocked: chalk.red('🚫'),
    redirect: chalk.yellow('↗️'),
    timeout: chalk.yellow('⏰'),
    dns_error: chalk.red('🌐'),
    ssl_error: chalk.red('🔒'),
    error: chalk.red('❌')
  },
  box: {
    top: chalk.cyan('═'),
    bottom: chalk.cyan('═'),
    left: chalk.cyan('║'),
    right: chalk.cyan('║'),
    topLeft: chalk.cyan('╔'),
    topRight: chalk.cyan('╗'),
    bottomLeft: chalk.cyan('╚'),
    bottomRight: chalk.cyan('╝')
  }
};

// Gradient text helper
const gradient = (text) => {
  const colors = [chalk.cyan, chalk.blue, chalk.magenta, chalk.red];
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const colorIndex = Math.floor((i / text.length) * colors.length);
    result += colors[colorIndex](text[i]);
  }
  return result;
};

// Box border helper
const createBox = (content, width = 60) => {
  const lines = content.split('\n');
  const box = [];
  
  box.push(theme.box.topLeft + theme.box.top.repeat(width - 2) + theme.box.topRight);
  
  lines.forEach(line => {
    const padding = width - 2 - line.replace(/\u001b\[.*?m/g, '').length;
    box.push(theme.box.left + ' ' + line + ' '.repeat(padding > 0 ? padding : 0) + theme.box.right);
  });
  
  box.push(theme.box.bottomLeft + theme.box.bottom.repeat(width - 2) + theme.box.bottomRight);
  
  return box.join('\n');
};

// Banner
const showBanner = () => {
  console.log('\n');
  console.log(gradient('  ╔══════════════════════════════════════════════════════╗'));
  console.log(gradient('  ║                                                      ║'));
  console.log(gradient('  ║  ') + chalk.bold.white('🤖 TELEGRAM WEBSITE MONITOR BOT') + gradient('                ║'));
  console.log(gradient('  ║  ') + chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + gradient('  ║'));
  console.log(gradient('  ║  ') + chalk.cyan('Version: ') + chalk.white('3.0.0 ') + chalk.yellow('⚡ Powered by Hokireceh') + gradient('      ║'));
  console.log(gradient('  ║                                                      ║'));
  console.log(gradient('  ╚══════════════════════════════════════════════════════╝'));
  console.log('\n');
};
// ====================================================

// ============ STRUCTURED LOGGING SETUP ============
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}${stack ? '\n' + stack : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.printf(({ timestamp, level, message }) => {
          const icon = {
            error: '❌',
            warn: '⚠️ ',
            info: '📌',
            debug: '🔍'
          }[level] || '•';
          
          const coloredLevel = {
            error: chalk.bold.red(level.toUpperCase()),
            warn: chalk.bold.yellow(level.toUpperCase()),
            info: chalk.bold.cyan(level.toUpperCase()),
            debug: chalk.bold.gray(level.toUpperCase())
          }[level] || level;
          
          return `${chalk.gray(timestamp)} ${icon} ${coloredLevel} ${message}`;
        })
      )
    }),
    new winston.transports.File({ 
      filename: './logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: './logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Ensure logs directory exists
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

logger.info(chalk.green('Logger initialized successfully'));
// =====================================================

// ============ SECURITY & VALIDATION ============
/**
 * Sanitize user input untuk nama website/folder
 * Mencegah path traversal attacks
 */
const sanitizeName = (input) => {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: must be a non-empty string');
  }

  // Trim whitespace
  input = input.trim();

  // Check for path traversal attempts
  if (input.includes('..') || input.includes('/') || input.includes('\\')) {
    throw new Error('Invalid name: path separators not allowed');
  }

  // Check for null bytes
  if (input.includes('\0')) {
    throw new Error('Invalid name: null bytes not allowed');
  }

  // Whitelist: only alphanumeric, underscore, dash
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(input)) {
    throw new Error('Invalid name: only letters, numbers, underscore, and dash allowed');
  }

  // Length check
  if (input.length > 100) {
    throw new Error('Invalid name: maximum 100 characters');
  }

  return input;
};

/**
 * Rate limiting untuk commands
 */
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 menit
const MAX_COMMANDS_PER_WINDOW = 30; // 30 commands per menit

const checkRateLimit = (chatId) => {
  const now = Date.now();
  const userLimits = rateLimiter.get(chatId) || { count: 0, windowStart: now };

  // Reset window jika sudah lewat
  if (now - userLimits.windowStart > RATE_LIMIT_WINDOW) {
    userLimits.count = 0;
    userLimits.windowStart = now;
  }

  userLimits.count++;
  rateLimiter.set(chatId, userLimits);

  if (userLimits.count > MAX_COMMANDS_PER_WINDOW) {
    const timeLeft = Math.ceil((RATE_LIMIT_WINDOW - (now - userLimits.windowStart)) / 1000);
    throw new Error(`Rate limit exceeded. Wait ${timeLeft}s before next command.`);
  }

  return true;
};

// Cleanup rate limiter every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [chatId, limits] of rateLimiter.entries()) {
    if (now - limits.windowStart > RATE_LIMIT_WINDOW * 5) {
      rateLimiter.delete(chatId);
    }
  }
}, 5 * 60 * 1000);

logger.info('🔒 Security validation and rate limiting initialized');
// =====================================================

// Force DNS IPv4 first
dns.setDefaultResultOrder('ipv4first');

// ============ IPv4 FIX - FORCE IPv4 ONLY ============
// Configure HTTPS agent untuk IPv4 only dengan proper timeout
const httpsAgent = new https.Agent({
  family: 4,  // Force IPv4 only
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 45000,  // Socket timeout
  freeSocketTimeout: 30000
});

logger.info('🌐 Menggunakan konfigurasi IPv4-only untuk koneksi Telegram API');

// Create axios instance dengan konfigurasi unified
const axiosInstance = axios.create({
  httpsAgent: httpsAgent,
  timeout: 30000,  // Increased timeout untuk stability
  family: 4,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  validateStatus: (status) => status < 500,
  maxRedirects: 5
});

// Configure global axios defaults
axios.defaults.httpsAgent = httpsAgent;
axios.defaults.timeout = 30000;
axios.defaults.family = 4;
// =====================================================

// Configuration
const CONFIG_PATH = '../private/config.json';
const CHECK_RESULTS_PATH = '../private/check_results.json';
const REDIRECT_FOLDER_BASE = '../'; // Base directory for redirect folders

// Configure bot dengan IPv4 agent dan proper timeout
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: {
    agent: httpsAgent,
    webhookReply: false,
    apiRoot: 'https://api.telegram.org'
  },
  handlerTimeout: 60000  // 60 second timeout untuk long operations
});

// Multi-admin support: comma-separated chat IDs
const AUTHORIZED_CHAT_IDS = process.env.TELEGRAM_CHAT_ID
  .split(',')
  .map(id => id.trim())
  .filter(id => id.length > 0);

// Enhanced configuration dengan proper defaults
const CHECK_INTERVAL_HOURS = parseInt(process.env.CHECK_INTERVAL_HOURS) || 24;
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 25000;  // Increased
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 2;
const DELAY_BETWEEN_CHECKS = parseInt(process.env.DELAY_BETWEEN_CHECKS) || 3;
const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Memory management untuk cache
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 menit
const MAX_CACHE_SIZE = 1000; // Maximum items dalam cache

// Advanced uptime tracking database (in-memory)
const uptimeDatabase = new Map(); // Format: { websiteName: { checks: number, successes: number, lastCheck: timestamp, history: [] } }

// Initialize uptime tracking
const initUptimeTracking = (name) => {
  if (!uptimeDatabase.has(name)) {
    uptimeDatabase.set(name, {
      checks: 0,
      successes: 0,
      lastCheck: null,
      history: [], // Last 100 checks
      firstCheck: Date.now()
    });
  }
};

// Update uptime tracking
const updateUptimeTracking = (name, isSuccess) => {
  initUptimeTracking(name);
  const data = uptimeDatabase.get(name);
  
  data.checks++;
  if (isSuccess) data.successes++;
  data.lastCheck = Date.now();
  
  // Keep last 100 checks in history
  data.history.push({ timestamp: Date.now(), success: isSuccess });
  if (data.history.length > 100) {
    data.history.shift();
  }
  
  uptimeDatabase.set(name, data);
};

// Calculate uptime percentage
const calculateUptime = (name) => {
  const data = uptimeDatabase.get(name);
  if (!data || data.checks === 0) return 100;
  return ((data.successes / data.checks) * 100).toFixed(2);
};

// Get uptime stats
const getUptimeStats = (name) => {
  const data = uptimeDatabase.get(name);
  if (!data) return null;
  
  const uptime = calculateUptime(name);
  const totalTime = Date.now() - data.firstCheck;
  const avgResponseTime = data.history
    .filter(h => h.success)
    .reduce((sum, h) => sum + (h.responseTime || 0), 0) / Math.max(data.successes, 1);
  
  return {
    uptime: parseFloat(uptime),
    totalChecks: data.checks,
    successfulChecks: data.successes,
    failedChecks: data.checks - data.successes,
    monitoringSince: new Date(data.firstCheck).toLocaleString('id-ID'),
    lastCheck: data.lastCheck ? new Date(data.lastCheck).toLocaleString('id-ID') : 'Never',
    avgResponseTime: Math.round(avgResponseTime)
  };
};

// Enhanced cache with memory optimization
let checkAllCache = {
  results: null,
  timestamp: null,
  memoryUsage: 0,
  clear() {
    const before = process.memoryUsage().heapUsed;
    this.results = null;
    this.timestamp = null;
    if (global.gc) {
      global.gc(); // Force garbage collection jika tersedia
    }
    const after = process.memoryUsage().heapUsed;
    this.memoryUsage = before - after;
    logger.info(`💾 Cache cleared, freed ${Math.round(this.memoryUsage / 1024 / 1024)}MB`);
  }
};

// Conversation state untuk smart URL replacement
// Format: { chatId: { url: string, candidates: [{name, url, score}], timestamp: number } }
const pendingUrlChanges = new Map();
const PENDING_TIMEOUT = 5 * 60 * 1000; // 5 menit

// Clean expired pending changes
setInterval(() => {
  const now = Date.now();
  for (const [chatId, data] of pendingUrlChanges.entries()) {
    if (now - data.timestamp > PENDING_TIMEOUT) {
      pendingUrlChanges.delete(chatId);
    }
  }
}, 60000); // Check every minute

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatTimeString = () => {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' WIB';
};

// Escape Markdown special characters
const escapeMarkdown = (text) => {
  if (!text) return '';
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
};

// Use URL helper for validation (imported from utils/urlHelper.js)
const validateUrl = urlHelper.validateUrl;

// Load config dengan file locking dan improved error handling
const loadConfig = () => {
  try {
    // Pastikan folder private ada
    const privateDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
      logger.info(`📁 Created private directory: ${privateDir}`);
    }

    // Jika config tidak ada, buat file kosong dengan struktur lengkap
    if (!fs.existsSync(CONFIG_PATH)) {
      const defaultConfig = {
        websites: {},
        last_check_time: null,
        version: '1.0'
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      logger.info(`💡 Created config file: ${CONFIG_PATH}`);
    }

    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    let config;

    try {
      config = JSON.parse(raw);
    } catch (parseError) {
      // JSON parsing failed - this is critical
      logger.error(`🚨 CRITICAL: Config JSON parse failed - ${parseError.message}`);
      
      // Create backup with corrupted content
      const backupPath = `${CONFIG_PATH}.corrupt.${Date.now()}`;
      fs.copyFileSync(CONFIG_PATH, backupPath);
      logger.warn(`📁 Corrupted config backed up to: ${backupPath}`);
      
      // Throw error to surface to operator
      throw new Error(`Config file is corrupted! Backup saved to: ${backupPath}. Please restore manually or delete to recreate.`);
    }

    // Migrasi format lama ke format baru
    if (!config.websites && !config.last_check_time) {
      logger.info('🔄 Migrating old config format to new format...');
      const oldConfig = { ...config };
      config = {
        websites: oldConfig,
        last_check_time: null,
        version: '1.0'
      };
      // Note: Migration happens during sync load, save will be attempted but not awaited
      // This is acceptable since the in-memory config is already updated
      saveConfig(config).catch(err => {
        logger.error('Failed to save migrated config, will retry on next write:', err.message);
      });
    }

    // Pastikan struktur lengkap
    config.websites = config.websites || {};
    config.last_check_time = config.last_check_time || null;
    config.version = config.version || '1.0';

    return config;
  } catch (error) {
    logger.error(`❌ Error loading config: ${error.message}`, { stack: error.stack });

    // Re-throw if it's a corruption error (don't silently fail)
    if (error.message.includes('corrupted')) {
      throw error;
    }

    // For other errors, try to create default config
    const defaultConfig = {
      websites: {},
      last_check_time: null,
      version: '1.0'
    };

    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      logger.warn('🔧 Created new default config due to error');
      return defaultConfig;
    } catch (writeError) {
      logger.error(`❌ Failed to create new config: ${writeError.message}`);
      throw new Error('Cannot load or create config file. Check file permissions.');
    }
  }
};

// Enhanced save config dengan atomic write dan file locking
const saveConfig = async (config) => {
  const tempPath = `${CONFIG_PATH}.tmp`;
  let release = null;

  try {
    const privateDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }

    // Acquire lock untuk prevent concurrent writes
    try {
      release = await lockfile.lock(CONFIG_PATH, {
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 1000
        },
        stale: 10000 // Lock dianggap stale setelah 10 detik
      });
    } catch (lockError) {
      logger.warn(`⚠️ Config lock acquisition failed, proceeding without lock: ${lockError.message}`);
    }

    // Validate config structure before saving
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid config: must be an object');
    }

    if (!config.websites || typeof config.websites !== 'object') {
      throw new Error('Invalid config: websites must be an object');
    }

    // Atomic write dengan temp file
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tempPath, CONFIG_PATH);

    logger.debug(`✅ Config saved successfully (${Object.keys(config.websites).length} websites)`);
    return true;
  } catch (error) {
    logger.error(`❌ Error saving config: ${error.message}`, { stack: error.stack });

    // Cleanup temp file jika ada
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      logger.warn(`⚠️ Failed to cleanup temp file: ${cleanupError.message}`);
    }

    return false;
  } finally {
    // Release lock
    if (release) {
      try {
        await release();
      } catch (releaseError) {
        logger.warn(`⚠️ Failed to release config lock: ${releaseError.message}`);
      }
    }
  }
};

// Load check results dengan better error handling
const loadCheckResults = () => {
  try {
    const privateDir = path.dirname(CHECK_RESULTS_PATH);
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }

    if (!fs.existsSync(CHECK_RESULTS_PATH)) {
      const defaultResults = { 
        timestamp: formatTimeString(),
        version: '1.0',
        results: {}
      };
      fs.writeFileSync(CHECK_RESULTS_PATH, JSON.stringify(defaultResults, null, 2), 'utf-8');
      logger.info(`💡 File check_results dibuat: ${CHECK_RESULTS_PATH}`);
      return {};
    }

    const raw = fs.readFileSync(CHECK_RESULTS_PATH, 'utf-8');
    const data = JSON.parse(raw);

    // Return results object atau empty object
    return data.results || data || {};
  } catch (error) {
    logger.error(`❌ Error loading check results: ${error.message}`);
    return {};
  }
};

// Enhanced save check results dengan atomic write
const saveCheckResults = (results) => {
  try {
    const privateDir = path.dirname(CHECK_RESULTS_PATH);
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }

    const resultsObject = {
      timestamp: formatTimeString(),
      version: '1.0',
      total: results.length,
      results: {}
    };

    results.forEach(result => {
      resultsObject.results[result.name] = {
        status: result.status,
        statusCode: result.statusCode,
        responseTime: result.responseTime,
        timestamp: result.timestamp,
        error: result.error || null,
        url: result.url
      };
    });

    // Atomic write
    const tempPath = `${CHECK_RESULTS_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(resultsObject, null, 2), 'utf-8');
    fs.renameSync(tempPath, CHECK_RESULTS_PATH);

    return true;
  } catch (error) {
    logger.error(`❌ Error saving check results: ${error.message}`);

    // Cleanup temp file
    try {
      const tempPath = `${CHECK_RESULTS_PATH}.tmp`;
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return false;
  }
};

// Enhanced website checker dengan retry mechanism + ora spinner
const checkSingleUrl = async (url, name = null, retryCount = 0, showSpinner = true) => {
  const displayName = name || url;
  
  let spinner = null;
  if (showSpinner) {
    spinner = ora({
      text: chalk.cyan(`Checking ${chalk.bold.white(displayName)}${retryCount > 0 ? chalk.yellow(` (retry ${retryCount}/${MAX_RETRIES})`) : ''}...`),
      color: 'cyan',
      spinner: 'dots12'
    }).start();
  } else {
    logger.info(`🔍 Mengecek: ${displayName}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);
  }

  try {
    const startTime = Date.now();

    // Gunakan axios instance yang sudah dikonfigurasi
    const response = await axiosInstance.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache'
      }
    });

    const responseTime = Date.now() - startTime;
    const status = response.status;

    // Enhanced blocking detection
    const responseText = typeof response.data === 'string' ? response.data : '';
    const finalUrl = response.request?.res?.responseUrl || response.config?.url || url;
    
    // Check for redirect to blocking pages (Telkom, XL, Smartfren, Axis, etc)
    const isRedirectBlocked = finalUrl && (
      finalUrl.includes('internetpositif.id') ||
      finalUrl.includes('trustpositif.kominfo.go.id')
    );
    
    // Check for blocking keywords in response
    const isContentBlocked = responseText && (
      responseText.includes('Internet Positif') ||
      responseText.includes('Halaman ini tidak dapat diakses') ||
      responseText.includes('This page is blocked') ||
      responseText.includes('Access Denied') ||
      responseText.includes('Forbidden') ||
      responseText.includes('trustpositif') ||
      (response.status === 200 && responseText.length < 1000 && 
       responseText.toLowerCase().includes('block'))
    );
    
    const isBlocked = isRedirectBlocked || isContentBlocked;

    if (isBlocked) {
      if (spinner) {
        spinner.fail(chalk.red(`${displayName} - BLOCKED! ${chalk.gray(`(${responseTime}ms)`)}`));
      }
      
      // Determine blocking source
      let blockSource = 'Internet Positif / Blocked Content';
      if (isRedirectBlocked) {
        if (finalUrl.includes('internetpositif.id')) {
          blockSource = 'Blocked by Telkom (internetpositif.id)';
        } else if (finalUrl.includes('trustpositif')) {
          blockSource = 'Blocked by Kominfo (trustpositif)';
        }
      }
      
      return {
        url,
        name: displayName,
        status: 'blocked',
        statusCode: status,
        responseTime,
        timestamp: formatTimeString(),
        error: blockSource
      };
    }

    // Determine status
    let overallStatus;
    if (status >= 200 && status < 300) {
      overallStatus = 'up';
    } else if (status >= 300 && status < 400) {
      overallStatus = 'redirect';
    } else if (status >= 400 && status < 500) {
      overallStatus = 'client_error';
    } else {
      overallStatus = 'server_error';
    }

    if (spinner) {
      if (overallStatus === 'up') {
        spinner.succeed(chalk.green(`${displayName} - ONLINE! ${chalk.gray(`(${responseTime}ms, ${status})`)}`));
      } else if (overallStatus === 'redirect') {
        spinner.warn(chalk.yellow(`${displayName} - REDIRECT ${chalk.gray(`(${responseTime}ms, ${status})`)}`));
      } else {
        spinner.fail(chalk.red(`${displayName} - ERROR ${status} ${chalk.gray(`(${responseTime}ms)`)}`));
      }
    }

    // Update uptime tracking
    updateUptimeTracking(displayName, overallStatus === 'up');
    
    // SSL certificate check for HTTPS
    let sslInfo = null;
    if (url.startsWith('https://')) {
      try {
        const { certificate } = response.request.socket;
        if (certificate) {
          const validFrom = new Date(certificate.valid_from);
          const validTo = new Date(certificate.valid_to);
          const daysLeft = Math.ceil((validTo - Date.now()) / (1000 * 60 * 60 * 24));
          
          sslInfo = {
            valid: true,
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
            daysLeft,
            issuer: certificate.issuer?.O || 'Unknown'
          };
          
          if (daysLeft < 30) {
            logger.warn(`⚠️ SSL certificate for ${displayName} expires in ${daysLeft} days`);
          }
        }
      } catch (sslError) {
        logger.debug(`SSL info not available for ${displayName}`);
      }
    }
    
    return {
      url,
      name: displayName,
      status: overallStatus,
      statusCode: status,
      responseTime,
      timestamp: formatTimeString(),
      uptime: calculateUptime(displayName),
      sslInfo
    };

  } catch (error) {
    // Retry mechanism untuk network errors
    if (retryCount < MAX_RETRIES && shouldRetry(error)) {
      if (spinner) {
        spinner.warn(chalk.yellow(`${displayName} - Retrying (${retryCount + 1}/${MAX_RETRIES})...`));
      } else {
        logger.info(`🔄 Retrying ${displayName} (${retryCount + 1}/${MAX_RETRIES})`);
      }
      await sleep(2000 * (retryCount + 1)); // Exponential backoff
      return checkSingleUrl(url, name, retryCount + 1, showSpinner);
    }

    // Enhanced error categorization
    let errorType = 'error';
    let errorMessage = error.message;

    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      errorType = 'dns_error';
      errorMessage = 'DNS resolution failed';
    } else if (error.code === 'ECONNREFUSED') {
      errorType = 'connection_refused';
      errorMessage = 'Connection refused';
    } else if (error.code === 'ECONNRESET') {
      errorType = 'connection_reset';
      errorMessage = 'Connection reset by peer';
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      errorType = 'timeout';
      errorMessage = `Request timeout (${REQUEST_TIMEOUT}ms)`;
    } else if (error.code === 'ECONNABORTED') {
      errorType = 'timeout';
      errorMessage = 'Request aborted due to timeout';
    } else if (error.response) {
      errorType = 'http_error';
      errorMessage = `HTTP ${error.response.status} ${error.response.statusText}`;
    } else if (error.code === 'CERT_HAS_EXPIRED') {
      errorType = 'ssl_error';
      errorMessage = 'SSL certificate expired';
    } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      errorType = 'ssl_error';
      errorMessage = 'SSL certificate verification failed';
    } else if (error.code === 'ERR_SSL_PROTOCOL_ERROR' || error.message.includes('SSL protocol error')) {
      errorType = 'ssl_error';
      errorMessage = 'SSL protocol error (possible ISP blocking - Telkom/XL/Smartfren/Axis)';
    } else if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      errorType = 'ssl_error';
      errorMessage = 'Self-signed certificate detected';
    } else if (error.code === 'CERT_NOT_YET_VALID') {
      errorType = 'ssl_error';
      errorMessage = 'SSL certificate not yet valid';
    } else if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
      errorType = 'ssl_error';
      errorMessage = 'SSL certificate hostname mismatch';
    } else if (error.message.includes('TLS') || error.message.includes('SSL')) {
      errorType = 'ssl_error';
      errorMessage = `SSL/TLS error: ${error.message}`;
    }

    if (spinner) {
      spinner.fail(chalk.red(`${displayName} - ${errorType.toUpperCase()}: ${chalk.gray(errorMessage)}`));
    } else {
      logger.error(`❌ Error checking ${displayName}: ${errorMessage}`);
    }

    return {
      url,
      name: displayName,
      status: errorType,
      statusCode: error.response?.status || null,
      responseTime: null,
      timestamp: formatTimeString(),
      error: errorMessage
    };
  }
};

// Helper function untuk menentukan apakah error bisa di-retry
const shouldRetry = (error) => {
  const retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT', 
    'ECONNABORTED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNREFUSED'
  ];

  const retryableStatusCodes = [502, 503, 504, 522, 524];

  return retryableCodes.includes(error.code) || 
         (error.response && retryableStatusCodes.includes(error.response.status));
};

// Authorization middleware - Multi-admin support
const authorize = (ctx, next) => {
  const chatId = ctx.chat.id.toString();
  
  if (!AUTHORIZED_CHAT_IDS.includes(chatId)) {
    logger.warn(`🚨 Unauthorized access attempt from chat ID: ${chatId}`);
    return ctx.reply('❌ Anda tidak memiliki akses untuk menggunakan bot ini.');
  }
  
  return next();
};

// Bot commands
bot.start(authorize, (ctx) => {
  const welcomeMsg = `
🤖 *Bot Website Monitor*

Selamat datang! Bot ini dapat membantu Anda mengelola dan memantau status website.

*Command Simple (dengan !):*
• \`!add contoh_url contoh.com\`
• \`!edit contoh_url newsite.com\`  
• \`!del contoh_url\`
• \`!list\` \`!check contoh_url\` \`!checkall\`

*Auto Check:* 1x sehari untuk semua website
*Format:* Pakai \`!\` untuk semua (kecuali /start /help)
`;

  ctx.replyWithMarkdown(welcomeMsg);
});

// Handler untuk !help
const handleHelpCommand = async (ctx) => {
  const helpMsg = `
📖 *Bot Website Monitor - Complete Guide*

*🔧 Management:*
• \`!add <name> <url>\` - Tambah website
• \`!edit <name> <url>\` - Edit URL website  
• \`!del <name>\` - Hapus website
• \`!list\` - Lihat semua website

*📊 Monitoring:*
• \`!check <name>\` - Cek status 1 website
• \`!checkall\` - Cek semua website
• \`!stats\` - Overall statistics
• \`!stats <name>\` - Detailed stats untuk website

*📁 Advanced:*
• \`!createphp <name>\` - Buat PHP redirect
• \`!export json\` - Export data ke JSON
• \`!export csv\` - Export data ke CSV

*🤖 Features:*
✅ Auto daily check @ 8 AM
✅ Uptime tracking & SSL monitoring
✅ Smart URL replacement
✅ Rate limiting protection
✅ Real-time notifications

*📱 Smart Mode:*
Kirim URL langsung → Bot deteksi & tawarkan opsi
`;

  ctx.replyWithMarkdown(helpMsg);
};

bot.help(authorize, async (ctx) => {
  await handleHelpCommand(ctx);
});

// Redirect old commands
bot.command('add', (ctx) => ctx.reply('Gunakan !add sebagai gantinya'));
bot.command('edit', (ctx) => ctx.reply('Gunakan !edit sebagai gantinya')); 
bot.command('delete', (ctx) => ctx.reply('Gunakan !del sebagai gantinya'));
bot.command('list', (ctx) => ctx.reply('Gunakan !list sebagai gantinya'));
bot.command('check', (ctx) => ctx.reply('Gunakan !check sebagai gantinya'));
bot.command('checkall', (ctx) => ctx.reply('Gunakan !checkall sebagai gantinya'));

// Helper function to check if PHP redirect folder and file exist
const checkPhpRedirectExists = (siteName) => {
  const folderPath = path.join(REDIRECT_FOLDER_BASE, siteName);
  const filePath = path.join(folderPath, 'index.php');
  const exists = fs.existsSync(folderPath) && fs.existsSync(filePath);
  return { exists, folderPath, filePath };
};

// Handler for !createphp command
const handleCreatePhpRedirect = async (ctx, commandText) => {
  try {
    // Check rate limit
    checkRateLimit(ctx.chat.id);

    const args = commandText.split(' ').slice(1);

    if (args.length === 0) {
      return ctx.reply('❌ Format salah!\nGunakan: !createphp <nama_website>\nContoh: !createphp maniaslot_url');
    }

    const name = args[0];
    
    // SECURITY: Sanitize input untuk mencegah path traversal
    let sanitizedName;
    try {
      sanitizedName = sanitizeName(name);
    } catch (sanitizeError) {
      logger.warn(`🚨 Security: Invalid name rejected - "${name}" from chat ${ctx.chat.id}: ${sanitizeError.message}`);
      return ctx.reply(`❌ ${sanitizeError.message}\n\n💡 Gunakan hanya huruf, angka, underscore (_), dan dash (-)`);
    }

    const cleanName = sanitizedName.replace(/_url$/i, '').replace(/-url$/i, '').replace(/url$/i, '');
    const folderPath = path.join(REDIRECT_FOLDER_BASE, cleanName);
    const filePath = path.join(folderPath, 'index.php');

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      logger.info(`📁 Folder created: ${folderPath}`);
    }

    const config = loadConfig();
    const websiteUrl = config.websites[sanitizedName] || 'https://t.me/cs_hokirecehbot';

    if (!fs.existsSync(filePath)) {
      const phpContent = `<?php
try {
    $path_to_config = __DIR__ . '/../private/config.json';
    if (!file_exists($path_to_config)) {
        header("Location: https://t.me/cs_hokirecehbot");
        exit;
    }

    $json = file_get_contents($path_to_config);
    $config = json_decode($json, true);
    if ($config === null) {
        throw new Exception("Gagal mem-parsing config.json.");
    }

    foreach ($config['websites'] as $key => $url) {
        if ($key === '${sanitizedName}') {
            header("Location: " . $url);
            exit;
        }
    }

    throw new Exception("URL tidak ditemukan untuk key: ${sanitizedName}");

} catch (Exception $e) {
    header("Location: https://t.me/cs_hokirecehbot");
    exit;
}
?>`;
      fs.writeFileSync(filePath, phpContent.replace(/\${sanitizedName}/g, sanitizedName), 'utf-8');
      logger.info(`📄 File created: ${filePath}`);
    }

    const successMsg = `✅ PHP Redirect berhasil dibuat!

📁 Folder: \`${cleanName}/\`
📄 File: \`${cleanName}/index.php\`
🔗 URL: \`${websiteUrl}\`

💡 Akses via: https://bukitcuan.fun/${cleanName}/`;

    ctx.replyWithMarkdown(successMsg);
    logger.info(`✅ PHP redirect created for ${sanitizedName} by chat ${ctx.chat.id}`);

  } catch (error) {
    logger.error(`❌ Error creating PHP redirect for ${name}: ${error.message}`, { stack: error.stack });
    
    // Send user-friendly error message
    if (error.message.includes('Rate limit')) {
      return ctx.reply(`⏱️ ${error.message}`);
    }
    
    ctx.reply(`❌ Gagal membuat PHP redirect untuk "${name}": ${error.message}`);
  }
};

// Handler untuk !add
const handleAddCommand = async (ctx, commandText) => {
  try {
    // Check rate limit
    checkRateLimit(ctx.chat.id);

    const args = commandText.split(' ').slice(1);

    if (args.length < 2) {
      return ctx.reply('❌ Format salah!\nGunakan: !add <nama> <url>\nContoh: !add binance_url binance.com\n\n💡 URL dengan query parameters akan disimpan lengkap:\n   !add site1 example.com?ref=abc123');
    }

    const name = args[0];
    const inputUrl = args.slice(1).join(' ');

    // SECURITY: Sanitize nama website
    let sanitizedName;
    try {
      sanitizedName = sanitizeName(name);
    } catch (sanitizeError) {
      logger.warn(`🚨 Security: Invalid name rejected - "${name}" from chat ${ctx.chat.id}: ${sanitizeError.message}`);
      return ctx.reply(`❌ ${sanitizeError.message}\n\n💡 Gunakan hanya huruf, angka, underscore (_), dan dash (-)`);
    }

    // Validasi dan normalisasi URL
    const url = validateUrl(inputUrl);
    if (!url) {
      return ctx.reply('❌ URL tidak valid!\nContoh: binance.com atau https://binance.com?ref=abc');
    }

    const config = loadConfig();

    // Cek apakah nama sudah ada
    if (config.websites[sanitizedName]) {
      // Check PHP redirect status
      const phpCheck = checkPhpRedirectExists(sanitizedName);

      if (!phpCheck.exists) {
        // Website exists in config but no PHP redirect folder/file
        const cleanName = sanitizedName.replace(/_url$/i, '').replace(/-url$/i, '').replace(/url$/i, '');
        return ctx.replyWithMarkdown(`⚠️ Website "${escapeMarkdown(sanitizedName)}" sudah ada di config!\n\n📁 *PHP Redirect: BELUM ADA*\n📂 Folder: \`${cleanName}/\`\n📄 File: \`${cleanName}/index.php\`\n\n💡 *Pilihan:*\n• Gunakan \`!createphp ${sanitizedName}\` untuk membuat folder & file PHP redirect\n• Gunakan \`!edit ${sanitizedName} <url\\_baru>\` untuk mengubah URL\n• Gunakan \`!del ${sanitizedName}\` untuk menghapus dan tambah ulang dengan nama lain`);
      } else {
        // Website exists in config AND PHP redirect exists
        const cleanName = sanitizedName.replace(/_url$/i, '').replace(/-url$/i, '').replace(/url$/i, '');
        return ctx.replyWithMarkdown(`✅ Website "${escapeMarkdown(sanitizedName)}" sudah lengkap!\n\n📁 *Config:* ✅ Ada\n📂 *Folder:* \`${cleanName}/\` ✅ Ada\n📄 *File:* \`${cleanName}/index.php\` ✅ Ada\n\n💡 *Pilihan:*\n• Gunakan \`!edit ${sanitizedName} <url\\_baru>\` untuk mengubah URL\n• Gunakan \`!list\` untuk melihat semua website`);
      }
    }

    // Cek duplicate URL (full match)
    const duplicateName = urlHelper.findDuplicateUrl(config.websites, url);
    if (duplicateName) {
      return ctx.reply(`⚠️ URL ini sudah ada dengan nama "${duplicateName}"!\n\n💡 Jika Anda ingin memantau URL yang sama dengan parameter berbeda, pastikan URL yang Anda masukkan berbeda.`);
    }

    // Check jika ada URL dengan base yang sama tapi query berbeda (warning saja)
    let similarWarning = '';
    for (const [existingName, existingUrl] of Object.entries(config.websites)) {
      if (urlHelper.isSameBaseUrl(url, existingUrl) && url !== existingUrl) {
        const existingParsed = urlHelper.parseUrl(existingUrl);
        const newParsed = urlHelper.parseUrl(url);
        similarWarning = `\n\n⚠️ Perhatian: Domain yang sama sudah ada dengan nama "${existingName}"\n• Existing: ${urlHelper.truncateUrl(existingUrl, 50)}\n• New: ${urlHelper.truncateUrl(url, 50)}\n${newParsed.search ? '✓ URL baru memiliki query parameters yang berbeda' : ''}`;
        break;
      }
    }

    // Check PHP redirect BEFORE adding to config
    const phpRedirectCheck = checkPhpRedirectExists(sanitizedName);

    // Tambah website baru
    config.websites[sanitizedName] = url;
    if (await saveConfig(config)) {
      const parsedUrl = urlHelper.parseUrl(url);

      // Build PHP redirect message based on check result
      let phpMessage = '';

      if (!phpRedirectCheck.exists) {
        phpMessage = `\n\n📁 *PHP Redirect:*\n⚠️ Folder redirect belum ada!\n📂 Path: \`${phpRedirectCheck.folderPath}/\`\n📄 File: \`${phpRedirectCheck.filePath}\`\n\n💡 *Saran:* Gunakan \`!createphp ${sanitizedName}\` untuk membuat folder & file PHP redirect otomatis`;
      } else {
        phpMessage = `\n\n📁 *PHP Redirect:*\n✅ Folder & file sudah ada!\n📂 \`${phpRedirectCheck.folderPath}/\`\n📄 \`${phpRedirectCheck.filePath}\``;
      }

      const successMsg = `✅ Website berhasil ditambahkan!

📝 *Detail:*
• Nama: \`${sanitizedName}\`
• Domain: \`${parsedUrl.hostname}\`
• URL Lengkap: \`${urlHelper.truncateUrl(url, 60)}\`
${parsedUrl.search ? `• Query Params: \`${parsedUrl.search}\`` : ''}
• Total website: ${Object.keys(config.websites).length}${phpMessage}

💡 Website akan dipantau otomatis sesuai interval yang ditentukan.${similarWarning}`;

      ctx.replyWithMarkdown(successMsg);
      logger.info(`✅ Website added: ${sanitizedName} -> ${url} by chat ${ctx.chat.id}`);

      // Log PHP redirect status
      if (!phpRedirectCheck.exists) {
        logger.warn(`⚠️ PHP redirect folder missing for: ${sanitizedName}`);
      }
    } else {
      throw new Error('Gagal menyimpan konfigurasi');
    }

  } catch (error) {
    logger.error(`❌ Error adding website: ${error.message}`, { stack: error.stack });
    
    // Send user-friendly error message
    if (error.message.includes('Rate limit')) {
      return ctx.reply(`⏱️ ${error.message}`);
    }
    
    ctx.reply(`❌ Gagal menambahkan website: ${error.message}`);
  }
};

// Handler untuk !list dengan enhanced pagination
const handleListCommand = async (ctx, page = 1) => {
  try {
    const config = loadConfig();
    const websites = Object.entries(config.websites);

    if (websites.length === 0) {
      return ctx.reply('📝 Belum ada website yang dipantau.\nGunakan !add untuk menambahkan website pertama.');
    }

    const itemsPerPage = 10;
    const totalPages = Math.ceil(websites.length / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = websites.slice(startIndex, endIndex);

    let listMsg = `📋 *Daftar Website (${websites.length})*\n\n`;

    currentItems.forEach(([name, url], index) => {
      const globalIndex = startIndex + index + 1;
      // Truncate URL jika terlalu panjang
      const displayUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
      listMsg += `${globalIndex}. \`${name}\`\n   \`${displayUrl}\`\n\n`;
    });

    listMsg += `💡 Gunakan \`!check\` <nama> untuk mengecek status tertentu`;

    // Create inline keyboard
    const keyboard = [];
    const navigationRow = [];

    if (currentPage > 1) {
      navigationRow.push({
        text: '⬅️ Sebelumnya',
        callback_data: `list_page_${currentPage - 1}`
      });
    }

    navigationRow.push({
      text: `${currentPage}/${totalPages}`,
      callback_data: 'page_info'
    });

    if (currentPage < totalPages) {
      navigationRow.push({
        text: 'Selanjutnya ➡️',
        callback_data: `list_page_${currentPage + 1}`
      });
    }

    if (navigationRow.length > 0) {
      keyboard.push(navigationRow);
    }

    const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

    ctx.replyWithMarkdown(listMsg, { reply_markup: replyMarkup });

  } catch (error) {
    logger.error(`❌ Error listing websites: ${error.message}`);
    ctx.reply(`❌ Gagal menampilkan daftar: ${error.message}`);
  }
};

// Handler untuk !edit
const handleEditCommand = async (ctx, commandText) => {
  try {
    // Check rate limit
    checkRateLimit(ctx.chat.id);

    const args = commandText.split(' ').slice(1);

    if (args.length < 2) {
      return ctx.reply('❌ Format salah!\nGunakan: !edit <nama> <url_baru>\nContoh: !edit indosuper_url https://indosuper.com/\n\n💡 Tips:\n• Hanya ganti domain: !edit site1 newdomain.com (query params lama akan dipertahankan)\n• Ganti full URL: !edit site1 newdomain.com?ref=new123');
    }

    const name = args[0];
    const inputUrl = args.slice(1).join(' ');

    // SECURITY: Sanitize nama website
    let sanitizedName;
    try {
      sanitizedName = sanitizeName(name);
    } catch (sanitizeError) {
      logger.warn(`🚨 Security: Invalid name rejected - "${name}" from chat ${ctx.chat.id}: ${sanitizeError.message}`);
      return ctx.reply(`❌ ${sanitizeError.message}\n\n💡 Gunakan hanya huruf, angka, underscore (_), dan dash (-)`);
    }

    // Validasi dan normalisasi URL
    const newUrl = validateUrl(inputUrl);
    if (!newUrl) {
      return ctx.reply('❌ URL tidak valid!\nContoh: indosuper.com atau https://indosuper.com/');
    }

    const config = loadConfig();

    // Cek apakah website ada
    if (!config.websites[sanitizedName]) {
      return ctx.reply(`❌ Website "${sanitizedName}" tidak ditemukan!\nGunakan !list untuk melihat website yang tersedia.`);
    }

    const oldUrl = config.websites[sanitizedName];

    // Use URL helper untuk merge URL dengan query parameter preservation
    const finalUrl = urlHelper.mergeUrlPreservingQuery(oldUrl, newUrl) || newUrl;

    // Check duplicate dengan website lain (kecuali yang sedang diedit)
    const duplicateName = urlHelper.findDuplicateUrl(config.websites, finalUrl, sanitizedName);
    if (duplicateName) {
      return ctx.reply(`⚠️ URL baru bentrok dengan website "${duplicateName}"!\n\n💡 Pilih URL yang berbeda atau hapus website "${duplicateName}" terlebih dahulu.`);
    }

    const oldParsed = urlHelper.parseUrl(oldUrl);
    const newParsed = urlHelper.parseUrl(newUrl);
    const finalParsed = urlHelper.parseUrl(finalUrl);

    // Safety check untuk legacy malformed URLs
    if (!oldParsed || !newParsed || !finalParsed) {
      logger.error(`⚠️ URL parsing failed: old=${oldUrl}, new=${newUrl}, final=${finalUrl}`);
      return ctx.reply('❌ Terjadi kesalahan parsing URL. Silakan gunakan !del dan !add ulang untuk website ini.');
    }

    config.websites[sanitizedName] = finalUrl;

    if (await saveConfig(config)) {
      let changeNote = '';
      if (finalUrl !== newUrl) {
        changeNote = `\n\n✨ *Query parameters otomatis dipertahankan:*\n• Input: \`${urlHelper.truncateUrl(newUrl, 50)}\`\n• Tersimpan: \`${urlHelper.truncateUrl(finalUrl, 50)}\``;
      } else if (newParsed.search && oldParsed.search && newParsed.search !== oldParsed.search) {
        changeNote = `\n\n✨ *Query parameters diperbarui:*\n• Lama: \`${oldParsed.search}\`\n• Baru: \`${newParsed.search}\``;
      } else if (newParsed.search && !oldParsed.search) {
        changeNote = `\n\n✨ *Query parameters ditambahkan:*\n• \`${newParsed.search}\``;
      }

      const successMsg = `✅ Website berhasil diperbarui!

📝 *Detail:*
• Nama: \`${sanitizedName}\`
• Domain Lama: \`${oldParsed.hostname}\`
• Domain Baru: \`${finalParsed.hostname}\`${changeNote}

💡 Perubahan akan diterapkan pada pengecekan berikutnya.`;

      ctx.replyWithMarkdown(successMsg);
      logger.info(`✅ Website updated: ${sanitizedName} -> ${finalUrl} by chat ${ctx.chat.id}`);
    } else {
      throw new Error('Gagal menyimpan konfigurasi');
    }

  } catch (error) {
    logger.error(`❌ Error editing website: ${error.message}`, { stack: error.stack });
    
    // Send user-friendly error message
    if (error.message.includes('Rate limit')) {
      return ctx.reply(`⏱️ ${error.message}`);
    }
    
    ctx.reply(`❌ Gagal memperbarui website: ${error.message}`);
  }
};

// Handler untuk !del
const handleDeleteCommand = async (ctx, commandText) => {
  try {
    // Check rate limit
    checkRateLimit(ctx.chat.id);

    const args = commandText.split(' ').slice(1);

    if (args.length === 0) {
      return ctx.reply('❌ Format salah!\nGunakan: !del <nama>\nContoh: !del contoh_url');
    }

    const name = args[0];

    // SECURITY: Sanitize nama website
    let sanitizedName;
    try {
      sanitizedName = sanitizeName(name);
    } catch (sanitizeError) {
      logger.warn(`🚨 Security: Invalid name rejected - "${name}" from chat ${ctx.chat.id}: ${sanitizeError.message}`);
      return ctx.reply(`❌ ${sanitizeError.message}\n\n💡 Gunakan hanya huruf, angka, underscore (_), dan dash (-)`);
    }

    const config = loadConfig();

    // Cek apakah website ada
    if (!config.websites[sanitizedName]) {
      return ctx.reply(`❌ Website "${sanitizedName}" tidak ditemukan!\nGunakan !list untuk melihat website yang tersedia.`);
    }

    const deletedUrl = config.websites[sanitizedName];
    delete config.websites[sanitizedName];

    if (await saveConfig(config)) {
      const successMsg = `✅ Website berhasil dihapus!

📝 *Detail:*
• Nama: \`${sanitizedName}\`
• URL: \`${deletedUrl}\`
• Sisa website: ${Object.keys(config.websites).length}

💡 Website tidak akan dipantau lagi.`;

      ctx.replyWithMarkdown(successMsg);
      logger.info(`✅ Website deleted: ${sanitizedName} (${deletedUrl}) by chat ${ctx.chat.id}`);
    } else {
      throw new Error('Gagal menyimpan konfigurasi');
    }

  } catch (error) {
    logger.error(`❌ Error deleting website: ${error.message}`, { stack: error.stack });
    
    // Send user-friendly error message
    if (error.message.includes('Rate limit')) {
      return ctx.reply(`⏱️ ${error.message}`);
    }
    
    ctx.reply(`❌ Gagal menghapus website: ${error.message}`);
  }
};

// Handler untuk !stats - Show uptime statistics
const handleStatsCommand = async (ctx, commandText) => {
  try {
    const args = commandText.split(' ').slice(1);
    const config = loadConfig();
    
    if (args.length === 0) {
      // Show overall stats
      const websites = Object.keys(config.websites);
      
      if (websites.length === 0) {
        return ctx.reply('📝 Belum ada website yang dipantau.');
      }
      
      let totalUptime = 0;
      let totalChecks = 0;
      let totalSuccess = 0;
      let monitoredCount = 0;
      
      for (const name of websites) {
        const stats = getUptimeStats(name);
        if (stats) {
          totalUptime += stats.uptime;
          totalChecks += stats.totalChecks;
          totalSuccess += stats.successfulChecks;
          monitoredCount++;
        }
      }
      
      const avgUptime = monitoredCount > 0 ? (totalUptime / monitoredCount).toFixed(2) : 0;
      
      let statsMsg = `📊 *Overall Statistics*\n\n`;
      statsMsg += `🌐 Total Websites: ${websites.length}\n`;
      statsMsg += `📈 Monitored: ${monitoredCount}\n`;
      statsMsg += `✅ Average Uptime: ${avgUptime}%\n`;
      statsMsg += `🔍 Total Checks: ${totalChecks}\n`;
      statsMsg += `✔️ Successful: ${totalSuccess}\n`;
      statsMsg += `❌ Failed: ${totalChecks - totalSuccess}\n\n`;
      statsMsg += `💡 Use \`!stats <name>\` for detailed website stats`;
      
      return ctx.replyWithMarkdown(statsMsg);
    }
    
    // Show specific website stats
    const name = args[0];
    
    if (!config.websites[name]) {
      return ctx.reply(`❌ Website "${name}" tidak ditemukan!`);
    }
    
    const stats = getUptimeStats(name);
    
    if (!stats) {
      return ctx.reply(`📊 Belum ada data untuk "${name}".\nLakukan !check ${name} untuk mulai monitoring.`);
    }
    
    let detailMsg = `📊 *Statistics: ${name}*\n\n`;
    detailMsg += `✅ *Uptime:* ${stats.uptime}%\n`;
    detailMsg += `🔍 *Total Checks:* ${stats.totalChecks}\n`;
    detailMsg += `✔️ *Successful:* ${stats.successfulChecks}\n`;
    detailMsg += `❌ *Failed:* ${stats.failedChecks}\n`;
    detailMsg += `⚡ *Avg Response:* ${stats.avgResponseTime}ms\n`;
    detailMsg += `📅 *Monitoring Since:* ${stats.monitoringSince}\n`;
    detailMsg += `🕐 *Last Check:* ${stats.lastCheck}\n\n`;
    detailMsg += `📱 *URL:* \`${config.websites[name]}\``;
    
    ctx.replyWithMarkdown(detailMsg);
    
  } catch (error) {
    logger.error(`❌ Error showing stats: ${error.message}`);
    ctx.reply(`❌ Gagal menampilkan statistik: ${error.message}`);
  }
};

// Handler untuk !export - Export data to JSON/CSV
const handleExportCommand = async (ctx, commandText) => {
  try {
    const args = commandText.split(' ').slice(1);
    const format = args[0] || 'json';
    
    if (!['json', 'csv'].includes(format.toLowerCase())) {
      return ctx.reply('❌ Format tidak valid!\nGunakan: !export json atau !export csv');
    }
    
    const config = loadConfig();
    const exportData = {
      timestamp: formatTimeString(),
      websites: [],
      summary: {
        total: Object.keys(config.websites).length,
        monitored: 0,
        avgUptime: 0
      }
    };
    
    let totalUptime = 0;
    let monitoredCount = 0;
    
    for (const [name, url] of Object.entries(config.websites)) {
      const stats = getUptimeStats(name);
      
      if (stats) {
        exportData.websites.push({
          name,
          url,
          uptime: stats.uptime,
          totalChecks: stats.totalChecks,
          successfulChecks: stats.successfulChecks,
          failedChecks: stats.failedChecks,
          avgResponseTime: stats.avgResponseTime,
          monitoringSince: stats.monitoringSince,
          lastCheck: stats.lastCheck
        });
        
        totalUptime += stats.uptime;
        monitoredCount++;
      } else {
        exportData.websites.push({
          name,
          url,
          uptime: null,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
          avgResponseTime: null,
          monitoringSince: null,
          lastCheck: 'Never'
        });
      }
    }
    
    exportData.summary.monitored = monitoredCount;
    exportData.summary.avgUptime = monitoredCount > 0 ? (totalUptime / monitoredCount).toFixed(2) : 0;
    
    if (format.toLowerCase() === 'json') {
      const filename = `export_${Date.now()}.json`;
      const filepath = path.join('./logs', filename);
      
      fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf-8');
      
      ctx.reply(`✅ Data exported to JSON!\n📁 File: ${filename}\n💾 Location: ./logs/`);
      logger.info(`📤 Data exported to ${filepath}`);
    } else {
      // CSV format
      const filename = `export_${Date.now()}.csv`;
      const filepath = path.join('./logs', filename);
      
      let csv = 'Name,URL,Uptime %,Total Checks,Successful,Failed,Avg Response (ms),Monitoring Since,Last Check\n';
      
      exportData.websites.forEach(site => {
        csv += `"${site.name}","${site.url}",${site.uptime || 'N/A'},${site.totalChecks},${site.successfulChecks},${site.failedChecks},${site.avgResponseTime || 'N/A'},"${site.monitoringSince || 'N/A'}","${site.lastCheck}"\n`;
      });
      
      fs.writeFileSync(filepath, csv, 'utf-8');
      
      ctx.reply(`✅ Data exported to CSV!\n📁 File: ${filename}\n💾 Location: ./logs/`);
      logger.info(`📤 Data exported to ${filepath}`);
    }
    
  } catch (error) {
    logger.error(`❌ Error exporting data: ${error.message}`);
    ctx.reply(`❌ Gagal export data: ${error.message}`);
  }
};

// Enhanced !check handler
const handleCheckCommand = async (ctx, commandText) => {
  const args = commandText.split(' ').slice(1);

  if (args.length === 0) {
    return ctx.reply('❌ Format salah!\nGunakan: \`!check\` <nama>\nContoh: !check binance_url');
  }

  const name = args[0];

  try {
    const config = loadConfig();

    if (!config.websites[name]) {
      return ctx.reply(`❌ Website "${name}" tidak ditemukan!\nGunakan !list untuk melihat website yang tersedia.`);
    }

    const url = config.websites[name];
    const loadingMsg = await ctx.reply(`🔍 Mengecek ${name}...\n⏳ Timeout: ${REQUEST_TIMEOUT/1000}s`);

    const result = await checkSingleUrl(url, name);

    let statusEmoji, statusText;
    switch (result.status) {
      case 'up':
        statusEmoji = '✅';
        statusText = 'ONLINE';
        break;
      case 'blocked':
        statusEmoji = '🚫';
        statusText = 'BLOCKED';
        break;
      case 'redirect':
        statusEmoji = '↗️';
        statusText = 'REDIRECT';
        break;
      case 'timeout':
        statusEmoji = '⏰';
        statusText = 'TIMEOUT';
        break;
      case 'dns_error':
        statusEmoji = '🌐';
        statusText = 'DNS ERROR';
        break;
      case 'ssl_error':
        statusEmoji = '🔒';
        statusText = 'SSL ERROR';
        break;
      default:
        statusEmoji = '❌';
        statusText = 'OFFLINE';
    }

    const statusMsg = `${statusEmoji} \`!edit ${result.name}\`

📊 *Status:* ${statusText} (${result.statusCode || 'N/A'})
📱 *URL:* \`${result.url}\`
⏱️ *Response Time:* ${result.responseTime ? result.responseTime + 'ms' : 'N/A'}
📅 *Checked:* ${result.timestamp}
${result.error ? `⚠️ *Error:* ${result.error}` : ''}`;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      statusMsg,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    logger.error(`❌ Error checking website: ${error.message}`);
    ctx.reply(`❌ Gagal mengecek website: ${error.message}`);
  }
};

// Optimized !checkall handler dengan better memory management
const handleCheckAllCommand = async (ctx, page = 1, forceRecheck = false) => {
  try {
    const config = loadConfig();
    const websites = Object.entries(config.websites);

    if (websites.length === 0) {
      return ctx.reply('📝 Belum ada website yang dipantau.\nGunakan !add untuk menambahkan website.');
    }

    const itemsPerPage = 10;
    const totalPages = Math.ceil(websites.length / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));

    // Check cache validity
    const now = Date.now();
    const needsRecheck = forceRecheck || 
                        !checkAllCache.results || 
                        !checkAllCache.timestamp || 
                        (now - checkAllCache.timestamp) > CACHE_EXPIRY ||
                        checkAllCache.results.length !== websites.length;

    let results = [];

    if (needsRecheck) {
      // Clear old cache
      checkAllCache.clear();

      let loadingMsg;
      try {
        loadingMsg = await ctx.reply(`🔍 Mengecek ${websites.length} website...\n⏳ Estimasi: ${Math.ceil(websites.length * (DELAY_BETWEEN_CHECKS + 3))} detik\n🛡️ Timeout per site: ${REQUEST_TIMEOUT/1000}s\n\n💾 Progress tersimpan real-time...`);
      } catch (error) {
        logger.error('❌ Error sending loading message:', error.message);
        loadingMsg = null;
      }

      console.log('\n' + createBox(
        chalk.bold.cyan('MASS WEBSITE CHECK STARTED') + '\n' +
        chalk.gray(`Total websites: ${websites.length}`) + '\n' +
        chalk.gray(`Estimated time: ${Math.ceil(websites.length * (DELAY_BETWEEN_CHECKS + 3))}s`),
        60
      ));
      console.log('');

      let checkedCount = 0;
      const batchSize = 5;
      let stats = { up: 0, blocked: 0, timeout: 0, error: 0 };

      // Main progress spinner
      const mainSpinner = ora({
        text: chalk.cyan(`Processing websites... ${chalk.bold.white('0')}/${websites.length}`),
        color: 'cyan',
        spinner: 'bouncingBar'
      }).start();

      // Process websites dalam batch
      for (let i = 0; i < websites.length; i += batchSize) {
        const batch = websites.slice(i, i + batchSize);

        for (const [name, url] of batch) {
          try {
            mainSpinner.text = chalk.cyan(`Checking: ${chalk.bold.white(name)} ${chalk.gray(`[${checkedCount + 1}/${websites.length}]`)}... ${chalk.yellow(Math.round((checkedCount/websites.length)*100) + '%')}`);
            
            const result = await checkSingleUrl(url, name, 0, false);
            results.push(result);
            checkedCount++;

            // Update stats
            if (result.status === 'up') stats.up++;
            else if (result.status === 'blocked') stats.blocked++;
            else if (result.status === 'timeout') stats.timeout++;
            else stats.error++;

            // Show colored result
            const statusIcon = theme.status[result.status] || '❌';
            const statusColor = result.status === 'up' ? chalk.green : 
                               result.status === 'blocked' ? chalk.red :
                               result.status === 'timeout' ? chalk.yellow : chalk.red;
            
            console.log(`  ${statusIcon} ${statusColor(name.padEnd(25))} ${chalk.gray(result.responseTime ? `${result.responseTime}ms` : 'N/A')} ${chalk.gray(result.statusCode || '')}`);


// Update Telegram progress
            if (loadingMsg && checkedCount % 25 === 0) {
              try {
                const progress = Math.round(checkedCount/websites.length*100);
                await ctx.telegram.editMessageText(
                  ctx.chat.id,
                  loadingMsg.message_id,
                  null,
                  `🔍 Progress: ${checkedCount}/${websites.length} (${progress}%)\n✅ Up: ${stats.up} | 🚫 Blocked: ${stats.blocked} | ⏰ Timeout: ${stats.timeout} | ❌ Error: ${stats.error}\n⏳ Sisa: ~${Math.ceil((websites.length - checkedCount) * 4)} detik\n\n💾 Hasil tersimpan otomatis...`
                );
              } catch (editError) {
                logger.info('⚠️ Skip progress update (rate limit)');
                loadingMsg = null;
              }
            }

            if (checkedCount < websites.length) {
              await sleep(DELAY_BETWEEN_CHECKS * 1000);
            }
          } catch (error) {
            logger.error(`❌ Error checking ${name}: ${error.message}`);
            results.push({
              url,
              name,
              status: 'error',
              statusCode: null,
              responseTime: null,
              timestamp: formatTimeString(),
              error: `Check failed: ${error.message}`
            });
            checkedCount++;
            stats.error++;
          }
        }
      }

      mainSpinner.succeed(chalk.green(`✨ Completed! Checked ${websites.length} websites`));
      
      console.log('\n' + createBox(
        chalk.bold.green('CHECK SUMMARY') + '\n' +
        chalk.green(`✅ Online: ${stats.up}`) + '\n' +
        chalk.red(`🚫 Blocked: ${stats.blocked}`) + '\n' +
        chalk.yellow(`⏰ Timeout: ${stats.timeout}`) + '\n' +
        chalk.red(`❌ Errors: ${stats.error}`) + '\n' +
        chalk.gray(`Total: ${websites.length} websites`),
        60
      ));
      console.log('');

      // Save results
      const saveSuccess = saveCheckResults(results);
      if (saveSuccess) {
        logger.info('💾 Check results saved to JSON file');
      }

      // Update cache
      checkAllCache.results = results;
      checkAllCache.timestamp = now;

      // Completion message
      try {
        if (loadingMsg) {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMsg.message_id,
            null,
            `✅ Pengecekan selesai!\n📊 Total: ${websites.length} website\n⏱️ Waktu: ${Math.round((Date.now() - now) / 1000)}s\n\n📋 Menampilkan hasil...`
          );
        }
      } catch (completionError) {
        logger.info('⚠️ Skip completion message');
      }

      await sleep(1500);
    } else {
      // Use cached results
      results = checkAllCache.results;
      const cacheAge = Math.round((now - checkAllCache.timestamp) / 1000);
      try {
        await ctx.reply(`📋 Hasil dari cache (${cacheAge}s lalu)\n💡 Gunakan "🔄 Check Fresh" untuk update`);
      } catch (cacheError) {
        logger.info('⚠️ Skip cache message');
      }
    }

    // Display results
    await displayCheckAllResults(ctx, results, currentPage, totalPages, itemsPerPage);

  } catch (error) {
    logger.error(`❌ [Bot] Error in checkall: ${error.message}`);
    try {
      await ctx.reply(`❌ Error: ${error.message.substring(0, 100)}...\n\n💾 Partial results may be saved in check_results.json`);
    } catch (replyError) {
      logger.error('❌ Critical: Cannot send error message');
    }
  }
};

// Enhanced display function dengan better formatting
const displayCheckAllResults = async (ctx, allResults, currentPage, totalPages, itemsPerPage) => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = allResults.slice(startIndex, endIndex);

  // Enhanced summary
  const summary = {
    up: allResults.filter(r => r.status === 'up').length,
    blocked: allResults.filter(r => r.status === 'blocked').length,
    timeout: allResults.filter(r => r.status === 'timeout').length,
    dns_error: allResults.filter(r => r.status === 'dns_error').length,
    ssl_error: allResults.filter(r => r.status === 'ssl_error').length,
    other: allResults.filter(r => !['up', 'blocked', 'timeout', 'dns_error', 'ssl_error'].includes(r.status)).length
  };

  let summaryMsg = `📊 *Status Overview (${currentPage}/${totalPages})*\n\n`;
  summaryMsg += `✅ Online: ${summary.up} | ❌ Issues: ${allResults.length - summary.up}\n`;
  if (summary.blocked > 0) summaryMsg += `🚫 Blocked: ${summary.blocked} `;
  if (summary.timeout > 0) summaryMsg += `⏰ Timeout: ${summary.timeout} `;
  if (summary.dns_error > 0) summaryMsg += `🌐 DNS: ${summary.dns_error} `;
  if (summary.ssl_error > 0) summaryMsg += `🔒 SSL: ${summary.ssl_error}`;
  summaryMsg += `\n\n`;

  // Display current page results
  let charCount = summaryMsg.length;
  const maxChars = 3800;

  for (let index = 0; index < currentResults.length; index++) {
    const result = currentResults[index];
    const globalIndex = startIndex + index + 1;

    let statusEmoji;
    switch (result.status) {
      case 'up': statusEmoji = '✅'; break;
      case 'blocked': statusEmoji = '🚫'; break;
      case 'redirect': statusEmoji = '↗️'; break;
      case 'timeout': statusEmoji = '⏰'; break;
      case 'dns_error': statusEmoji = '🌐'; break;
      case 'ssl_error': statusEmoji = '🔒'; break;
      default: statusEmoji = '❌';
    }

    // Enhanced URL display dengan truncation
    let displayUrl = result.url;
    if (displayUrl.length > 45) {
      displayUrl = displayUrl.substring(0, 42) + '...';
    }

    let itemText = `${globalIndex}. ${statusEmoji} <code>!edit ${result.name}</code>\n`;
    itemText += `   📱 <a href="${result.url}">${displayUrl}</a>\n`;
    itemText += `   ⏱️ ${result.responseTime ? result.responseTime + 'ms' : 'N/A'} - ${result.statusCode || 'N/A'}`;

    if (result.error && result.status !== 'up') {
      let errorMsg = result.error;
      if (errorMsg.length > 40) {
        errorMsg = errorMsg.substring(0, 37) + '...';
      }
      itemText += `\n   ⚠️ ${errorMsg}`;
    }
    itemText += `\n\n`;

    if (charCount + itemText.length > maxChars) {
      summaryMsg += `... dan ${currentResults.length - index} lainnya\n\n`;
      break;
    }

    summaryMsg += itemText;
    charCount += itemText.length;
  }

  const timestamp = allResults[0]?.timestamp || formatTimeString();
  summaryMsg += `🕐 *Checked:* ${timestamp}\n`;
  summaryMsg += `💾 *Results: check_results.json*`;

  // Enhanced keyboard
  const keyboard = [];
  const navigationRow = [];

  if (currentPage > 1) {
    navigationRow.push({
      text: '⬅️ Previous',
      callback_data: `checkall_page_${currentPage - 1}`
    });
  }

  navigationRow.push({
    text: `${currentPage}/${totalPages}`,
    callback_data: 'page_info'
  });

  if (currentPage < totalPages) {
    navigationRow.push({
      text: 'Next ➡️',
      callback_data: `checkall_page_${currentPage + 1}`
    });
  }

  if (navigationRow.length > 0) {
    keyboard.push(navigationRow);
  }

  keyboard.push([{
    text: '🔄 Check Fresh',
    callback_data: 'checkall_refresh'
  }]);

  const replyMarkup = { inline_keyboard: keyboard };

  try {
    await ctx.replyWithHTML(summaryMsg, { reply_markup: replyMarkup });
  } catch (error) {
    logger.error('❌ Error sending checkall results:', error.message);
    // Fallback
    try {
      const fallbackMsg = `📊 Check Complete (${currentPage}/${totalPages})\n\n✅ Up: ${summary.up} | ❌ Down: ${allResults.length - summary.up}\n\n💾 Full results in check_results.json`;
      await ctx.reply(fallbackMsg, { reply_markup: replyMarkup });
    } catch (fallbackError) {
      logger.error('❌ Critical: Cannot send any message');
    }
  }
};

// Enhanced callback query handler
bot.on('callback_query', authorize, async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id;

    if (data.startsWith('list_page_')) {
      const page = parseInt(data.replace('list_page_', ''));
      await handleListCommand(ctx, page);
      await ctx.editMessageReplyMarkup();
      ctx.answerCbQuery();
    } else if (data.startsWith('checkall_page_')) {
      const page = parseInt(data.replace('checkall_page_', ''));

      if (checkAllCache.results && checkAllCache.results.length > 0) {
        const config = loadConfig();
        const websites = Object.entries(config.websites);
        const itemsPerPage = 10;
        const totalPages = Math.ceil(websites.length / itemsPerPage);

        await displayCheckAllResults(ctx, checkAllCache.results, page, totalPages, itemsPerPage);
      } else {
        await handleCheckAllCommand(ctx, page);
      }
      ctx.answerCbQuery();
    } else if (data === 'checkall_refresh') {
      await ctx.answerCbQuery('🔄 Starting fresh check...');
      await handleCheckAllCommand(ctx, 1, true);
    } else if (data === 'page_info') {
      ctx.answerCbQuery('ℹ️ Page navigation info');
    } else if (data.startsWith('replace_url_')) {
      // Handle URL replacement
      const index = parseInt(data.replace('replace_url_', ''));
      const pending = pendingUrlChanges.get(chatId);

      if (!pending) {
        await ctx.answerCbQuery('⚠️ Sesi expired, kirim URL lagi');
        return;
      }

      const candidate = pending.candidates[index];
      if (!candidate) {
        await ctx.answerCbQuery('❌ Pilihan tidak valid');
        return;
      }

      const config = loadConfig();
      const oldUrl = config.websites[candidate.name];
      const inputNewUrl = pending.newUrl;

      // CRITICAL: Merge URL dengan query parameter preservation (sama seperti !edit)
      const finalUrl = urlHelper.mergeUrlPreservingQuery(oldUrl, inputNewUrl) || inputNewUrl;

      // CRITICAL: Check duplicate dengan website lain (kecuali yang sedang diedit)
      const duplicateName = urlHelper.findDuplicateUrl(config.websites, finalUrl, candidate.name);
      if (duplicateName) {
        await ctx.answerCbQuery('❌ URL bentrok!');
        const msg = `⚠️ *URL Bentrok!*\n\nURL baru bentrok dengan website \`${duplicateName}\`!\n\n💡 Pilih URL yang berbeda atau hapus website \`${duplicateName}\` terlebih dahulu.`;
        await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
        pendingUrlChanges.delete(chatId);
        return;
      }

      // Update URL
      config.websites[candidate.name] = finalUrl;

      if (await saveConfig(config)) {
        await ctx.answerCbQuery('✅ URL berhasil diganti!');

        const oldParsed = urlHelper.parseUrl(oldUrl);
        const newParsed = urlHelper.parseUrl(inputNewUrl);
        const finalParsed = urlHelper.parseUrl(finalUrl);

        if (!oldParsed || !newParsed || !finalParsed) {
          await ctx.editMessageText('❌ Error parsing URL. Silakan coba lagi.', { parse_mode: 'Markdown' });
          pendingUrlChanges.delete(chatId);
          return;
        }

        let changeNote = '';
        if (finalUrl !== inputNewUrl) {
          changeNote = `\n\n✨ *Query parameters otomatis dipertahankan:*\n• Input: \`${urlHelper.truncateUrl(inputNewUrl, 45)}\`\n• Saved: \`${urlHelper.truncateUrl(finalUrl, 45)}\``;
        }

        const msg = `✅ *URL Berhasil Diganti!*\n\n📝 *Detail:*\n• Nama: \`${candidate.name}\`\n• Domain Lama: \`${oldParsed.hostname}\`\n• Domain Baru: \`${finalParsed.hostname}\`\n• URL Baru: \`${urlHelper.truncateUrl(finalUrl, 60)}\`${changeNote}\n\n💡 Perubahan akan diterapkan pada pengecekan berikutnya.`;

        await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
        logger.info(`✅ [Smart] URL replaced: ${candidate.name} -> ${finalUrl}`);

        // Clear pending
        pendingUrlChanges.delete(chatId);
      } else {
        await ctx.answerCbQuery('❌ Gagal menyimpan');
      }
    } else if (data === 'add_new_url') {
      // Add as new website
      const pending = pendingUrlChanges.get(chatId);

      if (!pending) {
        await ctx.answerCbQuery('⚠️ Sesi expired, kirim URL lagi');
        return;
      }

      const url = pending.newUrl;
      const suggestedName = urlHelper.extractDomain(url).replace(/[.-]/g, '_') + '_url';

      await ctx.answerCbQuery('💡 Gunakan command !add');

      const msg = `➕ *Tambah Website Baru*\n\n📱 URL: \`${urlHelper.truncateUrl(url, 60)}\`\n\n💡 Gunakan command berikut untuk menambahkan:\n\`!add ${suggestedName} ${url}\`\n\n_Atau ganti nama sesuai keinginan Anda_`;

      await ctx.editMessageText(msg, { parse_mode: 'Markdown' });

      // Clear pending
      pendingUrlChanges.delete(chatId);
    } else if (data === 'cancel_url') {
      // Cancel
      await ctx.answerCbQuery('❌ Dibatalkan');
      await ctx.editMessageText('❌ Operasi dibatalkan.');

      // Clear pending
      pendingUrlChanges.delete(chatId);
    }

  } catch (error) {
    logger.error(`❌ [Bot] Callback query error: ${error.message}`);
    ctx.answerCbQuery('❌ Error occurred');
  }
});

// Helper: Find longest common substring
const longestCommonSubstring = (str1, str2) => {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const len1 = s1.length;
  const len2 = s2.length;
  let longest = 0;

  for (let i = 0; i < len1; i++) {
    for (let j = 0; j < len2; j++) {
      let k = 0;
      while (i + k < len1 && j + k < len2 && s1[i + k] === s2[j + k]) {
        k++;
      }
      if (k > longest) longest = k;
    }
  }

  return longest;
};

// Helper: Calculate similarity percentage
const calculateSimilarity = (str1, str2) => {
  const commonLength = longestCommonSubstring(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength > 0 ? (commonLength / maxLength) * 100 : 0;
};

// Smart URL matching - cari URL yang mirip berdasarkan DOMAIN NAME dengan FUZZY MATCHING
const findSimilarUrls = (newUrl, websites) => {
  const candidates = [];
  const newParsed = urlHelper.parseUrl(newUrl);

  if (!newParsed) return candidates;

  // Extract main domain name (without TLD)
  const getMainDomain = (hostname) => {
    const parts = hostname.split('.');
    // Ambil bagian sebelum TLD terakhir (misalnya: maindimaniatogel dari maindimaniatogel.site)
    if (parts.length >= 2) {
      return parts[parts.length - 2].toLowerCase();
    }
    return hostname.toLowerCase();
  };

  const newMainDomain = getMainDomain(newParsed.hostname);
  const newHostnameLower = newParsed.hostname.toLowerCase();

  for (const [name, existingUrl] of Object.entries(websites)) {
    const existingParsed = urlHelper.parseUrl(existingUrl);
    if (!existingParsed) continue;

    const existingMainDomain = getMainDomain(existingParsed.hostname);
    const existingHostnameLower = existingParsed.hostname.toLowerCase();

    // Extract nama website tanpa suffix _url, -url, dll
    const cleanName = name.toLowerCase()
      .replace(/_url$/i, '')
      .replace(/-url$/i, '')
      .replace(/url$/i, '');

    let score = 0;

    // PRIORITAS TERTINGGI: Exact match nama dengan domain
    if (cleanName === newMainDomain) {
      score += 2000; // Highest!
    }

    // PRIORITAS TINGGI: Nama website mengandung main domain
    // Contoh: maindimaniatogel_url cocok dengan maindimaniatogel.site
    if (cleanName.includes(newMainDomain) || newMainDomain.includes(cleanName)) {
      score += 1500;
    }

    // FUZZY MATCHING: Kemiripan string (untuk kasus seperti tamaranite vs tamarabet)
    const similarity = calculateSimilarity(cleanName, newMainDomain);
    if (similarity >= 30) { // Diturunkan dari 50% ke 30% untuk deteksi lebih sensitif
      score += Math.floor(similarity * 15); // Max 1500 points untuk 100% match
      logger.info(`🔍 Fuzzy match: ${cleanName} vs ${newMainDomain} = ${similarity.toFixed(1)}% (score: +${Math.floor(similarity * 15)})`);
    }

    // LONGEST COMMON SUBSTRING: Ada kesamaan minimal 3 karakter
    const commonLength = longestCommonSubstring(cleanName, newMainDomain);
    if (commonLength >= 3) { // Diturunkan dari 5 ke 3 untuk deteksi lebih sensitif (gask = 4 chars)
      score += commonLength * 50; // Bonus per karakter yang sama
      logger.info(`🔍 Common substring: ${commonLength} chars (score: +${commonLength * 50})`);
    }

    // Exact hostname match (very high)
    if (newHostnameLower === existingHostnameLower) {
      score += 500;
    }

    // Main domain exact match
    if (newMainDomain === existingMainDomain) {
      score += 300;
    }

    // Same path (medium score)
    if (newParsed.pathname === existingParsed.pathname) {
      score += 50;
    }

    // Same protocol (low score)
    if (newParsed.protocol === existingParsed.protocol) {
      score += 10;
    }

    if (score > 0) {
      candidates.push({ name, url: existingUrl, score });
    }
  }

  // Sort by score descending
  return candidates.sort((a, b) => b.score - a.score);
};

// Handler untuk smart URL replacement
const handleSmartUrlReplacement = async (ctx, url) => {
  const config = loadConfig();
  const websites = config.websites;

  // Check jika URL sudah ada
  const exactMatch = urlHelper.findDuplicateUrl(websites, url);
  if (exactMatch) {
    return ctx.reply(`✅ URL ini sudah ada dengan nama "${exactMatch}"!\n\n💡 Gunakan !list untuk melihat semua website.`);
  }

  // Cari URL yang mirip
  const candidates = findSimilarUrls(url, websites);

  if (candidates.length === 0) {
    // Tidak ada yang mirip, tawarkan untuk add baru
    return ctx.reply(`🔍 Tidak ada URL yang mirip ditemukan.\n\n💡 Gunakan !add <nama> <url> untuk menambahkan website baru.\nContoh: !add ${urlHelper.extractDomain(url).replace(/[.-]/g, '_')}_url ${url}`);
  }

  // Ambil top candidate
  const topCandidate = candidates[0];
  const parsedNew = urlHelper.parseUrl(url);
  const parsedOld = urlHelper.parseUrl(topCandidate.url);

  // Store pending change
  const chatId = ctx.chat.id;
  pendingUrlChanges.set(chatId, {
    newUrl: url,  // Changed from 'url' to 'newUrl' to match callback handlers
    candidates: candidates.slice(0, 3), // Top 3
    timestamp: Date.now()
  });

  // Build message dengan proper Markdown
  let msg = `🔄 *URL Baru Terdeteksi!*\n\n`;
  msg += `📱 *URL Baru:*\n\`${urlHelper.truncateUrl(url, 60)}\`\n\n`;
  msg += `🎯 *URL Yang Mirip:*\n`;

  candidates.slice(0, 3).forEach((candidate, index) => {
    msg += `${index + 1}. \`${candidate.name}\`\n`;
    msg += `   \`${urlHelper.truncateUrl(candidate.url, 55)}\`\n`;
    if (index === 0) msg += `   ⭐ Score: ${candidate.score} (Terbaik)\n`;
    msg += `\n`;
  });

  msg += `💡 Apakah Anda ingin mengganti salah satu URL di atas?`;

  // Build inline keyboard
  const keyboard = [];

  // Add buttons for top 3 candidates
  candidates.slice(0, 3).forEach((candidate, index) => {
    keyboard.push([{
      text: `✅ Ganti ${candidate.name}`,
      callback_data: `replace_url_${index}`
    }]);
  });

  keyboard.push([{
    text: '➕ Tambah Sebagai Baru',
    callback_data: 'add_new_url'
  }]);

  keyboard.push([{
    text: '❌ Batal',
    callback_data: 'cancel_url'
  }]);

  await ctx.replyWithMarkdown(msg, {
    reply_markup: { inline_keyboard: keyboard }
  });
};

// Enhanced text message handler
bot.on('text', authorize, async (ctx) => {
  const text = ctx.message.text.trim();

  if (text.startsWith('!')) {
    const command = text.split(' ')[0].toLowerCase();

    try {
      switch (command) {
        case '!add':
          await handleAddCommand(ctx, text);
          break;
        case '!edit':
          await handleEditCommand(ctx, text);
          break;
        case '!list':
          await handleListCommand(ctx);
          break;
        case '!del':
        case '!delete':
          await handleDeleteCommand(ctx, text);
          break;
        case '!check':
          await handleCheckCommand(ctx, text);
          break;
        case '!checkall':
          await handleCheckAllCommand(ctx);
          break;
        case '!help':
          await handleHelpCommand(ctx);
          break;
        case '!createphp':
          await handleCreatePhpRedirect(ctx, text);
          break;
        case '!stats':
          await handleStatsCommand(ctx, text);
          break;
        case '!export':
          await handleExportCommand(ctx, text);
          break;
        default:
          ctx.reply('❌ Perintah tidak dikenali.\nGunakan !help untuk melihat daftar perintah yang tersedia.');
      }
    } catch (error) {
      logger.error(`❌ [Bot] Command error: ${error.message}`);
      ctx.reply(`❌ Terjadi kesalahan: ${error.message}`);
    }
  } else if (text.startsWith('/')) {
    ctx.reply('❌ Perintah tidak dikenali.\nGunakan /help atau !help untuk melihat daftar perintah yang tersedia.');
  } else {
    // Check jika text berupa URL
    const validatedUrl = validateUrl(text);
    if (validatedUrl) {
      try {
        await handleSmartUrlReplacement(ctx, validatedUrl);
      } catch (error) {
        logger.error(`❌ [Bot] Smart URL error: ${error.message}`);
        ctx.reply(`❌ Terjadi kesalahan: ${error.message}`);
      }
    }
    // Jika bukan URL, ignore (bisa text biasa)
  }
});

// Enhanced error handler
bot.catch(async (err, ctx) => {
  logger.error(`❌ [Bot] Error for ${ctx.updateType}:`, err);

  // Skip timeout e rate limit errors
  if (err.name === 'TimeoutError' || 
      err.message.includes('timed out') || 
      err.message.includes('429')) {
    logger.info('⚠️ Skipping timeout/rate limit error...');
    return;
  }

  // Handle bot conflicts
  if (err.response?.error_code === 409) {
    logger.info('⚠️ Bot conflict detected, restarting...');
    setTimeout(() => process.exit(1), 5000);
    return;
  }

  // Handle network errors gracefully
  if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
    logger.info('⚠️ Network error, continuing...');
    return;
  }

  // Generic error response with timeout protection
  if (ctx && ctx.reply) {
    try {
      const replyPromise = ctx.reply('❌ Terjadi kesalahan sementara. Bot tetap berjalan, coba lagi nanti.');
      await Promise.race([
        replyPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Reply timeout')), 5000))
      ]);
    } catch (replyError) {
      logger.error('❌ Error sending error reply:', replyError.message);
    }
  }
});

// Enhanced automatic checker
let checkerJob = null;

const startAutomaticChecker = () => {
  if (checkerJob) {
    checkerJob.destroy();
  }

  // Daily check at 8 AM Jakarta time
  const cronExpression = `0 8 * * *`;

  checkerJob = cron.schedule(cronExpression, async () => {
    console.log('\n' + chalk.bold.magenta('━'.repeat(60)));
    console.log(gradient('  ⏰ AUTOMATIC CHECK TRIGGERED  '));
    console.log(chalk.bold.magenta('━'.repeat(60)) + '\n');
    
    const autoCheckSpinner = ora({
      text: chalk.cyan('Initiating automatic website check...'),
      color: 'cyan',
      spinner: 'moon'
    }).start();

    try {
      const config = loadConfig();
      const websites = Object.entries(config.websites);

      if (websites.length === 0) {
        logger.info('📝 No websites to monitor');
        return;
      }

      const results = [];
      let processedCount = 0;

      autoCheckSpinner.text = chalk.cyan(`Processing ${websites.length} websites...`);

      let stats = { up: 0, blocked: 0, timeout: 0, error: 0 };

      // Process websites dengan error handling per item
      for (const [name, url] of websites) {
        try {
          autoCheckSpinner.text = chalk.cyan(`Checking: ${chalk.bold.white(name)} ${chalk.gray(`[${processedCount + 1}/${websites.length}]`)}`);
          
          const result = await checkSingleUrl(url, name, 0, false);
          results.push(result);
          processedCount++;

          // Update stats
          if (result.status === 'up') stats.up++;
          else if (result.status === 'blocked') stats.blocked++;
          else if (result.status === 'timeout') stats.timeout++;
          else stats.error++;

          // Progress log setiap 20 website
          if (processedCount % 20 === 0) {
            autoCheckSpinner.text = chalk.cyan(`Progress: ${chalk.yellow(processedCount)}/${websites.length} - ✅ ${stats.up} | 🚫 ${stats.blocked} | ⏰ ${stats.timeout} | ❌ ${stats.error}`);
          }

          if (processedCount < websites.length) {
            await sleep(DELAY_BETWEEN_CHECKS * 1000);
          }
        } catch (error) {
          logger.error(`❌ Auto check error for ${name}: ${error.message}`);
          results.push({
            url,
            name,
            status: 'error',
            statusCode: null,
            responseTime: null,
            timestamp: formatTimeString(),
            error: `Auto check failed: ${error.message}`
          });
          processedCount++;
          stats.error++;
        }
      }

      autoCheckSpinner.succeed(chalk.green(`✨ Auto check completed! ${websites.length} websites processed`));

      // Save results
      const saveSuccess = saveCheckResults(results);
      if (saveSuccess) {
        logger.info('💾 Auto check results saved');
      }

      // Update cache
      checkAllCache.results = results;
      checkAllCache.timestamp = Date.now();

      // Send alert for issues
      const issueResults = results.filter(r => r.status !== 'up');

      if (issueResults.length > 0) {
        let alertMsg = `🚨 *Daily Check Alert*\n\n`;

        const categories = {
          blocked: issueResults.filter(r => r.status === 'blocked'),
          timeout: issueResults.filter(r => r.status === 'timeout'),
          dns_error: issueResults.filter(r => r.status === 'dns_error'),
          ssl_error: issueResults.filter(r => r.status === 'ssl_error'),
          other: issueResults.filter(r => !['blocked', 'timeout', 'dns_error', 'ssl_error'].includes(r.status))
        };

        Object.entries(categories).forEach(([category, sites]) => {
          if (sites.length > 0) {
            let emoji = '❌';
            let title = 'Other Issues';

            switch (category) {
              case 'blocked': emoji = '🚫'; title = 'Blocked Sites'; break;
              case 'timeout': emoji = '⏰'; title = 'Timeout Issues'; break;
              case 'dns_error': emoji = '🌐'; title = 'DNS Errors'; break;
              case 'ssl_error': emoji = '🔒'; title = 'SSL Errors'; break;
            }

            alertMsg += `${emoji} *${title} (${sites.length}):*\n`;
            sites.forEach(site => {
              alertMsg += `• ${site.name} - ${site.statusCode || 'N/A'}\n`;
            });
            alertMsg += '\n';
          }
        });

        alertMsg += `📊 *Summary:* ${results.length - issueResults.length}/${results.length} sites healthy\n`;
        alertMsg += `🕐 *Time:* ${formatTimeString()}\n`;
        alertMsg += `💾 *Details:* check_results.json`;

        // Send alert to all authorized admins
        for (const chatId of AUTHORIZED_CHAT_IDS) {
          try {
            await bot.telegram.sendMessage(chatId, alertMsg, { 
              parse_mode: 'Markdown',
              disable_web_page_preview: true 
            });
          } catch (telegramError) {
            logger.error(`❌ Failed to send alert to ${chatId}:`, telegramError.message);
          }
        }
      }

      console.log('\n' + createBox(
        chalk.bold.green('AUTO CHECK COMPLETED') + '\n' +
        chalk.green(`✅ Online: ${stats.up}`) + '\n' +
        chalk.red(`🚫 Blocked: ${stats.blocked}`) + '\n' +
        chalk.yellow(`⏰ Timeout: ${stats.timeout}`) + '\n' +
        chalk.red(`❌ Errors: ${stats.error}`) + '\n' +
        chalk.gray(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`) + '\n' +
        chalk.cyan(`Total Checked: ${results.length}`) + '\n' +
        chalk.cyan(`Issues Found: ${issueResults.length}`) + '\n' +
        chalk.gray(`Time: ${formatTimeString()}`),
        60
      ));

      logger.info(chalk.green(`✅ Auto check complete: ${results.length} checked, ${issueResults.length} issues`));

      // Update config last check time
      config.last_check_time = formatTimeString();
      await saveConfig(config);

    } catch (error) {
      logger.error('❌ Auto check error:', error.message);

      // Send error notification to all authorized admins
      for (const chatId of AUTHORIZED_CHAT_IDS) {
        try {
          await bot.telegram.sendMessage(chatId, 
            `⚠️ *Auto Check Failed*\n\nError: \`${error.message}\`\n\nNext check: tomorrow 8 AM`, 
            { parse_mode: 'Markdown' }
          );
        } catch (recoveryError) {
          logger.error(`❌ Failed to send error notification to ${chatId}:`, recoveryError.message);
        }
      }
    }
  });

  logger.info('🕐 Auto checker scheduled: daily at 8 AM Jakarta time');
};

// Environment validation
const validateEnv = () => {
  const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    logger.info('💡 Copy .env.example to .env and fill with proper values');
    process.exit(1);
  }

  // Validate chat ID format - support comma-separated IDs
  const chatIds = process.env.TELEGRAM_CHAT_ID.split(',').map(id => id.trim());
  const invalidIds = chatIds.filter(id => !/^-?\d+$/.test(id));
  
  if (invalidIds.length > 0) {
    logger.error(`❌ Invalid TELEGRAM_CHAT_ID format: ${invalidIds.join(', ')}`);
    logger.info('💡 Format: single ID (123456) or comma-separated (123456,789012,345678)');
    process.exit(1);
  }
  
  logger.info(`👥 Authorized admins: ${chatIds.length} chat ID(s)`);
};

// Enhanced graceful shutdown
const setupGracefulShutdown = () => {
  const shutdown = (signal) => {
    logger.info(`\n⚠️ Received ${signal}, shutting down gracefully...`);

    // Clear cache
    checkAllCache.clear();

    // Stop cron job
    if (checkerJob) {
      checkerJob.destroy();
      logger.info('🔄 Stopped automatic checker');
    }

    // Close axios connections
    if (axiosInstance.defaults.httpsAgent) {
      axiosInstance.defaults.httpsAgent.destroy();
    }

    // Stop bot
    bot.stop(signal);
    logger.info('🤖 Bot stopped');

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2'));

  // Handle PM2 signals
  process.on('SIGUSR1', () => shutdown('SIGUSR1'));
};

// Enhanced error handlers
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);

  // Clean exit untuk production
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);

  // Skip timeout rejections
  if (reason && (reason.name === 'TimeoutError' || 
      (reason.message && reason.message.includes('timed out')))) {
    logger.info('⚠️ Ignoring timeout rejection');
    return;
  }

  // Exit untuk critical errors
  setTimeout(() => process.exit(1), 1000);
});

// Main function dengan enhanced startup
const main = async () => {
  try {
    showBanner();
    
    const startupSpinner = ora({
      text: chalk.cyan('Initializing system...'),
      color: 'cyan',
      spinner: 'arc'
    }).start();

    await sleep(500);
    startupSpinner.text = chalk.cyan('Validating environment...');
    validateEnv();
    
    await sleep(300);
    startupSpinner.succeed(chalk.green('Environment validated'));
    
    logger.info(`📡 ${chalk.bold('Node.js')} version: ${chalk.yellow(process.version)}`);
    logger.info(`💾 Memory usage: ${chalk.yellow(Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB')}`);

    setupGracefulShutdown();

    // Test bot connection
    const connectionSpinner = ora({
      text: chalk.cyan('Connecting to Telegram API...'),
      color: 'cyan',
      spinner: 'dots12'
    }).start();

    const botInfo = await bot.telegram.getMe();
    connectionSpinner.succeed(chalk.green(`Connected to Telegram: ${chalk.bold.white('@' + botInfo.username)}`));

    // Launch bot
    const launchSpinner = ora({
      text: chalk.cyan('Launching bot service...'),
      color: 'cyan',
      spinner: 'bouncingBall'
    }).start();

    await bot.launch({
      dropPendingUpdates: true
    });
    
    await sleep(500);
    launchSpinner.succeed(chalk.green('Bot service launched'));

    // Start automatic checker
    const checkerSpinner = ora({
      text: chalk.cyan('Starting automatic checker...'),
      color: 'cyan',
      spinner: 'star'
    }).start();

    startAutomaticChecker();
    
    await sleep(300);
    checkerSpinner.succeed(chalk.green('Automatic checker started (Daily @ 8 AM)'));

    console.log('\n' + createBox(
      chalk.bold.green('🎉 ALL SYSTEMS OPERATIONAL') + '\n\n' +
      chalk.cyan('Bot Status: ') + chalk.green.bold('ONLINE') + '\n' +
      chalk.cyan('Monitoring: ') + chalk.yellow.bold('ACTIVE') + '\n' +
      chalk.cyan('Request Timeout: ') + chalk.yellow(REQUEST_TIMEOUT + 'ms') + '\n' +
      chalk.cyan('Check Interval: ') + chalk.yellow(CHECK_INTERVAL_HOURS + 'h') + '\n\n' +
      chalk.gray('Press Ctrl+C to stop the bot'),
      60
    ));

    console.log('\n' + chalk.bold.magenta('━'.repeat(60)) + '\n');
    logger.info(chalk.green.bold('✨ Ready to monitor websites!'));
    console.log(chalk.bold.magenta('━'.repeat(60)) + '\n');

    // Keep process alive
    process.stdin.resume();

  } catch (error) {
    const errorSpinner = ora().fail(chalk.red.bold(`FATAL ERROR: ${error.message}`));
    logger.error('Stack:', error.stack);
    
    console.log('\n' + createBox(
      chalk.red.bold('⚠️  STARTUP FAILED') + '\n\n' +
      chalk.red('Error: ') + chalk.white(error.message) + '\n\n' +
      chalk.gray('Check logs for details'),
      60
    ));
    
    process.exit(1);
  }
};

// Export untuk testing
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { 
  main, 
  checkSingleUrl, 
  validateUrl,
  loadConfig,
  saveConfig 
};