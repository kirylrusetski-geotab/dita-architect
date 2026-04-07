import React from 'react';

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg', color?: string }> = ({ size = 'md', color = 'border-blue-600' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-4',
  };

  return (
    <div className={`animate-spin rounded-full border-t-transparent ${color} ${sizeClasses[size]}`}></div>
  );
};
