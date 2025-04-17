/**
 * Utility functions for URL processing and validation
 */

/**
 * Checks if a URL is a valid Instagram URL
 * @param {string} url - URL to check
 * @returns {boolean} - true if valid Instagram URL
 */
export const isValidInstagramUrl = (url) => {
  if (!url) return false;
  
  const trimmedUrl = url.trim();
  return (
    trimmedUrl.includes('instagram.com') || 
    trimmedUrl.includes('instagr.am')
  );
};

/**
 * Ensures a URL is absolute (has a protocol)
 * @param {string} url - URL to process
 * @returns {string} - Processed URL
 */
export const ensureAbsoluteUrl = (url) => {
  if (!url) return '';
  
  // If it already has a protocol, return it
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a protocol-relative URL, add https:
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // If it's a root-relative URL, add Instagram domain
  if (url.startsWith('/')) {
    return `https://www.instagram.com${url}`;
  }
  
  // Otherwise assume it's a relative path and add Instagram domain with /
  return `https://www.instagram.com/${url}`;
};

/**
 * Determines Instagram content type from URL
 * @param {string} url - Instagram URL
 * @returns {string} - Content type (post, reel, story, unknown)
 */
export const getInstagramContentType = (url) => {
  if (!url) return 'unknown';
  
  if (url.includes('/p/')) return 'post';
  if (url.includes('/reel/')) return 'reel';
  if (url.includes('/stories/')) return 'story';
  return 'unknown';
};
