// Profile Image Utility
// Generates Slack-style profile images with colored backgrounds and initials

// Predefined color palette for profile images
export const PROFILE_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Light Yellow
  '#BB8FCE', // Light Purple
  '#85C1E9', // Light Blue
  '#F8C471', // Orange
  '#82E0AA', // Light Green
  '#F1948A', // Light Red
  '#85929E', // Gray
  '#D7BDE2', // Lavender
  '#A9DFBF', // Pale Green
  '#F9E79F', // Pale Yellow
  '#AED6F1', // Pale Blue
  '#F5B7B1', // Pale Red
  '#D5A6BD'  // Dusty Rose
];

/**
 * Get the initial character from a name
 * Handles both English and Chinese characters
 */
export const getInitial = (name) => {
  if (!name || typeof name !== 'string') return '?';
  
  const trimmedName = name.trim();
  if (trimmedName.length === 0) return '?';
  
  // For Chinese characters, return the first character
  // For English names, return the first letter uppercased
  const firstChar = trimmedName.charAt(0);
  
  // Check if it's a Chinese character (Unicode range for CJK)
  if (/[\u4e00-\u9fff]/.test(firstChar)) {
    return firstChar;
  }
  
  // For English characters, return uppercase
  return firstChar.toUpperCase();
};

/**
 * Generate a consistent color for a user based on their ID
 * This ensures the same user always gets the same color
 */
export const getUserColor = (userId, customColor = null) => {
  if (customColor && PROFILE_COLORS.includes(customColor)) {
    return customColor;
  }
  
  if (!userId) return PROFILE_COLORS[0];
  
  // Create a simple hash from the userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the hash to select a color
  const colorIndex = Math.abs(hash) % PROFILE_COLORS.length;
  return PROFILE_COLORS[colorIndex];
};

/**
 * Generate profile image data for a user
 */
export const generateProfileImage = (user) => {
  const displayName = user?.displayName || user?.email || 'Unknown';
  const initial = getInitial(displayName);
  const backgroundColor = getUserColor(user?.uid, user?.profileColor);
  
  return {
    initial,
    backgroundColor,
    textColor: '#FFFFFF' // White text for contrast
  };
};

/**
 * Get a random color from the palette
 */
export const getRandomColor = () => {
  const randomIndex = Math.floor(Math.random() * PROFILE_COLORS.length);
  return PROFILE_COLORS[randomIndex];
};

/**
 * Check if a color is valid from our palette
 */
export const isValidColor = (color) => {
  return PROFILE_COLORS.includes(color);
};

