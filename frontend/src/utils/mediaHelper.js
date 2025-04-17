/**
 * Utility functions for media processing and handling
 */

/**
 * Determines the appropriate file extension based on media type
 * @param {string} mediaType - 'image' or 'video'
 * @returns {string} - The file extension (without the dot)
 */
export const getFileExtension = (mediaType) => {
  return mediaType === 'video' ? 'mp4' : 'jpg';
};

/**
 * Generates a suitable filename for downloaded media
 * @param {string} mediaType - Type of media ('image' or 'video')
 * @param {number} index - Index of the media item in a collection
 * @param {string} contentType - Type of content ('post', 'story', 'reel')
 * @returns {string} - Generated filename
 */
export const generateFilename = (mediaType, index, contentType) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `instagram_${contentType || 'media'}_${mediaType}_${index + 1}_${timestamp}.${getFileExtension(mediaType)}`;
};

/**
 * Validates a media item to ensure it has all required properties
 * @param {Object} item - Media item object
 * @returns {Object} - Validated and normalized media item
 */
export const validateMediaItem = (item) => {
  if (!item || typeof item !== 'object') {
    throw new Error('Invalid media item');
  }
  
  return {
    url: item.url || '',
    media_type: item.media_type || 'image',
    thumbnail_url: item.thumbnail_url || item.url || '',
    // Add any other required fields with defaults
  };
};

/**
 * Creates a blob URL for in-memory representation of media
 * @param {Blob} blob - Media blob
 * @returns {string} - Blob URL
 */
export const createBlobUrl = (blob) => {
  return window.URL.createObjectURL(blob);
};

/**
 * Cleans up a blob URL when no longer needed
 * @param {string} url - Blob URL to revoke
 */
export const revokeBlobUrl = (url) => {
  if (url && url.startsWith('blob:')) {
    window.URL.revokeObjectURL(url);
  }
};

/**
 * Format file size in a human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size (e.g., "1.2 MB")
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Generates a shimmer effect placeholder for images
 * @returns {string} - Base64 encoded SVG for shimmer effect
 */
export const shimmerPlaceholder = () => {
  return `data:image/svg+xml;base64,${btoa(
    `<svg width="100%" height="100%" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1f2937"/>
      <rect id="r" width="100%" height="100%" fill="url(#g)">
        <animate attributeName="x" from="-100%" to="100%" dur="1.5s" repeatCount="indefinite" />
      </rect>
      <defs>
        <linearGradient id="g">
          <stop stop-color="#1f2937" offset="0%"/>
          <stop stop-color="#374151" offset="50%"/>
          <stop stop-color="#1f2937" offset="100%"/>
        </linearGradient>
      </defs>
    </svg>`
  )}`;
};

/**
 * Check if a URL is an Instagram URL
 * @param {string} url - URL to check
 * @returns {boolean} - True if it's an Instagram URL
 */
export const isInstagramUrl = (url) => {
  if (!url) return false;
  url = url.trim().toLowerCase();
  return url.includes('instagram.com') || url.includes('instagr.am');
};

/**
 * Helper functions for processing media items
 */

/**
 * Ensures the URL is an absolute URL by adding necessary protocol and domain
 * @param {string} url - The URL to process
 * @returns {string} An absolute URL
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
 * Generates a filename for media items for download
 * @param {object} mediaItem - Media item object with url and media_type
 * @returns {string} - A generated filename
 */
export const generateFilenameFromMediaItem = (mediaItem) => {
  if (!mediaItem) return 'instagram_media.jpg';
  
  const { url, media_type } = mediaItem;
  const extension = media_type === 'video' ? 'mp4' : 'jpg';
  let filename;
  
  try {
    // Try to extract a filename from the URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    
    // If we have a filename-like part with extension, use it
    if (lastPart && lastPart.includes('.')) {
      filename = lastPart;
    } else if (lastPart && lastPart.length > 5) {
      // Use the last part as an ID and add proper extension
      filename = `instagram_${lastPart}.${extension}`;
    } else {
      // Fallback to timestamp-based filename
      filename = `instagram_${media_type}_${Date.now()}.${extension}`;
    }
  } catch (e) {
    // Fallback in case of URL parsing error
    filename = `instagram_${media_type}_${Date.now()}.${extension}`;
  }
  
  return filename;
};

/**
 * Sanitizes Instagram URLs to ensure they point to high-quality media
 * Helps fix issues where thumbnails are returned instead of full media
 * @param {string} url - The media URL from Instagram
 * @param {string} mediaType - The type of media (video, image)
 * @returns {string} - Processed URL to ensure best quality
 */
export const getHighQualityMediaUrl = (url, mediaType) => {
  if (!url) return '';
  
  try {
    const urlObj = new URL(ensureAbsoluteUrl(url));
    
    // Remove size restrictions from URL parameters to get full quality
    if (mediaType === 'image') {
      // Remove Instagram's size restrictions like ?_nc_ht=... or &_nc_cat=...
      const pathParts = urlObj.pathname.split('.');
      const fileExtension = pathParts.length > 1 ? pathParts.pop() : 'jpg';
      
      // Rebuild the URL without query parameters
      return `${urlObj.protocol}//${urlObj.host}${pathParts.join('.')}.${fileExtension}`;
    }
    
    // For videos, make sure we're getting the mp4 version, not a preview
    if (mediaType === 'video') {
      // If URL doesn't end with .mp4, try to fix it
      if (!url.toLowerCase().endsWith('.mp4')) {
        // Check for common patterns in Instagram URLs
        if (url.includes('/v/')) {
          const pathParts = urlObj.pathname.split('/');
          const videoId = pathParts[pathParts.length - 1];
          // Construct a direct video URL
          return `${urlObj.protocol}//${urlObj.host}/v/${videoId}/video/index.mp4`;
        }
      }
    }
    
    return url;
  } catch (e) {
    console.error('Error processing media URL:', e);
    return url;
  }
};

/**
 * Process a media item to ensure all required fields and proper URLs
 * @param {object} item - The raw media item from API
 * @returns {object} - Processed media item
 */
export const processMediaItem = (item) => {
  const processedItem = {
    ...item,
    media_type: item.media_type || 'image', // Default to image if not specified
    // Ensure URL is properly resolved if it's a relative URL
    url: getHighQualityMediaUrl(item.url, item.media_type || 'image'),
    thumbnail_url: item.thumbnail_url ? ensureAbsoluteUrl(item.thumbnail_url) : undefined,
    filename: generateFilenameFromMediaItem(item)
  };
  
  return processedItem;
};
