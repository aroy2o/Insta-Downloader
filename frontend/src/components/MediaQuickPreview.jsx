import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

export function MediaQuickPreview({ mediaItems, onDownload, onViewFullPreview }) {
  const [selectedItem, setSelectedItem] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  
  if (!mediaItems || mediaItems.length === 0) {
    return null;
  }
  
  const currentItem = mediaItems[selectedItem];
  const isMultiple = mediaItems.length > 1;
  
  // Reset media ready state when selected item changes
  useEffect(() => {
    setMediaReady(false);
    setLoadError(false);
  }, [selectedItem]);

  const handleDownload = async (item = currentItem) => {
    setIsLoading(true);
    try {
      await onDownload(item);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to get proxy URL for media
  const getProxyUrl = (url) => {
    if (!url) return '/placeholder-image.jpg';
    try {
      return `/api/media?url=${encodeURIComponent(url)}`;
    } catch (e) {
      console.error("Error encoding URL:", e);
      return '/placeholder-image.jpg';
    }
  };

  // Move to previous item
  const goToPrevious = () => {
    if (selectedItem > 0) {
      setSelectedItem(selectedItem - 1);
    } else {
      setSelectedItem(mediaItems.length - 1); // Loop to last item
    }
  };

  // Move to next item
  const goToNext = () => {
    if (selectedItem < mediaItems.length - 1) {
      setSelectedItem(selectedItem + 1);
    } else {
      setSelectedItem(0); // Loop to first item
    }
  };
  
  return (
    <div className="mt-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Media Preview
        </h2>
        
        <div className="flex space-x-2">
          {/* "View Full" button */}
          <button
            onClick={onViewFullPreview}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            View Full Gallery
          </button>
        </div>
      </div>
      
      {/* Media display */}
      <div className="relative p-4 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
        <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden bg-black relative">
          {/* Loading indicator */}
          {!mediaReady && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
              <LoadingSpinner size="lg" color="blue" />
            </div>
          )}
          
          {currentItem.media_type === 'video' ? (
            <video
              src={getProxyUrl(currentItem.url)}
              className="w-full h-full object-contain"
              controls
              poster={currentItem.thumbnail_url ? getProxyUrl(currentItem.thumbnail_url) : undefined}
              onLoadedData={() => setMediaReady(true)}
              onError={(e) => {
                console.error("Video load error:", e);
                e.target.onerror = null;
                setLoadError(true);
              }}
            />
          ) : (
            <img
              src={loadError ? '/placeholder-image.jpg' : getProxyUrl(currentItem.url)}
              alt={`Media preview ${selectedItem + 1}`}
              className="w-full h-full object-contain"
              onLoad={() => setMediaReady(true)}
              onError={(e) => {
                console.error("Image load error:", e);
                e.target.onerror = null;
                setLoadError(true);
              }}
            />
          )}
          
          {/* Navigation buttons for multiple items */}
          {isMultiple && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none z-10"
                aria-label="Previous media"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNext}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none z-10"
                aria-label="Next media"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          
          {/* Media type badge */}
          <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold bg-black/60 text-white">
            {currentItem.media_type === 'video' ? 'Video' : 'Image'} {selectedItem + 1} of {mediaItems.length}
          </div>
        </div>
      </div>
      
      {/* Actions footer */}
      <div className="flex justify-between items-center mt-4 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {mediaItems.length > 1 ? (
            <span>
              {selectedItem + 1} of {mediaItems.length} items 
              {currentItem.media_type === 'video' ? ' (Video)' : ' (Image)'}
            </span>
          ) : (
            <span>{currentItem.media_type === 'video' ? 'Video' : 'Image'}</span>
          )}
        </div>
        
        <button
          onClick={() => handleDownload(currentItem)}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" color="white" className="inline mr-2" />
              Downloading...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </>
          )}
        </button>
      </div>
    </div>
  );
}
