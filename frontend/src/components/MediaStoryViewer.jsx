import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

export function MediaStoryViewer({ mediaItems, onDownload, isLoading }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadErrors, setLoadErrors] = useState({});
  const [preloadedMedia, setPreloadedMedia] = useState({});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [mediaReady, setMediaReady] = useState({});
  const progressTimersRef = useRef([]);
  const containerRef = useRef(null);
  const currentMediaRef = useRef(null);

  if (!mediaItems || mediaItems.length === 0) {
    return null;
  }

  // Clear any active timeouts when unmounting or when stories change
  useEffect(() => {
    return () => {
      progressTimersRef.current.forEach(timeout => clearTimeout(timeout));
      progressTimersRef.current = [];
    };
  }, [mediaItems]);

  // Preload the next and previous images for smoother navigation
  useEffect(() => {
    if (!mediaItems.length) return;

    // Function to preload an image or video at a given index
    const preloadMedia = (index) => {
      if (
        index >= 0 &&
        index < mediaItems.length &&
        !preloadedMedia[mediaItems[index].url]
      ) {
        const url = mediaItems[index].url;
        const isVideo = mediaItems[index].media_type === 'video';

        if (isVideo) {
          // For videos, we'll just mark as preloaded and rely on browser caching
          setPreloadedMedia(prev => ({
            ...prev,
            [url]: true
          }));
        } else {
          // For images, actually preload them
          const img = new Image();
          img.src = `/api/media?url=${encodeURIComponent(url)}`;
          img.onload = () => {
            setPreloadedMedia(prev => ({
              ...prev,
              [url]: true
            }));
          };
          img.onerror = () => {
            setLoadErrors(prev => ({
              ...prev,
              [url]: true
            }));
          };
        }
      }
    };

    // Preload current, next, and previous media
    preloadMedia(currentIndex);
    preloadMedia(currentIndex + 1);
    preloadMedia(currentIndex - 1);

  }, [currentIndex, mediaItems, preloadedMedia]);

  // Handle autoplay functionality
  useEffect(() => {
    // Clear any existing timers
    progressTimersRef.current.forEach(timer => clearTimeout(timer));
    progressTimersRef.current = [];

    if (autoplayEnabled && mediaItems.length > 1 && mediaReady[mediaItems[currentIndex]?.url]) {
      const duration = mediaItems[currentIndex].media_type === 'video' ? 
        (currentMediaRef.current?.duration * 1000 || 10000) : 5000; // 5s for images, video duration for videos
      
      const timeout = setTimeout(() => {
        setCurrentIndex(prevIndex =>
          prevIndex < mediaItems.length - 1 ? prevIndex + 1 : 0
        );
      }, duration);

      progressTimersRef.current.push(timeout);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [autoplayEnabled, currentIndex, mediaItems, mediaReady]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex > 0 ? prevIndex - 1 : mediaItems.length - 1));

    // Reset progress timeouts when navigating manually
    progressTimersRef.current.forEach(timeout => clearTimeout(timeout));
    progressTimersRef.current = [];
  }, [mediaItems.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex < mediaItems.length - 1 ? prevIndex + 1 : 0));

    // Reset progress timeouts when navigating manually
    progressTimersRef.current.forEach(timeout => clearTimeout(timeout));
    progressTimersRef.current = [];
  }, [mediaItems.length]);

  // Toggle fullscreen mode
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
    
    // Give time for the state to update and then request fullscreen
    setTimeout(() => {
      if (!isFullScreen && containerRef.current) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen();
        } else if (containerRef.current.webkitRequestFullscreen) {
          containerRef.current.webkitRequestFullscreen();
        } else if (containerRef.current.msRequestFullscreen) {
          containerRef.current.msRequestFullscreen();
        }
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }, 100);
  }, [isFullScreen]);

  // Toggle autoplay
  const toggleAutoplay = useCallback(() => {
    setAutoplayEnabled(prev => !prev);
  }, []);

  // Handle download action
  const handleDownload = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < mediaItems.length) {
      const item = mediaItems[currentIndex];
      onDownload(item);
    }
  }, [currentIndex, mediaItems, onDownload]);

  // Current media item
  const currentItem = mediaItems[currentIndex];
  
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

  // Handle media loaded event
  const handleMediaLoaded = (url) => {
    setMediaReady(prev => ({
      ...prev,
      [url]: true
    }));
  };

  // Handle media error event
  const handleMediaError = (url) => {
    console.error(`Failed to load media: ${url}`);
    setLoadErrors(prev => ({
      ...prev,
      [url]: true
    }));
  };

  return (
    <div 
      ref={containerRef}
      className={`media-story-viewer relative ${
        isFullScreen ? 'fixed inset-0 z-50 bg-black' : 'min-h-[50vh] md:min-h-[70vh]'
      } rounded-lg overflow-hidden shadow-xl`}
    >
      <div className="flex flex-col h-full bg-gray-900">
        {/* Progress indicators */}
        <div className="flex justify-center space-x-1 p-2">
          {mediaItems.map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full flex-1 ${
                index === currentIndex ? 'bg-blue-500' : 
                index < currentIndex ? 'bg-gray-200 dark:bg-gray-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
              onClick={() => setCurrentIndex(index)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </div>

        {/* Controls header */}
        <div className="flex justify-between items-center p-2 border-b border-gray-800">
          {/* Left: Counter */}
          <div className="text-white text-sm font-medium">
            {currentIndex + 1} / {mediaItems.length}
          </div>

          {/* Right: Action buttons */}
          <div className="flex space-x-2">
            <button
              onClick={toggleAutoplay}
              className={`p-2 rounded-full ${
                autoplayEnabled ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
              } hover:opacity-80 focus:outline-none`}
              title={autoplayEnabled ? 'Pause autoplay' : 'Enable autoplay'}
            >
              {autoplayEnabled ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            <button
              onClick={toggleFullScreen}
              className="p-2 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 focus:outline-none"
              title={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
            >
              {isFullScreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 4a1 1 0 00-1 1v4a1 1 0 01-1 1H1a1 1 0 010-2h1V5a3 3 0 013-3h4a1 1 0 010 2H5zm10 8h-1v3a1 1 0 01-1 1H9a1 1 0 110 2h4a3 3 0 003-3v-4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            <button
              onClick={handleDownload}
              disabled={isLoading[currentItem.url]}
              className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download current item"
            >
              {isLoading[currentItem.url] ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="relative flex-grow flex items-center justify-center bg-black">
          {/* Navigation buttons */}
          {mediaItems.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none z-10"
                aria-label="Previous"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNext}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none z-10"
                aria-label="Next"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Media display */}
          <div className="w-full h-full flex items-center justify-center">
            {/* Loading indicator */}
            {!mediaReady[currentItem.url] && !loadErrors[currentItem.url] && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                <LoadingSpinner size="lg" color="blue" />
              </div>
            )}

            {/* Actual media */}
            {currentItem.media_type === 'video' ? (
              <video
                ref={currentMediaRef}
                className="max-h-full max-w-full object-contain"
                src={loadErrors[currentItem.url] ? '/placeholder-video.jpg' : getProxyUrl(currentItem.url)}
                controls
                poster={currentItem.thumbnail_url ? getProxyUrl(currentItem.thumbnail_url) : undefined}
                onLoadedData={() => handleMediaLoaded(currentItem.url)}
                onError={() => handleMediaError(currentItem.url)}
                autoPlay={autoplayEnabled}
                playsInline
              />
            ) : (
              <img
                ref={currentMediaRef}
                className="max-h-full max-w-full object-contain"
                src={loadErrors[currentItem.url] ? '/placeholder-image.jpg' : getProxyUrl(currentItem.url)}
                alt={`Story ${currentIndex + 1}`}
                onLoad={() => handleMediaLoaded(currentItem.url)}
                onError={() => handleMediaError(currentItem.url)}
              />
            )}
          </div>

          {/* Media type badge */}
          <div className="absolute top-4 right-4 px-2 py-1 text-xs font-semibold bg-black/70 text-white rounded">
            {currentItem.media_type === 'video' ? 'Video' : 'Image'} {currentIndex + 1}
          </div>
        </div>
      </div>
    </div>
  );
}