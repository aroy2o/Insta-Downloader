import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { shimmerPlaceholder } from '../utils/mediaHelper';

export function MediaPreview({ mediaItems, onDownload, isLoading = {} }) {
  const [loadErrors, setLoadErrors] = useState({});
  const [loadedMedia, setLoadedMedia] = useState({});
  const [hoveredItemIndex, setHoveredItemIndex] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [animateIn, setAnimateIn] = useState({});

  // Animation trigger when media items change
  useEffect(() => {
    if (!mediaItems || mediaItems.length === 0) return;
    
    // Stagger animations
    mediaItems.forEach((item, index) => {
      setTimeout(() => {
        setAnimateIn(prev => ({
          ...prev,
          [index]: true
        }));
      }, 150 * index); // Stagger each item animation
    });
    
    return () => setAnimateIn({});
  }, [mediaItems]);

  // Pre-load images to avoid UI glitches
  useEffect(() => {
    if (!mediaItems || mediaItems.length === 0) return;
    
    mediaItems.forEach(item => {
      if (item.media_type === 'image' && !loadedMedia[item.url]) {
        const img = new Image();
        img.src = getProxyUrl(item.url);
        img.onload = () => {
          setLoadedMedia(prev => ({
            ...prev,
            [item.url]: true
          }));
        };
        img.onerror = () => {
          setLoadErrors(prev => ({
            ...prev,
            [item.url]: true
          }));
        };
      }
    });
  }, [mediaItems]);

  if (!mediaItems || mediaItems.length === 0) {
    return (
      <div className="mt-6 p-8 bg-gray-50 dark:bg-gray-800 rounded-2xl text-center border border-gray-200 dark:border-gray-700 transform transition-all duration-500 hover:shadow-lg animate-fadeIn backdrop-blur-sm bg-opacity-90">
        <div className="flex flex-col items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 animate-float" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-6 text-lg font-medium text-gray-700 dark:text-gray-300">No media items to preview</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
            Enter an Instagram URL above and click Extract Media to see content here
          </p>
          <div className="mt-6">
            <div className="animate-pulse flex space-x-3">
              <div className="h-2 w-2 bg-blue-400 dark:bg-blue-600 rounded-full"></div>
              <div className="h-2 w-2 bg-blue-400 dark:bg-blue-600 rounded-full"></div>
              <div className="h-2 w-2 bg-blue-400 dark:bg-blue-600 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Function to safely handle media URLs
  const getProxyUrl = (url) => {
    if (!url) return shimmerPlaceholder();
    try {
      // Make sure we're using the correct proxy endpoint with proper URL encoding
      return `/api/media?url=${encodeURIComponent(url)}`;
    } catch (e) {
      console.error("Error encoding URL:", e);
      return shimmerPlaceholder();
    }
  };

  // Helper to get filename from URL
  const getMediaFilename = (url) => {
    try {
      const urlPath = new URL(url).pathname;
      const fileName = urlPath.split('/').pop();
      return fileName || 'instagram-media';
    } catch (e) {
      return 'instagram-media';
    }
  };

  // Handle expanding/collapsing image
  const toggleExpand = (index) => {
    if (expandedItem === index) {
      setExpandedItem(null);
    } else {
      setExpandedItem(index);
    }
  };

  // Determine if it's the first item in a row (for layout purposes)
  const isFirstInRow = (index) => {
    // For mobile, every item is first in row
    if (window.innerWidth < 640) return true;
    // For tablet, every other item is first in row
    if (window.innerWidth < 1024) return index % 2 === 0;
    // For desktop, every third item is first in row
    return index % 3 === 0;
  };

  return (
    <>
      {/* Expanded media overlay */}
      {expandedItem !== null && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setExpandedItem(null)}
        >
          <div 
            className="relative max-w-5xl max-h-[90vh] animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {mediaItems[expandedItem].media_type === 'video' ? (
              <video 
                src={getProxyUrl(mediaItems[expandedItem].url)} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                controls
                autoPlay
                poster={mediaItems[expandedItem].thumbnail_url ? getProxyUrl(mediaItems[expandedItem].thumbnail_url) : undefined}
              />
            ) : (
              <img 
                src={getProxyUrl(mediaItems[expandedItem].url)} 
                alt={`Media item ${expandedItem + 1}`}
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            )}
            <button 
              onClick={() => setExpandedItem(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white transition-all duration-200 transform hover:scale-110"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 right-4 flex space-x-3">
              <button
                onClick={() => onDownload(mediaItems[expandedItem])}
                className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 transform hover:scale-110 shadow-lg flex items-center justify-center group"
                title="Download media"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300 group-hover:translate-y-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Media grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
        {mediaItems.map((item, index) => (
          <div 
            key={`${index}-${item.url}`} 
            className={`card-modern relative rounded-xl overflow-hidden group shadow-md hover:shadow-xl transition-all duration-300 ${
              animateIn[index] ? 'transform-gpu opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: `${index * 100}ms` }}
            onMouseEnter={() => setHoveredItemIndex(index)}
            onMouseLeave={() => setHoveredItemIndex(null)}
          >
            {/* Loading indicator */}
            {isLoading[item.url] && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10 backdrop-blur-sm animate-fadeIn">
                <div className="flex flex-col items-center">
                  <LoadingSpinner size="lg" color="blue" />
                  <span className="mt-3 text-sm font-medium text-white">Downloading...</span>
                  <div className="mt-2 w-32 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-progress"></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Media Preview */}
            <div 
              className={`aspect-w-1 aspect-h-1 bg-gray-100 dark:bg-gray-900 relative overflow-hidden cursor-pointer`}
              onClick={() => toggleExpand(index)}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
              
              {item.media_type === 'video' ? (
                <>
                  <video 
                    src={getProxyUrl(item.url)} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    poster={item.thumbnail_url ? getProxyUrl(item.thumbnail_url) : undefined}
                    preload="metadata"
                    onError={(e) => {
                      console.error("Video load error:", e);
                      e.target.onerror = null;
                      setLoadErrors(prev => ({...prev, [item.url]: true}));
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className={`w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all duration-300 transform-gpu ${
                      hoveredItemIndex === index ? 'scale-110 bg-white/40' : 'scale-100'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                  {!loadedMedia[item.url] && !loadErrors[item.url] ? (
                    <div className="w-full h-full shimmer"></div>
                  ) : (
                    <img 
                      src={loadErrors[item.url] ? shimmerPlaceholder() : getProxyUrl(item.url)}
                      alt={`Media item ${index + 1}`} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        console.error("Image load error:", e);
                        e.target.onerror = null;
                        setLoadErrors(prev => ({...prev, [item.url]: true}));
                      }}
                    />
                  )}
                </div>
              )}
              
              {/* Expanding hint icon */}
              <div className={`absolute top-2 right-2 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white transform transition-all duration-300 z-20 ${
                hoveredItemIndex === index ? 'scale-110 opacity-100 rotate-0' : 'scale-90 opacity-0 rotate-90'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </div>
              
              {/* Media Type Badge with animation */}
              <div className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-xs font-medium bg-black/60 backdrop-blur-sm text-white transition-all duration-300 flex items-center space-x-1 ${
                hoveredItemIndex === index ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
              }`}>
                {item.media_type === 'video' ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform duration-500 ${hoveredItemIndex === index ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Video</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform duration-500 ${hoveredItemIndex === index ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Image</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Media Info & Download with animation */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {getMediaFilename(item.url)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center">
                    {item.media_type === 'video' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    )}
                    {item.media_type === 'video' ? 'Video' : 'Image'} {index + 1}
                  </p>
                </div>
                
                <div className="ml-2 flex space-x-2">
                  {/* Quick view button */}
                  <button
                    onClick={() => toggleExpand(index)}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-150 group"
                    title="View larger"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" 
                      className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  
                  {/* Download button with animations */}
                  <button
                    onClick={() => onDownload(item)}
                    disabled={isLoading[item.url]}
                    className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 dark:bg-blue-900/40 dark:hover:bg-blue-800/60 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-150 relative group"
                    title="Download media"
                  >
                    {isLoading[item.url] ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" 
                          className="h-5 w-5 transition-all duration-300 group-hover:translate-y-0.5" 
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        {/* Pulse effect on hover */}
                        <span className="absolute inset-0 rounded-full bg-blue-400/40 group-hover:animate-ping opacity-0 group-hover:opacity-100"></span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Progress indicator (shown when loading) */}
            {isLoading[item.url] && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 animate-progress-pulse"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}