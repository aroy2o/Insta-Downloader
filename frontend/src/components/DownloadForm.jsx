import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { isInstagramUrl } from '../utils/mediaHelper';
import { setStatus, setError, clearError } from '../store/slices/uiSlice';
import { fetchMediaPreview } from '../store/slices/mediaSlice';

export function DownloadForm() {
  const status = useSelector(state => state.ui.status);
  const error = useSelector(state => state.ui.error);
  const dispatch = useDispatch();

  const [url, setUrl] = useState('');
  const [browser, setBrowser] = useState('chrome');
  const [urlError, setUrlError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [clipboardNotSupported, setClipboardNotSupported] = useState(false);
  const [pastedFromClipboard, setPastedFromClipboard] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [activeStep, setActiveStep] = useState(1); // For step animation
  const [isButtonHovered, setIsButtonHovered] = useState(false); // For button hover animation
  const urlInputRef = useRef(null);

  // Check if the form is disabled based on status
  const isFormDisabled = status === 'fetching_preview' || status === 'fetching_stories' || 
                         status === 'fetching_post' || status === 'fetching_reel';

  useEffect(() => {
    // Check if clipboard API is available
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      setClipboardNotSupported(true);
    }
    
    // Animate active step when component mounts
    const stepInterval = setInterval(() => {
      setActiveStep((prev) => (prev % 3) + 1);
    }, 3000);
    
    return () => clearInterval(stepInterval);
  }, []);

  // Handle URL validation
  const validateUrl = (input) => {
    if (!input) {
      setUrlError('Please enter an Instagram URL');
      return false;
    }

    if (!isInstagramUrl(input)) {
      setUrlError('Please enter a valid Instagram post, reel, story or profile URL');
      return false;
    }

    setUrlError(null);
    return true;
  };

  // Handle form submission
  const handleSubmit = (event) => {
    event.preventDefault();
    
    if (!validateUrl(url)) {
      // Also update the global error state in Redux
      dispatch(setError(urlError || 'Invalid URL'));
      return;
    }
    
    // Clear any previous errors
    dispatch(clearError());
    
    // Update status to indicate we're fetching preview
    dispatch(setStatus('fetching_preview'));
    
    // Dispatch the action to fetch media preview
    dispatch(fetchMediaPreview({ url, browser }));
  };

  // Handle URL input change
  const handleUrlChange = (e) => {
    const input = e.target.value;
    setUrl(input);
    
    // Only validate if there's some content
    if (input.length > 0) {
      validateUrl(input);
      // Progress to step 2 when user adds a URL
      if (activeStep === 1) setActiveStep(2);
    } else {
      setUrlError(null);
    }
  };

  // Handle browser change
  const handleBrowserChange = (e) => {
    setBrowser(e.target.value);
    // Progress to step 3 when user selects a browser
    if (activeStep === 2) setActiveStep(3);
  };

  // Paste from clipboard
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        validateUrl(text);
        setPastedFromClipboard(true);
        
        // Progress to step 2 when user pastes a URL
        setActiveStep(2);
        
        // Clear the "pasted" indicator after a brief period
        setTimeout(() => setPastedFromClipboard(false), 2000);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      setClipboardNotSupported(true);
    }
  };

  // Clear the input field
  const clearInput = () => {
    setUrl('');
    setUrlError(null);
    if (urlInputRef.current) {
      urlInputRef.current.focus();
    }
  };

  // Handle key press in the form
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isFormDisabled && url.trim()) {
      handleSubmit(e);
    }
  };

  return (
    <>
      {/* 3-step instruction card with animations */}
      <div className="mb-8 animate-fadeIn">
        <div className="flex flex-col md:flex-row items-stretch justify-between bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 shadow-neumorphic rounded-2xl p-6 md:p-8 gap-6 transition-all">
          {/* Step 1 */}
          <div className={`flex-1 flex flex-col items-center text-center px-2 transform transition-all duration-500 ${activeStep === 1 ? 'scale-110' : ''}`}>
            <div className={`bg-white/10 rounded-full p-3 mb-3 shadow-inner-neumorphic relative overflow-hidden transition-all duration-300 ${activeStep === 1 ? 'ring-4 ring-white/30' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 text-white transition-transform duration-500 ${activeStep === 1 ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {activeStep === 1 && (
                <span className="absolute inset-0 bg-white/20 animate-ping rounded-full"></span>
              )}
            </div>
            <h3 className={`text-lg font-semibold mb-1 transition-all duration-300 ${activeStep === 1 ? 'text-white scale-105' : 'text-white/80'}`}>Paste Instagram URL</h3>
            <p className="text-sm text-purple-100">Copy and paste a reel, post, or story link.</p>
          </div>
          {/* Arrow */}
          <div className="hidden md:flex items-center">
            <svg className={`h-8 w-8 transition-opacity duration-300 ${activeStep === 1 ? 'text-white' : 'text-white/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          {/* Step 2 */}
          <div className={`flex-1 flex flex-col items-center text-center px-2 transform transition-all duration-500 ${activeStep === 2 ? 'scale-110' : ''}`}>
            <div className={`bg-white/10 rounded-full p-3 mb-3 shadow-inner-neumorphic relative overflow-hidden transition-all duration-300 ${activeStep === 2 ? 'ring-4 ring-white/30' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 text-white transition-transform duration-500 ${activeStep === 2 ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              {activeStep === 2 && (
                <span className="absolute inset-0 bg-white/20 animate-ping rounded-full"></span>
              )}
            </div>
            <h3 className={`text-lg font-semibold mb-1 transition-all duration-300 ${activeStep === 2 ? 'text-white scale-105' : 'text-white/80'}`}>Select Browser Mode</h3>
            <p className="text-sm text-purple-100">Choose emulation mode (e.g., Chrome).</p>
          </div>
          {/* Arrow */}
          <div className="hidden md:flex items-center">
            <svg className={`h-8 w-8 transition-opacity duration-300 ${activeStep === 2 ? 'text-white' : 'text-white/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          {/* Step 3 */}
          <div className={`flex-1 flex flex-col items-center text-center px-2 transform transition-all duration-500 ${activeStep === 3 ? 'scale-110' : ''}`}>
            <div className={`bg-white/10 rounded-full p-3 mb-3 shadow-inner-neumorphic relative overflow-hidden transition-all duration-300 ${activeStep === 3 ? 'ring-4 ring-white/30' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 text-white transition-transform duration-500 ${activeStep === 3 ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v-12a2 2 0 012-2h12a2 2 0 012 2v12" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4m0 0l4 4m-4-4v12" />
              </svg>
              {activeStep === 3 && (
                <span className="absolute inset-0 bg-white/20 animate-ping rounded-full"></span>
              )}
            </div>
            <h3 className={`text-lg font-semibold mb-1 transition-all duration-300 ${activeStep === 3 ? 'text-white scale-105' : 'text-white/80'}`}>Download Media</h3>
            <p className="text-sm text-purple-100">Click extract to fetch and save media.</p>
          </div>
        </div>
      </div>

      <div className="card-modern p-6 backdrop-blur-sm bg-opacity-95 animate-fadeIn">
        <form onSubmit={handleSubmit} className="space-y-6" onKeyPress={handleKeyPress}>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="instagram-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Instagram URL
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                Paste link from Instagram
              </span>
            </div>
            <div className="relative rounded-lg group">
              {/* URL input field with focus effect */}
              <div className={`relative ${inputFocused || url ? 'gradient-border' : ''} transition-all duration-300 group-hover:shadow-lg`}>
                <input
                  ref={urlInputRef}
                  type="text"
                  id="instagram-url"
                  value={url}
                  onChange={handleUrlChange}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="https://www.instagram.com/p/..."
                  className={`block w-full px-4 py-3.5 rounded-lg text-base border ${
                    urlError 
                      ? 'border-red-300 dark:border-red-500 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                  } shadow-sm dark:bg-gray-800 dark:text-gray-100 transition-all duration-200 focus:shadow-md  dark:group-hover:bg-gray-750`}
                  aria-describedby="url-error"
                  disabled={isFormDisabled}
                  autoComplete="off"
                />

                {/* Clear button - only show when there's input */}
                {url && (
                  <button
                    type="button"
                    onClick={clearInput}
                    className="absolute inset-y-0 right-12 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hover:scale-110 transform duration-200"
                    disabled={isFormDisabled}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}

                {/* Paste button with animation */}
                {!clipboardNotSupported && (
                  <button
                    type="button"
                    onClick={pasteFromClipboard}
                    className={`absolute inset-y-0 right-0 px-3 flex items-center transition-all duration-300 hover:scale-110 ${
                      pastedFromClipboard 
                        ? 'text-green-600 dark:text-green-500' 
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                    disabled={isFormDisabled}
                  >
                    {pastedFromClipboard ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-bounce" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="absolute inset-0 bg-blue-400/30 rounded-full animate-ping opacity-75"></span>
                      </div>
                    )}
                  </button>
                )}
              </div>

              {/* Error message with animation */}
              {urlError && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center animate-fadeIn" id="url-error">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {urlError}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap md:flex-nowrap gap-4">
            {/* Browser selection with hover effect */}
            <div className="w-full md:w-1/2 group">
              <label htmlFor="browser-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Browser Mode
              </label>
              <div className="relative">
                <select
                  id="browser-select"
                  value={browser}
                  onChange={handleBrowserChange}
                  className="block w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 appearance-none transition-all duration-300 group-hover:shadow-md  dark:group-hover:bg-gray-750"
                  disabled={isFormDisabled}
                >
                  <option value="chrome">Chrome</option>
                  <option value="firefox">Firefox</option>
                  <option value="chrome-mobile">Chrome Mobile</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-300 group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Try different browsers if one doesn't work
              </p>
            </div>
            
            {/* Submit button with animation */}
            <div className="w-full md:w-1/2 flex items-end">
              <button
                type="submit"
                disabled={isFormDisabled || !url.trim()}
                onMouseEnter={() => setIsButtonHovered(true)}
                onMouseLeave={() => setIsButtonHovered(false)}
                className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 ${
                  isFormDisabled || !url.trim() 
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transform hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-md'
                }`}
              >
                {isFormDisabled ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white dark:text-gray-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center group relative">
                    <svg xmlns="http://www.w3.org/2000/svg" 
                      className={`h-5 w-5 mr-2 transition-all duration-500 ${isButtonHovered ? 'animate-pulse transform rotate-12' : ''}`} 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    <span className={`transition-all duration-300 ${isButtonHovered ? 'transform translate-x-1' : ''}`}>Extract Media</span>
                    {isButtonHovered && (
                      <span className="absolute -right-1 top-1/2 transform -translate-y-1/2 animate-bounce">→</span>
                    )}
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Help section - redesigned with animation */}
          <div>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-all duration-300 hover:translate-x-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" 
                className={`h-4 w-4 mr-1 transition-transform duration-500 ${showHelp ? 'rotate-180' : 'animate-pulse'}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20 10 10 0 010-20z" />
              </svg>
              {showHelp ? 'Hide Help' : 'Need Help?'}
            </button>

            {/* Animated help section */}
            <div className={`mt-4 overflow-hidden transition-all duration-500 ease-in-out transform origin-top ${showHelp ? 'max-h-96 opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
              <div className="p-4  dark:bg-gray-750 rounded-lg text-sm text-gray-800 dark:text-gray-200 border border-blue-100 dark:border-gray-700 shadow-lg">
                <h4 className="font-medium mb-3 text-blue-800 dark:text-blue-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  Supported Instagram URLs:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border border-blue-100 dark:border-gray-700 transition-transform duration-300 hover:scale-102 hover:shadow-md">
                    <div className="font-medium text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Posts</div>
                    <code className="text-xs font-mono bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">
                      https://www.instagram.com/p/XXXX/
                    </code>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border border-blue-100 dark:border-gray-700 transition-transform duration-300 hover:scale-102 hover:shadow-md">
                    <div className="font-medium text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Reels</div>
                    <code className="text-xs font-mono bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">
                      https://www.instagram.com/reel/XXXX/
                    </code>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border border-blue-100 dark:border-gray-700 transition-transform duration-300 hover:scale-102 hover:shadow-md">
                    <div className="font-medium text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Stories</div>
                    <code className="text-xs font-mono bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">
                      https://www.instagram.com/stories/username/XXXX/
                    </code>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border border-blue-100 dark:border-gray-700 transition-transform duration-300 hover:scale-102 hover:shadow-md">
                    <div className="font-medium text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Profiles</div>
                    <code className="text-xs font-mono bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">
                      https://www.instagram.com/username/
                    </code>
                  </div>
                </div>
                <div className="mt-3 flex items-start bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mr-2 flex-shrink-0 animate-bounce" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs">If one browser mode doesn't work, try another. Some content may only be accessible using specific browser settings.</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
