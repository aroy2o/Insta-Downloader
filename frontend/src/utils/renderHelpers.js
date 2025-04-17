/**
 * Safely renders any value as a string for use in JSX
 * Handles objects, arrays, null, and undefined
 */
export const safeRender = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'object') {
    // If it's an object with a toString method that isn't the default one
    if (value.toString && value.toString !== Object.prototype.toString) {
      return value.toString();
    }
    
    // If it has a message property (common in error objects)
    if (value.message) {
      return value.message;
    }
    
    // Last resort: stringify the object
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '[Object]';
    }
  }
  
  // If it's already a string, number, etc.
  return String(value);
};
