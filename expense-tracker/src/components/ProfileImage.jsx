import React from 'react';
import { generateProfileImage } from '../utils/profileImage';

/**
 * ProfileImage Component
 * Displays a user's profile image with colored background and initial
 * Similar to Slack's profile image style
 */
export default function ProfileImage({ 
  user, 
  size = 'md', 
  className = '',
  showTooltip = true 
}) {
  const profileData = generateProfileImage(user);
  
  // Size configurations
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-20 h-20 text-2xl'
  };
  
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  
  const displayName = user?.displayName || user?.email || 'Unknown User';
  
  return (
    <div
      className={`
        ${sizeClass}
        rounded-full
        flex
        items-center
        justify-center
        font-semibold
        select-none
        flex-shrink-0
        ${className}
      `}
      style={{
        backgroundColor: profileData.backgroundColor,
        color: profileData.textColor
      }}
      title={showTooltip ? displayName : undefined}
    >
      {profileData.initial}
    </div>
  );
}

/**
 * ProfileImageWithName Component
 * Displays profile image with user name beside it
 */
export function ProfileImageWithName({ 
  user, 
  size = 'md', 
  className = '',
  nameClassName = '',
  showEmail = false 
}) {
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Unknown User';
  const email = user?.email;
  
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <ProfileImage user={user} size={size} showTooltip={false} />
      <div className="flex flex-col">
        <span className={`font-medium ${nameClassName}`}>
          {displayName}
        </span>
        {showEmail && email && (
          <span className="text-xs text-gray-500">
            {email}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ProfileImageGroup Component
 * Displays multiple profile images in a group (overlapping style)
 */
export function ProfileImageGroup({ 
  users = [], 
  size = 'sm', 
  maxDisplay = 3,
  className = '' 
}) {
  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;
  
  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex -space-x-1">
        {displayUsers.map((user, index) => (
          <div
            key={user?.uid || index}
            className="ring-2 ring-white"
            style={{ zIndex: displayUsers.length - index }}
          >
            <ProfileImage user={user} size={size} />
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className={`
              ${size === 'xs' ? 'w-6 h-6 text-xs' : 
                size === 'sm' ? 'w-8 h-8 text-xs' : 
                'w-10 h-10 text-sm'}
              rounded-full
              bg-gray-300
              text-gray-600
              flex
              items-center
              justify-center
              font-medium
              ring-2
              ring-white
            `}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
}

