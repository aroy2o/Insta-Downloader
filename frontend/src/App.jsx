import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { DownloadForm } from './components/DownloadForm';
import { DownloadStatus } from './components/DownloadStatus';
import { MediaGallery } from './components/MediaGallery';
import { MediaPreview } from './components/MediaPreview';
import { MediaStoryViewer } from './components/MediaStoryViewer';
import { MediaQuickPreview } from './components/MediaQuickPreview';
import { DebugPanel } from './DebugPanel';
import { isInstagramUrl, ensureAbsoluteUrl } from './utils/mediaHelper';

// Import Redux actions and selectors
import { setMediaFiles, addMediaFile, setPreviewItems, setContentType, setPreviewResponse } from './store/slices/mediaSlice';
import { 
  setStatus, setError, setHeaderCollapsed, setScrolled, 
  setActiveTab, setShowFullPreview, setShowDebugPanel, 
  toggleTheme as toggleThemeAction, selectTheme, selectStatus,
  selectError, selectIsHeaderCollapsed, selectIsScrolled,
  selectActiveTab, selectShowFullPreview, selectShowDebugPanel
} from './store/slices/uiSlice';
import { 
  setDownloadingItem, setDownloadResult, clearDownloadResult,
  selectDownloadingItems, selectDownloadResult
} from './store/slices/downloadSlice';

