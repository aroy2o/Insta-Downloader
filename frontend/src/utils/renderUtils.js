/**
 * Safely renders a value that might be an object
 * @param {any} value - The value to render
 * @param {string} defaultProperty - The property to extract if value is an object (default: 'message')
 * @param {string} fallback - Fallback text if the value is empty or the property doesn't exist
 * @returns {string} A safe string representation of the value
 */
export const safeRender = (value, defaultProperty = 'message', fallback = '') => {
  if (value === null || value === undefined) {
    return fallback;
  }
  
  if (typeof value === 'object') {
    return value[defaultProperty] || fallback;
  }
  
  return String(value);
};
