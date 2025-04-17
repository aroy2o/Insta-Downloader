// filepath: /home/abhijeetroy/Pictures/abcdse/Insta/frontend/src/components/StoryCarousel.jsx
import React, { useState, useEffect, useRef } from 'react';

export function StoryCarousel({ mediaItems, onStorySelect }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState({});
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState({});
  const carouselRef = useRef(null);
  
  // Preload the images for smoother transitions
  useEffect(() => {
    mediaItems.forEach(item => {
      if (item.media_type === 'image' && !preloadedImages[item.url]) {
        const img = new Image();
        img.src = `/api/download/media-proxy?url=${encodeURIComponent(item.url)}`;
        
        img.onload = () => {
          setPreloadedImages(prev => ({
            ...prev,
            [item.url]: true
          }));
        };
      }
    });
  }, [mediaItems, preloadedImages]);
  
  // Auto-advance functionality
  useEffect(() => {
    let timer;
    if (autoAdvance && mediaItems.length > 1) {
      timer = setInterval(() => {
        setCurrentIndex(prevIndex => 
          prevIndex < mediaItems.length - 1 ? prevIndex + 1 : 0
        );
      }, 3000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoAdvance, mediaItems.length]);
  
  // Ensure carousel scrolls to show the selected item
  useEffect(() => {
    if (carouselRef.current) {
      const scrollContainer = carouselRef.current;
      const items = scrollContainer.querySelectorAll('.story-item');
      const selectedItem = items[currentIndex];
      
      if (selectedItem) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const itemRect = selectedItem.getBoundingClientRect();
        
        // Center the selected item in the view
        const scrollLeftTarget = (
          selectedItem.offsetLeft - 
          (containerRect.width / 2) + 
          (itemRect.width / 2)
        );
        
        scrollContainer.scrollTo({
          left: scrollLeftTarget,
          behavior: 'smooth'
        });
      }
    }
  }, [currentIndex]);
  
  const goToNext = () => {
    setCurrentIndex(prevIndex => 
      prevIndex < mediaItems.length - 1 ? prevIndex + 1 : 0
    );
  };
  
  const goToPrevious = () => {
    setCurrentIndex(prevIndex => 
      prevIndex > 0 ? prevIndex - 1 : mediaItems.length - 1
    );
  };
  
  // Select current story item for display
  const selectStory = (index) => {
    setCurrentIndex(index);
    onStorySelect(mediaItems[index]);
  };

  if (!mediaItems || mediaItems.length === 0) {
    return null;
  }
  
  const currentItem = mediaItems[currentIndex];
  
  return (
    <div className="bg-gray-900 rounded-lg shadow-xl overflow-hidden">
      {/* Story display header with indicators */}
      <div className="p-3 flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center">
          <span className="bg-blue-500 p-1 rounded text-white mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z" clipRule="evenodd" />
              <path d="M7 7h6v6H7V7z" />
            </svg>
          </span>
          <h3 className="font-medium text-white text-sm md:text-base">Stories</h3>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => setAutoAdvance(!autoAdvance)}
            className={`p-1.5 rounded-full mr-2 ${autoAdvance ? 'bg-blue-600' : 'bg-gray-700'} text-white`}
            title={autoAdvance ? "Stop Auto-Advance" : "Auto-Advance"}
          >
            {autoAdvance ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <span className="text-xs text-gray-400">
            {currentIndex + 1}/{mediaItems.length}
          </span>
        </div>
      </div>
      
      {/* Progress indicators */}
      <div className="flex px-2 pt-2 gap-1">
        {mediaItems.map((_, idx) => (
          <div
            key={idx}
            className="relative h-0.5 flex-grow rounded-full overflow-hidden bg-gray-700 cursor-pointer"
            onClick={() => selectStory(idx)}
          >
            <div 
              className={`absolute left-0 top-0 h-full ${
                idx === currentIndex 
                  ? 'bg-blue-500 animate-progress-stripe' 
                  : idx < currentIndex ? 'bg-blue-500' : 'bg-transparent'
              }`}
              style={{ width: idx === currentIndex && autoAdvance ? '100%' : (idx < currentIndex ? '100%' : '0%') }}
            ></div>
          </div>
        ))}
      </div>
      
      {/* Main carousel for stories */}
      <div className="relative">
        <div 
          ref={carouselRef}
          className="flex overflow-x-auto py-4 px-2 hide-scrollbar snap-x snap-mandatory"
        >
          {mediaItems.map((item, index) => (
            <div 
              key={index}
              className={`story-item flex-shrink-0 w-28 mx-1 snap-start cursor-pointer ${
                index === currentIndex ? 'scale-105 transition-transform' : ''
              }`}
              onClick={() => selectStory(index)}
            >
              <div className={`overflow-hidden rounded-md border-2 ${
                index === currentIndex ? 'border-blue-500' : 'border-transparent'
              }`}>
                <div className="relative aspect-[9/16] bg-gray-800">
                  {item.media_type === 'video' ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/60 rounded-full p-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  ) : null}
                  
                  <img
                    src={`/api/download/media-proxy?url=${encodeURIComponent(item.url)}&thumbnail=true`}
                    alt={`Story ${index + 1}`}
                    className="h-full w-full object-cover transition-all"
                    loading={index < 5 ? "eager" : "lazy"}
                  />
                  
                  {/* Overlay when loading */}
                  {isLoading[item.url] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-1.5 flex justify-center">
                <div className={`h-1 w-1 rounded-full ${
                  index === currentIndex ? 'bg-blue-500' : 'bg-gray-600'
                }`}></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Navigation buttons */}
        {mediaItems.length > 4 && (
          <>
            <button 
              onClick={goToPrevious}
              className="absolute left-1 top-1/2 transform -translate-y-1/2 p-1 bg-black/50 rounded-full text-white z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button 
              onClick={goToNext}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 bg-black/50 rounded-full text-white z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4-4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}
      </div>
      
      {/* Selected story info */}
      <div className="p-3 flex justify-between items-center border-t border-gray-800">
        <div className="text-xs text-gray-400">
          {currentItem.media_type === 'video' ? (
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Video Story
            </span>
          ) : (
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z" clipRule="evenodd" />
              </svg>
              Image Story
            </span>
          )}
        </div>
        <button
          onClick={() => selectStory(currentIndex)}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          View Full
        </button>
      </div>
    </div>
  );
}