function App() {
  // Replace useState hooks with useSelector
  const status = useSelector(selectStatus);
  const mediaFiles = useSelector(state => state.media.mediaFiles);
  const previewItems = useSelector(state => state.media.previewItems);
  const contentType = useSelector(state => state.media.contentType);
  const error = useSelector(selectError);
  const downloadResult = useSelector(selectDownloadResult);
  const downloadingItems = useSelector(selectDownloadingItems);
  const isHeaderCollapsed = useSelector(selectIsHeaderCollapsed);
  const activeTab = useSelector(selectActiveTab);
  const showFullPreview = useSelector(selectShowFullPreview);
  const showDebugPanel = useSelector(selectShowDebugPanel);
  const previewResponse = useSelector(state => state.media.previewResponse);
  const isScrolled = useSelector(selectIsScrolled);
  const theme = useSelector(selectTheme);
  
  const dispatch = useDispatch();
  const formRef = useRef(null);

  // Apply theme to document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Handle scroll events to collapse header and add blur effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY > 20 && !isScrolled) {
        dispatch(setScrolled(true));
      } else if (scrollY <= 20 && isScrolled) {
        dispatch(setScrolled(false));
      }
      
      if (scrollY > 100 && !isHeaderCollapsed) {
        dispatch(setHeaderCollapsed(true));
      } else if (scrollY <= 100 && isHeaderCollapsed) {
        dispatch(setHeaderCollapsed(false));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHeaderCollapsed, isScrolled, dispatch]);

  // Toggle theme between light and dark
  const toggleTheme = () => {
    dispatch(toggleThemeAction());
  };

  // Update the downloadMedia function to handle both direct media item objects and URL strings
  const downloadMedia = async (mediaItem) => {
    if (!mediaItem) {
      dispatch(setError('Invalid media item to download'));
      return;
    }
    
    // Handle both object and string formats for backward compatibility
    const url = typeof mediaItem === 'string' ? mediaItem : mediaItem.url;
    const mediaType = typeof mediaItem === 'string' ? 'image' : (mediaItem.media_type || 'image');
    
    if (!url) {
      dispatch(setError('Invalid media URL to download'));
      return;
    }

    // Track download status by URL
    dispatch(setDownloadingItem({ url, isDownloading: true }));
    dispatch(setStatus('downloading'));

    const fileExtension = mediaType === 'video' ? 'mp4' : 'jpg';
    const filename = typeof mediaItem === 'object' && mediaItem.filename 
      ? mediaItem.filename 
      : `instagram_${mediaType}_${Date.now()}.${fileExtension}`;

    try {
      dispatch(setDownloadResult(`Downloading ${mediaType}...`));
      
      // Request the media through our proxy to avoid CORS issues
      const response = await fetch(`/api/media?url=${encodeURIComponent(url)}&download=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Set proper content type based on media type
      const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
      const finalBlob = new Blob([blob], { type: contentType });

      // Create a URL for the blob
      const blobUrl = window.URL.createObjectURL(finalBlob);

      // Create a download link and click it
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Clean up the blob URL
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);

      // Add to downloaded files list
      dispatch(addMediaFile({
        id: Date.now(),
        url,
        filename, 
        type: mediaType,
        downloadedAt: new Date().toISOString(),
        thumbnail: typeof mediaItem === 'object' && mediaItem.thumbnail_url ? mediaItem.thumbnail_url : url
      }));

      dispatch(setStatus('download_complete'));
      dispatch(setDownloadResult({ 
        success: true, 
        message: `${mediaType} downloaded successfully!` 
      }));
    } catch (error) {
      console.error('Download error:', error);
      dispatch(setStatus('download_failed'));
      dispatch(setDownloadResult({ 
        success: false, 
        message: `Download failed: ${error.message}` 
      }));
    } finally {
      // Clear download status
      dispatch(setDownloadingItem({ url, isDownloading: false }));
      
      // Reset status after a delay
      setTimeout(() => {
        // Only reset if we're still in a download status
        if (['downloading', 'download_complete', 'download_failed'].includes(status)) {
          dispatch(setStatus('preview_ready'));
        }
      }, 3000);
    }
  };

  const fetchPreview = async (url, selectedBrowser) => {
    if (!url.trim()) {
      dispatch(setError('Please enter an Instagram URL'));
      dispatch(setStatus('failed'));
      return;
    }

    dispatch(setError(''));
    dispatch(setShowFullPreview(false));
    dispatch(setPreviewItems([]));
    
    // Check if URL is a valid Instagram URL
    if (!isInstagramUrl(url)) {
      dispatch(setError('Please enter a valid Instagram URL (post, reel, story, or profile)'));
      dispatch(setStatus('failed'));
      return;
    }

    const browser = selectedBrowser || 'chrome';
    
    // Set appropriate status based on URL type
    if (url.includes('/stories/')) {
      dispatch(setStatus('fetching_stories'));
    } else if (url.includes('/reel/')) {
      dispatch(setStatus('fetching_reel')); 
    } else if (url.includes('/p/')) {
      dispatch(setStatus('fetching_post'));
    } else {
      dispatch(setStatus('fetching_preview'));
    }

    try {
      console.log('Sending preview request for:', url);
      console.log('Backend URL:', '/api/preview');
      console.log('Request payload:', JSON.stringify({ url, browser }));
      
      // Using the proxy configured in vite.config.js
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, browser }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        // Try to get error message from response
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server responded with status: ${response.status}`);
        } catch (jsonError) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
      }

      const result = await response.json();
      console.log('Preview response:', result);
      
      // Store full response for debugging regardless of success/failure
      dispatch(setPreviewResponse(result));

      if (result.success && result.media_items && result.media_items.length > 0) {
        // Process media items to ensure all required fields are present
        const processedItems = result.media_items.map((item) => ({
          ...item,
          media_type: item.media_type || 'image', // Default to image if not specified
          thumbnail_url: item.thumbnail_url || item.url, // Use main URL as thumbnail if not specified
          // Ensure URL is properly resolved if it's a relative URL
          url: ensureAbsoluteUrl(item.url)
        }));

        dispatch(setStatus('preview_ready'));
        dispatch(setPreviewItems(processedItems));
        dispatch(setContentType(result.content_type));
        
        // Automatically show full preview if we have items
        if (processedItems.length > 0) {
          dispatch(setShowFullPreview(true));
        }
        
        // Scroll to the preview section with smooth animation
        setTimeout(() => {
          if (formRef.current) {
            const yOffset = -100; // Account for sticky header
            const y = formRef.current.getBoundingClientRect().bottom + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        }, 300);
      } else {
        dispatch(setStatus('failed'));
        dispatch(setError(result.error || 'No media found. Try a different URL or browser option.'));
      }
    } catch (error) {
      dispatch(setStatus('failed'));
      dispatch(setError(`Failed to connect: ${error.message}`));
      console.error('Error fetching preview:', error);
      
      // Show the debug panel automatically when a connection error occurs
      dispatch(setShowDebugPanel(true));
    }
  };

  // Helper function to filter preview items for reels
  const getFilteredPreviewItems = () => {
    if (contentType === 'reel' && previewItems.length > 0) {
      // Only show the first video for reels
      const firstVideo = previewItems.find(item => item.media_type === 'video');
      return firstVideo ? [firstVideo] : [];
    }
    return previewItems;
  };

  // Handle form submission to get Instagram media
  const handleFormSubmit = async (url, browser) => {
    await fetchPreview(url, browser);
  };

  // Handle download of all items
  const handleDownloadAll = () => {
    if (!previewItems.length) {
      dispatch(setDownloadResult({ 
        success: false, 
        message: 'No items to download' 
      }));
      return;
    }
    
    previewItems.forEach((item, index) => {
      // Delay each download slightly to avoid overwhelming the browser
      setTimeout(() => {
        downloadMedia(item);
      }, index * 500);
    });
  };

  // Clear download result message after 5 seconds
  React.useEffect(() => {
    if (downloadResult) {
      const timer = setTimeout(() => {
        dispatch(clearDownloadResult());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [downloadResult, dispatch]);

  // Generate meta stats for the current preview items
  const getMetaStats = () => {
    if (!previewItems || previewItems.length === 0) return null;

    const videoCount = previewItems.filter((item) => item.media_type === 'video').length;
    const imageCount = previewItems.filter((item) => item.media_type === 'image').length;

    return {
      total: previewItems.length,
      videos: videoCount,
      images: imageCount,
      typeLabel: contentType === 'story' ? 'Story' : contentType === 'post' ? 'Post' : 'Content',
    };
  };

  const stats = getMetaStats();

  // Function to toggle between quick preview and full preview
  const handleViewFullPreview = () => {
    dispatch(setShowFullPreview(true));
  };

  // Check if status is an object and only render its message property
  const renderStatus = () => {
    if (!status) return null;
    if (typeof status === 'object') {
      return status.message || JSON.stringify(status);
    }
    return status;
  };

  // Check if error is an object and only render its message property
  const renderError = () => {
    if (!error) return null;
    if (typeof error === 'object') {
      return error.message || JSON.stringify(error);
    }
    return error;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ease-in-out ${
          isScrolled 
            ? 'bg-white/85 dark:bg-gray-900/90 backdrop-blur-lg shadow-lg' 
            : 'bg-white dark:bg-gray-900'
        } ${isHeaderCollapsed ? 'py-2' : 'py-4 md:py-6'}`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between">
            {/* Left: Instagram icon and title */}
            <div className="flex items-center mr-4">
              {/* Instagram gradient logo */}
              <div className="relative h-10 w-10 mr-3 transform hover:scale-110 transition-transform duration-300">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-yellow-500 via-pink-600 to-purple-600 animate-gradient-slow"></div>
                <div className="absolute inset-[2px] bg-white dark:bg-gray-900 rounded-md flex items-center justify-center">
                  <svg 
                    className="h-6 w-6 text-pink-600 dark:text-pink-500" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      d="M12 8.75C10.2051 8.75 8.75 10.2051 8.75 12C8.75 13.7949 10.2051 15.25 12 15.25C13.7949 15.25 15.25 13.7949 15.25 12C15.25 10.2051 13.7949 8.75 12 8.75Z" 
                      fill="currentColor"
                    />
                    <path 
                      fillRule="evenodd" 
                      clipRule="evenodd" 
                      d="M6.77142 3.2058C7.85532 3.12731 8.17853 3.11737 10.5486 3.09748L11.9949 3.09H12.0051C14.4248 3.09 14.736 3.10048 15.8246 3.18033C16.9087 3.25998 17.6263 3.4184 18.251 3.65925C18.8985 3.90919 19.4479 4.24339 19.9948 4.78918C20.5417 5.33206 20.8759 5.88151 21.1258 6.52403C21.3658 7.14455 21.525 7.85929 21.6055 8.94339C21.6853 10.0391 21.695 10.3471 21.695 12.7568V12.787C21.695 15.1967 21.6853 15.5047 21.6055 16.6004C21.5267 17.6845 21.3675 18.3992 21.1258 19.0198C20.8759 19.6623 20.5417 20.2117 19.9948 20.7546C19.4519 21.3015 18.9025 21.6356 18.26 21.8856C17.6394 22.1256 16.9247 22.2849 15.8406 22.3645C14.745 22.4443 14.437 22.454 12.0212 22.454H12.0051L12.0033 22.454C9.60356 22.454 9.28556 22.4443 8.18994 22.3645C7.10584 22.284 6.3911 22.1248 5.76644 21.8856C5.12391 21.6356 4.57446 21.3015 4.03159 20.7546C3.4858 20.2077 3.1516 19.6583 2.90166 19.0158C2.66081 18.395 2.50239 17.6774 2.42274 16.5964C2.34289 15.5047 2.33241 15.1967 2.33241 12.7731V12.7568C2.33241 10.3471 2.34289 10.0391 2.42274 8.95036C2.50123 7.86647 2.66117 7.14325 2.90166 6.52721C3.1516 5.87968 3.4858 5.33023 4.03159 4.78735C4.57747 4.24157 5.12692 3.90737 5.76944 3.65742C6.3911 3.41657 7.10584 3.25816 8.18994 3.1785L8.19109 3.17836C9.28727 3.09911 9.59525 3.08945 11.995 3.08945H12.0051C12.0051 3.08945 12.005 3.08945 12.0049 3.09L10.5486 3.09748C8.17853 3.11737 7.85532 3.12731 6.77142 3.2058ZM12.0051 4.86L10.5637 4.86748C8.24942 4.88671 7.92412 4.89733 6.85293 4.97418C5.87549 5.04636 5.34063 5.19798 4.98072 5.32705C4.5043 5.49739 4.1689 5.70401 3.81442 6.0585C3.45994 6.41298 3.25331 6.74839 3.08297 7.22481C2.9539 7.58472 2.80228 8.11957 2.73011 9.09701C2.65325 10.1682 2.64264 10.4935 2.62341 12.8078L2.62 12.9999V13.0051C2.62 15.3827 2.63107 15.708 2.70801 16.7723C2.7811 17.7417 2.93272 18.2797 3.06064 18.6355C3.23098 19.1119 3.43761 19.4473 3.7921 19.8018C4.14658 20.1563 4.48198 20.3629 4.9584 20.5333C5.31831 20.6623 5.85317 20.814 6.83061 20.8861C7.90179 20.963 8.22715 20.9736 10.5415 20.9928C10.7067 20.9946 10.8504 20.9955 10.9752 20.9955L11.9949 21H12.0051L13.0248 20.9955C13.1496 20.9955 13.2933 20.9946 13.4585 20.9928C15.7728 20.9736 16.0982 20.963 17.1694 20.8861C18.1469 20.814 18.6817 20.6624 19.0416 20.5333C19.518 20.3629 19.8534 20.1563 20.2079 19.8018C20.5624 19.4473 20.769 19.1119 20.9394 18.6355C21.0684 18.2756 21.2189 17.7417 21.292 16.7643C21.3689 15.7 21.38 15.3747 21.38 13.0604L21.3815 12.7568C21.3815 10.4279 21.3704 10.0995 21.292 9.0404C21.2189 8.06296 21.0684 7.5271 20.9394 7.1672C20.769 6.6908 20.5624 6.3554 20.2079 6.00091C19.8534 5.64643 19.518 5.4398 19.0416 5.26946C18.6817 5.14039 18.1469 4.98877 17.1694 4.91659C16.0982 4.83974 15.7728 4.82913 13.4585 4.80989L12.0051 4.8V4.86Z" 
                      fill="currentColor"
                    />
                  </svg>
                </div>
              </div>
              
              <div>
                <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">
                  <span className="hidden xs:inline bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">
                    Instagram Media
                  </span>
                  <span className="xs:hidden bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">
                    IG
                  </span>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500">
                    Downloader
                  </span>
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden md:block">Extract photos, videos, reels & stories</p>
              </div>
            </div>
            
            {/* Right side actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Responsive GitHub link */}
              <a
                href="https://github.com/aroy2o"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center px-3.5 py-1.5 text-xs md:text-sm rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111`.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" fill="currentColor"/>
                </svg>
                <span>GitHub</span>
              </a>
              
              {/* Mobile version */}
              <a
                href="https://github.com/abhijeetroyyy/Insta"
                target="_blank"
                rel="noopener noreferrer"
                className="md:hidden p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                aria-label="GitHub"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" fill="currentColor"/>
                </svg>
              </a>
              
              {/* Debug tools button */}
              <button
                onClick={() => dispatch(setShowDebugPanel(true))}
                className="hidden sm:flex items-center px-3.5 py-1.5 text-xs md:text-sm rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span>Debug</span>
              </button>

              {/* Mobile version */}
              <button
                onClick={() => dispatch(setShowDebugPanel(true))}
                className="sm:hidden p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                aria-label="Debug tools"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </button>
              
              {/* Theme toggle with animation */}
              <button 
                onClick={toggleTheme}
                className="relative p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-300"
                aria-label="Toggle theme"
              >
                <div className="relative w-5 h-5 overflow-hidden">
                  {/* Sun icon */}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-5 w-5 text-amber-500 absolute transition-transform duration-500 ease-in-out ${
                      theme === 'dark' ? 'translate-y-0 rotate-0' : 'translate-y-10 rotate-90'
                    }`}
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                  
                  {/* Moon icon */}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-5 w-5 text-indigo-600 dark:text-indigo-400 absolute transition-transform duration-500 ease-in-out ${
                      theme === 'light' ? 'translate-y-10 rotate-90' : 'translate-y-0 rotate-0'
                    }`}
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                  >
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                </div>
                <span className="sr-only">{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
                
                {/* Visual indicator */}
                <span className={`absolute inset-0 rounded-full border-2 scale-0 ${theme === 'dark' ? 'border-indigo-400' : 'border-amber-500'} animate-ping-once`}></span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-28">
        <div ref={formRef} className="card-modern p-0 overflow-hidden">
          <div className="p-6">
            <DownloadForm
              onSubmit={handleFormSubmit}
              disabled={status === 'fetching_preview' || status === 'fetching_stories' || status === 'fetching_post' || status === 'fetching_reel'}
            />

            {/* Status display area */}
            {status && status !== 'preview_ready' && (
              <div className="mt-6">
                <DownloadStatus status={renderStatus()} error={renderError()} />
              </div>
            )}

            {/* Download success/failure message */}
            {downloadResult && (
              <div className={`mt-6 p-4 border rounded-lg ${
                typeof downloadResult === 'object' && downloadResult.success === false
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800'
                  : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800'
              } animate-fadeIn transition-all duration-300`}>
                <div className="flex items-center">
                  {typeof downloadResult === 'object' && downloadResult.success === false ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  <p className="text-sm">
                    {typeof downloadResult === 'object' ? downloadResult.message : downloadResult}
                  </p>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && status === 'failed' && (
              <div className="mt-6 p-4 border rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800 transition-all duration-300">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm">{renderError()}</p>
                </div>
                <button 
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                  onClick={() => dispatch(setShowDebugPanel(true))}
                >
                  Debug Connection Issues
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick preview section when preview is ready but full preview isn't shown */}
        {status === 'preview_ready' && !showFullPreview && previewItems.length > 0 && (
          <div className="mt-8 animate-fadeIn">
            <MediaQuickPreview
              mediaItems={previewItems}
              onDownload={downloadMedia}
              onViewFullPreview={handleViewFullPreview}
            />
          </div>
        )}

        {/* Tab Navigation and Download All Button */}
        {((showFullPreview && previewItems.length > 0) || mediaFiles.length > 0) && (
          <div className="mt-8 mb-4 flex flex-wrap items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 animate-fadeIn">
            <div className="flex">
              <button
                className={`py-3 px-6 font-medium text-sm focus:outline-none transition-all duration-200 ${
                  activeTab === 'preview'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => dispatch(setActiveTab('preview'))}
                disabled={!showFullPreview && previewItems.length === 0}
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Media Preview</span>
                  {previewItems.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {previewItems.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                className={`py-3 px-6 font-medium text-sm focus:outline-none transition-all duration-200 ${
                  activeTab === 'downloads'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => dispatch(setActiveTab('downloads'))}
                disabled={mediaFiles.length === 0}
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Downloads</span>
                  {mediaFiles.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {mediaFiles.length}
                    </span>
                  )}
                </div>
              </button>
            </div>
            {/* Download All Button */}
            {activeTab === 'preview' && showFullPreview && previewItems.length > 1 && (
              <button
                onClick={handleDownloadAll}
                className="ml-auto mt-2 md:mt-0 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={Object.values(downloadingItems).some(Boolean)} // Disable if any item is downloading
              >
                {Object.values(downloadingItems).some(Boolean) ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download All ({previewItems.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Conditional rendering based on active tab */}
        <div className="animate-fadeIn transition-all duration-300">
          {activeTab === 'preview' && showFullPreview && (
            <>
              {/* Stats bar for media preview */}
              {stats && (
                <div className="mt-2 mb-4 flex flex-wrap gap-3">
                  <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20 10 10 0 010-20z" />
                    </svg>
                    {stats.typeLabel}: {stats.total} {stats.total === 1 ? 'item' : 'items'}
                  </div>
                  {stats.videos > 0 && (
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Videos: {stats.videos}
                    </div>
                  )}
                  {stats.images > 0 && (
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Images: {stats.images}
                    </div>
                  )}
                </div>
              )}
              
              {/* Use MediaStoryViewer for stories, MediaPreview for other content */}
              {contentType === 'story' && previewItems.length > 0 && (
                <MediaStoryViewer mediaItems={previewItems} onDownload={downloadMedia} isLoading={downloadingItems} />
              )}

              {contentType && contentType !== 'story' && previewItems.length > 0 && (
                <MediaPreview mediaItems={getFilteredPreviewItems()} onDownload={downloadMedia} isLoading={downloadingItems} />
              )}
            </>
          )}

          {activeTab === 'downloads' && (
            <>
              {mediaFiles.length > 0 ? (
                <MediaGallery files={mediaFiles} />
              ) : (
                <div className="mt-8 p-10 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-16 w-16 text-gray-400 animate-pulse-subtle"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No downloads yet</h3>
                  <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md">
                    Media you download will appear here. Try downloading some content from Instagram!
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Show error debug button if there's an error but debug panel isn't shown */}
        {error && !showDebugPanel && (
          <div className="mt-8 text-center">
            <button
              className="debug-button px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition duration-150 ease-in-out"
              onClick={() => dispatch(setShowDebugPanel(true))}
            >
              Debug Connection Issues
            </button>
          </div>
        )}
      </main>
      
      <footer className="py-6  bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Instagram Media Downloader — Extract and save photos and videos from Instagram
              </p>
              <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                Note: Please respect copyright and privacy when downloading content.
              </p>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={toggleTheme}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                    Light Mode
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                    Dark Mode
                  </>
                )}
              </button>
              <button
                onClick={() => dispatch(setShowDebugPanel(true))}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Debug Tools
              </button>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Debug Panel */}
      {showDebugPanel && (
        <DebugPanel 
          onClose={() => dispatch(setShowDebugPanel(false))} 
          previewResponse={previewResponse} 
        />
      )}
    </div>
  );
}

export default App;

