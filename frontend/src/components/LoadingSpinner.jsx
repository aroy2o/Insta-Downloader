import React from 'react';

export function LoadingSpinner({ 
  size = "md", 
  color = "blue", 
  className = "", 
  thickness = "normal",
  variant = "circular" // New prop for different spinner styles
}) {
  // Size variants
  const sizeClasses = {
    xs: "h-3 w-3",
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-10 w-10",
    "2xl": "h-12 w-12"
  };
  
  // Color variants with gradients
  const colorClasses = {
    blue: "text-blue-500 dark:text-blue-400",
    indigo: "text-indigo-500 dark:text-indigo-400",
    purple: "text-purple-500 dark:text-purple-400",
    green: "text-green-500 dark:text-green-400",
    red: "text-red-500 dark:text-red-400",
    white: "text-white",
    gray: "text-gray-500 dark:text-gray-400",
    // New gradient options
    "blue-to-purple": "text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500",
    "green-to-blue": "text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-blue-500"
  };
  
  // Thickness variants
  const thicknessClasses = {
    thin: "stroke-1",
    normal: "stroke-2",
    thick: "stroke-3"
  };

  // Custom animation speeds based on size
  const animationSpeed = size === "xs" || size === "sm" 
    ? "animate-spin-fast" 
    : size === "lg" || size === "xl" || size === "2xl" 
      ? "animate-spin-slow" 
      : "animate-spin";

  if (variant === "dots") {
    return (
      <div className={`flex space-x-1 ${className}`}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`rounded-full ${colorClasses[color]?.replace('text-', 'bg-') || 'bg-blue-500 dark:bg-blue-400'}`}
            style={{
              width: parseInt(sizeClasses[size]?.split(' ')[1]?.split('-')[1]) / 2 || 3,
              height: parseInt(sizeClasses[size]?.split(' ')[1]?.split('-')[1]) / 2 || 3,
              animation: `bounce 1.4s infinite ease-in-out both`,
              animationDelay: `${i * 0.16}s`
            }}
          ></div>
        ))}
      </div>
    );
  }

  if (variant === "bars") {
    return (
      <div className={`flex items-end space-x-1 h-${size === "xs" ? "4" : size === "sm" ? "6" : size === "md" ? "8" : "10"} ${className}`}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-1 rounded-t-sm ${colorClasses[color]?.replace('text-', 'bg-') || 'bg-blue-500 dark:bg-blue-400'}`}
            style={{
              height: '30%',
              animation: 'barLoader 1s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`
            }}
          ></div>
        ))}
      </div>
    );
  }
  
  if (variant === "horizontal") {
    return (
      <div className={`w-full overflow-hidden rounded-full h-${size === "xs" ? "1" : size === "sm" ? "1.5" : "2"} ${className}`}>
        <div className={`h-full ${colorClasses[color]?.replace('text-', 'bg-') || 'bg-blue-500 dark:bg-blue-400'} animate-horizontal-loader`}></div>
      </div>
    );
  }
  
  // Default circular spinner
  return (
    <div className={`relative ${className}`}>
      {/* Main spinner */}
      <svg
        className={`${sizeClasses[size] || sizeClasses.md} 
                  ${colorClasses[color] || colorClasses.blue} 
                  ${animationSpeed}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        data-testid="loading-spinner"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth={thicknessClasses[thickness] || thicknessClasses.normal}
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      
      {/* Pulse effect around spinner for medium and larger sizes */}
      {(size === "md" || size === "lg" || size === "xl" || size === "2xl") && (
        <span className={`absolute inset-0 rounded-full animate-ping-slow opacity-30 ${colorClasses[color] || colorClasses.blue}`}></span>
      )}
    </div>
  );
}

// Enhanced spinner with text label
export function LoadingSpinnerWithLabel({ 
  size = "md", 
  color = "blue", 
  label = "Loading...", 
  className = "",
  variant = "circular",
  labelPosition = "bottom" // "bottom", "right", "left"
}) {
  const containerDirection = labelPosition === "bottom" ? "flex-col" : labelPosition === "right" ? "flex-row" : "flex-row-reverse";
  const labelSpacing = labelPosition === "bottom" ? "mt-2" : "mx-2";
  
  return (
    <div className={`flex ${containerDirection} items-center justify-center ${className}`}>
      <LoadingSpinner size={size} color={color} variant={variant} />
      <span className={`${labelSpacing} text-sm font-medium ${color === "white" ? "text-white" : "text-gray-600 dark:text-gray-300"}`}>
        {label}
      </span>
    </div>
  );
}

// New progress bar with percentage
export function ProgressBar({ 
  progress = 0, 
  color = "blue", 
  height = "md",
  showPercentage = true,
  className = "" 
}) {
  const heightClasses = {
    xs: "h-1",
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
    xl: "h-4"
  };
  
  const bgColorClasses = {
    blue: "bg-blue-500 dark:bg-blue-400",
    indigo: "bg-indigo-500 dark:bg-indigo-400",
    purple: "bg-purple-500 dark:bg-purple-400",
    green: "bg-green-500 dark:bg-green-400",
    red: "bg-red-500 dark:bg-red-400",
  };
  
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between mb-1">
        {showPercentage && (
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{Math.round(progress)}%</span>
        )}
      </div>
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${heightClasses[height] || heightClasses.md}`}>
        <div 
          className={`${heightClasses[height] || heightClasses.md} ${bgColorClasses[color] || bgColorClasses.blue} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}