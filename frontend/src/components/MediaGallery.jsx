import React from 'react';
import { useSelector } from 'react-redux';
import { LoadingSpinner } from './LoadingSpinner';

export function MediaGallery() {
  // Get files from Redux store instead of props
  const files = useSelector(state => state.download.files);

  if (!files || files.length === 0) {
    return (
      <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
        <p className="text-gray-500 dark:text-gray-400">No downloaded files yet</p>
      </div>
    );
  }

  // Function to safely handle media URLs for downloaded content
  const getProxyUrl = (url) => {
    if (!url) return '/placeholder-image.jpg';
    try {
      return `/api/download/media-proxy?url=${encodeURIComponent(url)}`;
    } catch (e) {
      console.error("Error encoding URL:", e);
      return '/placeholder-image.jpg';
    }
  };

  // Group files by date (today, yesterday, older)
  const groupFilesByDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const groups = {
      today: [],
      yesterday: [],
      older: []
    };
    
    files.forEach(file => {
      const downloadDate = new Date(file.downloadedAt);
      downloadDate.setHours(0, 0, 0, 0);
      
      if (downloadDate.getTime() === today.getTime()) {
        groups.today.push(file);
      } else if (downloadDate.getTime() === yesterday.getTime()) {
        groups.yesterday.push(file);
      } else {
        groups.older.push(file);
      }
    });
    
    return groups;
  };
  
  const groupedFiles = groupFilesByDate();
  
  return (
    <div className="mt-6 space-y-8">
      {/* Today's downloads */}
      {groupedFiles.today.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Today</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedFiles.today.map((file, index) => (
              <MediaCard key={`today-${index}`} file={file} getProxyUrl={getProxyUrl} />
            ))}
          </div>
        </div>
      )}
      
      {/* Yesterday's downloads */}
      {groupedFiles.yesterday.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Yesterday</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedFiles.yesterday.map((file, index) => (
              <MediaCard key={`yesterday-${index}`} file={file} getProxyUrl={getProxyUrl} />
            ))}
          </div>
        </div>
      )}
      
      {/* Older downloads */}
      {groupedFiles.older.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Older</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedFiles.older.map((file, index) => (
              <MediaCard key={`older-${index}`} file={file} getProxyUrl={getProxyUrl} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MediaCard({ file, getProxyUrl }) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  
  const handleLoaded = () => {
    setIsLoading(false);
  };
  
  const handleError = () => {
    setIsLoading(false);
    setLoadError(true);
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200 hover:shadow-lg">
      {/* Media preview */}
      <div className="aspect-w-16 aspect-h-9 bg-gray-100 dark:bg-gray-900 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
            <LoadingSpinner size="md" />
          </div>
        )}
        
        {file.type === 'video' ? (
          <video 
            className="w-full h-full object-contain"
            src={getProxyUrl(file.url)}
            poster={file.thumbnail ? getProxyUrl(file.thumbnail) : undefined}
            preload="metadata"
            onLoadedMetadata={handleLoaded}
            onError={handleError}
            controls
          />
        ) : (
          <img 
            className="w-full h-full object-contain" 
            src={loadError ? '/placeholder-image.jpg' : getProxyUrl(file.url)}
            alt={file.filename}
            onLoad={handleLoaded}
            onError={handleError}
          />
        )}
        
        {/* Type badge */}
        <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold bg-black/60 text-white">
          {file.type === 'video' ? 'Video' : 'Image'}
        </div>
      </div>
      
      {/* File info */}
      <div className="p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1" title={file.filename}>
          {file.filename}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Downloaded at {formatDate(file.downloadedAt)}
        </p>
      </div>
    </div>
  );
}
