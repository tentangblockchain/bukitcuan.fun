/**
 * URL Helper Module
 * Provides consistent URL parsing, validation, and normalization
 */

/**
 * Parse URL into components
 * @param {string} url - URL to parse
 * @returns {Object|null} Parsed URL object or null if invalid
 */
const parseUrl = (url) => {
  try {
    // Trim whitespace
    url = url.trim();
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const urlObj = new URL(url);
    
    // Validate protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }
    
    // Validate hostname
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return null;
    }
    
    return {
      full: url,
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
      baseUrl: `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}${urlObj.pathname}`,
      origin: urlObj.origin
    };
  } catch (error) {
    return null;
  }
};

/**
 * Validate and normalize URL
 * @param {string} url - URL to validate
 * @returns {string|false} Normalized URL or false if invalid
 */
const validateUrl = (url) => {
  const parsed = parseUrl(url);
  return parsed ? parsed.full : false;
};

/**
 * Get base URL without query parameters and hash
 * @param {string} url - Full URL
 * @returns {string|null} Base URL or null if invalid
 */
const getBaseUrl = (url) => {
  const parsed = parseUrl(url);
  return parsed ? parsed.baseUrl : null;
};

/**
 * Compare two URLs by their base (ignoring query params and hash)
 * @param {string} url1 - First URL
 * @param {string} url2 - Second URL
 * @returns {boolean} True if base URLs match
 */
const isSameBaseUrl = (url1, url2) => {
  const base1 = getBaseUrl(url1);
  const base2 = getBaseUrl(url2);
  return base1 && base2 && base1 === base2;
};

/**
 * Merge URLs: use new base URL but preserve old query params if new URL has none
 * @param {string} oldUrl - Original URL
 * @param {string} newUrl - New URL
 * @returns {string|null} Merged URL or null if invalid
 */
const mergeUrlPreservingQuery = (oldUrl, newUrl) => {
  const oldParsed = parseUrl(oldUrl);
  const newParsed = parseUrl(newUrl);
  
  if (!oldParsed || !newParsed) {
    return null;
  }
  
  // If new URL has query params, use it as-is
  if (newParsed.search) {
    return newParsed.full;
  }
  
  // If old URL has query params and new URL doesn't, preserve them
  if (oldParsed.search) {
    return newParsed.baseUrl + oldParsed.search;
  }
  
  // Neither has query params, use new URL
  return newParsed.full;
};

/**
 * Find duplicate URLs in a website collection
 * @param {Object} websites - Object with name:url pairs
 * @param {string} newUrl - URL to check
 * @param {string} excludeName - Name to exclude from duplicate check (for edits)
 * @returns {string|null} Name of duplicate entry or null if none found
 */
const findDuplicateUrl = (websites, newUrl, excludeName = null) => {
  const newParsed = parseUrl(newUrl);
  if (!newParsed) return null;
  
  for (const [name, url] of Object.entries(websites)) {
    if (excludeName && name === excludeName) continue;
    
    const existingParsed = parseUrl(url);
    if (!existingParsed) continue;
    
    // Check if full URLs match
    if (newParsed.full === existingParsed.full) {
      return name;
    }
  }
  
  return null;
};

/**
 * Extract domain name for display
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain name or original URL if parsing fails
 */
const extractDomain = (url) => {
  const parsed = parseUrl(url);
  return parsed ? parsed.hostname : url;
};

/**
 * Truncate URL for display
 * @param {string} url - URL to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated URL
 */
const truncateUrl = (url, maxLength = 60) => {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
};

export default {
  parseUrl,
  validateUrl,
  getBaseUrl,
  isSameBaseUrl,
  mergeUrlPreservingQuery,
  findDuplicateUrl,
  extractDomain,
  truncateUrl
};
