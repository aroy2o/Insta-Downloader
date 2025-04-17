import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { LoadingSpinner, LoadingSpinnerWithLabel, ProgressBar } from './LoadingSpinner';

export function DownloadStatus() {
  const status = useSelector(state => state.ui.status);
  const error = useSelector(state => state.ui.error);
  const progress = useSelector(state => state.download.progress);
  
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  
  // Control animation on status change
  useEffect(() => {
    if (status === 'idle') {
      setAnimating(false);
      const timeout = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timeout);
    } else {
      setVisible(true);
      setAnimating(true);
    }
  }, [status]);
  
  if (!visible) return null;
  
  // Status messages with emoji for visual cues
  const statusMessages = {
    fetching_preview: "Fetching media preview...",
    fetching_post: "Retrieving post details...",
    fetching_stories: "Loading Instagram stories...",
    fetching_reel: "Processing Instagram reel...",
    downloading: "Downloading media...",
    success: "Download complete!",
    error: "Error occurred"
  };

  // Status icons for different states
  const statusIcons = {
    fetching_preview: "🔍",
    fetching_post: "📸",
    fetching_stories: "⏱️",
    fetching_reel: "🎬",
    downloading: "💾",
    success: "✅",
    error: "❌"
  };
  
  // Select spinner variant based on status
  const getSpinnerVariant = () => {
    if (status === 'downloading') return 'horizontal';
    if (status === 'fetching_stories') return 'dots';
    if (status === 'fetching_reel') return 'bars';
    return 'circular';
  };
  
  // Select spinner color based on status
  const getSpinnerColor = () => {
    if (status === 'downloading') return 'blue-to-purple';
    if (status === 'fetching_stories') return 'purple';
    if (status === 'fetching_reel') return 'indigo';
    if (status === 'fetching_post') return 'green';
    return 'blue';
  };
  
  return (
    <div className={`fixed bottom-4 right-4 max-w-xs w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg transition-all duration-300 ease-in-out ${animating ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
      <div className="p-4">
        {status === 'success' ? (
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <span className="text-xl">{statusIcons[status]}</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {statusMessages[status]}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your media is ready for viewing
              </p>
            </div>
          </div>
        ) : status === 'error' ? (
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <span className="text-xl">{statusIcons[status]}</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {statusMessages[status]}
              </p>
              <p className="text-sm text-red-500 dark:text-red-400">
                {error || "Something went wrong. Please try again."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="text-xl">{statusIcons[status] || '🔄'}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {statusMessages[status] || 'Processing...'}
                </p>
                {status === 'downloading' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {progress < 100 ? `${Math.round(progress)}% complete` : 'Almost done...'}
                  </p>
                )}
              </div>
            </div>
            
            {status === 'downloading' ? (
              <ProgressBar 
                progress={progress} 
                color={progress > 80 ? "green" : progress > 40 ? "blue" : "purple"} 
                height="md" 
                showPercentage={false} 
                className="mt-2"
              />
            ) : (
              <LoadingSpinnerWithLabel
                variant={getSpinnerVariant()}
                color={getSpinnerColor()}
                size="sm"
                label={statusMessages[status] || 'Processing...'}
                labelPosition="right"
                className="mt-2"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
