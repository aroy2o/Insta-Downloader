import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { LoadingSpinner } from './components/LoadingSpinner';
import { setShowDebugPanel } from './store/slices/uiSlice';

export function DebugPanel() {
  const previewResponse = useSelector(state => state.media.previewResponse);
  const dispatch = useDispatch();

  const [backendStatus, setBackendStatus] = useState('checking...');
  const [proxyStatus, setProxyStatus] = useState('checking...');
  const [logs, setLogs] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const [isTestingBackend, setIsTestingBackend] = useState(false);
  const [isTestingProxy, setIsTestingProxy] = useState(false);
  const [testImage, setTestImage] = useState(null);
  const [urlToTest, setUrlToTest] = useState('https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png');
  const [expanded, setDebugExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('status'); // State for tab navigation

  // Check backend connectivity
  const checkBackendConnectivity = async () => {
    setBackendStatus('checking...');
    setIsTestingBackend(true);
    try {
      const startTime = Date.now();
      const response = await fetch('/api/health', { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const elapsed = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        setBackendStatus(`Connected (${elapsed}ms)`);
        addLog(`Backend connection successful. Response time: ${elapsed}ms. Browser available: ${data.browser_available ? 'Yes' : 'No'}`);
        
        // Store system info if available
        if (data.system_info) {
          setSystemInfo(data.system_info);
        }
      } else {
        setBackendStatus(`Failed (${response.status})`);
        addLog(`Backend connection failed with status ${response.status}`);
      }
    } catch (error) {
      setBackendStatus('Failed (network error)');
      addLog(`Backend connection failed: ${error.message}`);
    } finally {
      setIsTestingBackend(false);
    }
  };
  
  // Check proxy connectivity
  const checkProxySetup = async () => {
    setProxyStatus('checking...');
    setIsTestingProxy(true);
    setTestImage(null);
    
    try {
      const startTime = Date.now();
      // Use the Instagram favicon or user-provided URL to test proxy
      const testUrl = urlToTest;
      const proxyUrl = `/api/download/media-proxy?url=${encodeURIComponent(testUrl)}`;
      
      addLog(`Testing proxy with URL: ${testUrl}`);
      addLog(`Full proxy URL: ${proxyUrl}`);
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const elapsed = Date.now() - startTime;
      
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        setProxyStatus(`Working (${elapsed}ms)`);
        addLog(`Proxy test successful. Response time: ${elapsed}ms. Content-Type: ${contentType}`);
        
        // If it's an image, display it as a test
        if (contentType.startsWith('image/')) {
          const blob = await response.blob();
          setTestImage(URL.createObjectURL(blob));
        } else {
          addLog(`Response is not an image. Content type: ${contentType}`);
        }
      } else {
        setProxyStatus(`Failed (${response.status})`);
        addLog(`Proxy test failed with status ${response.status}`);
        try {
          const errorText = await response.text();
          addLog(`Error response: ${errorText.substring(0, 150)}...`);
        } catch (e) {
          addLog(`Could not read error response: ${e.message}`);
        }
      }
    } catch (error) {
      setProxyStatus('Failed (network error)');
      addLog(`Proxy test failed: ${error.message}`);
    } finally {
      setIsTestingProxy(false);
    }
  };
  
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]); // Keep last 20 logs
  };
  
  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared');
  };
  
  const handleClose = () => {
    dispatch(setShowDebugPanel(false));
  };
  
  useEffect(() => {
    checkBackendConnectivity();
    checkProxySetup();
    
    // Add browser info to logs
    addLog(`Browser: ${navigator.userAgent}`);
  }, []);

  // No debug info available
  if (!previewResponse || !previewResponse.debug_info) {
    return null;
  }

  const { debug_info, error } = previewResponse;

  // Helper to determine severity level (for styling)
  const getSeverityClass = () => {
    if (previewResponse.success) return "border-green-500 bg-green-50 dark:bg-green-900/20";
    if (error) return "border-red-500 bg-red-50 dark:bg-red-900/20";
    return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
  };

  // Helper to create a readable formatted value
  const formatValue = (value) => {
    if (typeof value === 'boolean') {
      return value ? (
        <span className="text-green-600 dark:text-green-400 font-medium">true</span>
      ) : (
        <span className="text-red-600 dark:text-red-400 font-medium">false</span>
      );
    }
    
    if (typeof value === 'number') {
      return <span className="text-blue-600 dark:text-blue-400 font-medium">{value}</span>;
    }
    
    return <span className="text-gray-700 dark:text-gray-300 break-all">{String(value)}</span>;
  };

  const renderDebugSection = (section, data) => {
    // Skip rendering empty sections
    if (!data || Object.keys(data).length === 0) return null;
    
    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">{section}</h4>
        <div className="grid grid-cols-1 gap-1">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="grid grid-cols-2 gap-2 py-1 border-b border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{key}</div>
              <div className="text-xs">{formatValue(value)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Group debug info into logical sections
  const extractionInfo = {};
  const browserInfo = {};
  const navigationInfo = {};
  const errorInfo = {};
  
  // Sort debug data into categories
  Object.entries(debug_info).forEach(([key, value]) => {
    if (key.includes('extraction') || key.includes('extracted')) {
      extractionInfo[key] = value;
    } else if (key.includes('browser')) {
      browserInfo[key] = value;
    } else if (key.includes('navigation') || key.includes('wait_time')) {
      navigationInfo[key] = value;
    } else if (key.includes('error')) {
      errorInfo[key] = value;
    }
  });
  
  // Handle screenshot display
  const screenshotPath = debug_info?.debug_screenshot;

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'status':
        return (
          <div className="status-section animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl mb-5 shadow-sm border border-gray-100 dark:border-gray-700 transform transition-all duration-300 hover:shadow-md">
              <h3 className="text-md font-medium mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
                </svg>
                Connection Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200">
                  {isTestingBackend ? (
                    <LoadingSpinner size="sm" color="blue" type="pulse" />
                  ) : (
                    <div className={`h-3 w-3 rounded-full mr-2 transition-all duration-300 ${backendStatus.includes('Connected') ? 'bg-green-500 group-hover:animate-pulse' : 'bg-red-500'}`}></div>
                  )}
                  <span className="font-medium text-gray-700 dark:text-gray-300">Backend API:</span>
                  <span className={`ml-2 ${backendStatus.includes('Connected') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {backendStatus}
                  </span>
                </div>
                <div className="flex items-center bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200">
                  {isTestingProxy ? (
                    <LoadingSpinner size="sm" color="blue" type="pulse" />
                  ) : (
                    <div className={`h-3 w-3 rounded-full mr-2 transition-all duration-300 ${proxyStatus.includes('Working') ? 'bg-green-500 group-hover:animate-pulse' : 'bg-red-500'}`}></div>
                  )}
                  <span className="font-medium text-gray-700 dark:text-gray-300">Media Proxy:</span>
                  <span className={`ml-2 ${proxyStatus.includes('Working') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {proxyStatus}
                  </span>
                </div>
              </div>
              
              {/* Custom URL test field */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Test URL for proxy:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={urlToTest}
                    onChange={(e) => setUrlToTest(e.target.value)}
                    className="flex-grow p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    placeholder="https://example.com/image.jpg"
                  />
                  <button
                    onClick={checkProxySetup}
                    disabled={isTestingProxy}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-all duration-200 flex items-center justify-center space-x-1 hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {isTestingProxy ? (
                      <LoadingSpinner size="xs" color="white" type="dots" />
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        <span>Test</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Test image preview */}
              {testImage && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg animate-fadeIn">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Test Image Result:
                  </p>
                  <div className="flex justify-center p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-inner">
                    <img
                      src={testImage}
                      alt="Proxy Test"
                      className="max-h-32 object-contain hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='50' font-size='10' text-anchor='middle' alignment-baseline='middle' fill='%23999999'%3EImage Error%3C/text%3E%3C/svg%3E";
                        addLog("Error displaying test image");
                      }}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap mt-4 gap-2">
                <button 
                  onClick={checkBackendConnectivity}
                  disabled={isTestingBackend}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm rounded-md shadow-sm transition-all duration-200 ease-in-out disabled:opacity-50 flex items-center hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isTestingBackend && <LoadingSpinner size="sm" color="white" />}
                  <span className={isTestingBackend ? "ml-2" : ""}>Test Backend</span>
                </button>
                <button 
                  onClick={checkProxySetup}
                  disabled={isTestingProxy}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm rounded-md shadow-sm transition-all duration-200 ease-in-out disabled:opacity-50 flex items-center hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isTestingProxy && <LoadingSpinner size="sm" color="white" />}
                  <span className={isTestingProxy ? "ml-2" : ""}>Test Media Proxy</span>
                </button>
                <button 
                  onClick={clearLogs}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-md shadow-sm transition-all duration-200 ease-in-out ml-auto flex items-center hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Logs
                </button>
              </div>
            </div>
            
            {systemInfo && (
              <div className="system-info bg-white dark:bg-gray-800 p-5 rounded-xl mb-5 shadow-sm border border-gray-100 dark:border-gray-700 transform transition-all duration-300 hover:shadow-md">
                <h3 className="text-md font-medium mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                  System Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-28">Operating System:</span>
                    <span className="text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{systemInfo.os}</span>
                  </div>
                  <div className="flex items-center bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-28">Node Version:</span>
                    <span className="text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{systemInfo.node_version}</span>
                  </div>
                  <div className="flex items-center bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-28">Browser Path:</span>
                    <span className="text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{systemInfo.browser_path || 'Not found'}</span>
                  </div>
                  <div className="flex items-center bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-28">Memory:</span>
                    <span className="text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{systemInfo.memory}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'logs':
        return (
          <div className="logs-section animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-md font-medium mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Connection Logs
              </h3>
              <div className="logs-container bg-gradient-to-br from-gray-900 to-gray-800 text-gray-200 p-4 rounded-xl overflow-y-auto font-mono text-xs leading-relaxed shadow-inner" style={{ maxHeight: '300px' }}>
                {logs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`log-entry py-1.5 border-b border-gray-800 last:border-0 transition-all animate-fadeIn`} 
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {log.includes('successful') || log.includes('Working') ? (
                      <span className="text-green-400">{log}</span>
                    ) : log.includes('failed') || log.includes('error') || log.includes('Error') ? (
                      <span className="text-red-400">{log}</span>
                    ) : (
                      log
                    )}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="empty-logs text-gray-500 py-2 italic flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20 10 10 0 010-20z" />
                    </svg>
                    No logs yet
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-3">
                <button 
                  onClick={clearLogs}
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded-md shadow-sm transition-all duration-200 ease-in-out flex items-center hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Logs
                </button>
              </div>
            </div>
          </div>
        );
      case 'debug':
        return (
          <div className="debug-section animate-fadeIn">
            {/* Debug Information Section */}
            <div className={`rounded-lg border-l-4 ${getSeverityClass()} p-5 bg-white dark:bg-gray-800 shadow-sm relative`}>
              <div className="flex justify-between items-start">
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-1.5 ${previewResponse.success ? 'text-green-500' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={previewResponse.success 
                      ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      : "M12 8v4m0 4h.01M12 2a10 10 0 110 20 10 10 0 010-20z"} />
                  </svg>
                  Extraction {previewResponse.success ? 'Successful' : 'Failed'}
                </h3>
                <button 
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                  onClick={() => setDebugExpanded(!expanded)}
                >
                  {expanded ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      Hide Details
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Show Details
                    </>
                  )}
                </button>
              </div>
              
              {/* Basic info always visible */}
              <div className="mt-2 text-sm">
                <p className="text-gray-600 dark:text-gray-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Content type: <strong className="ml-1">{previewResponse.content_type}</strong>
                </p>
                {error && (
                  <p className="text-red-600 dark:text-red-400 flex items-center mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {error}
                  </p>
                )}
                {previewResponse.media_items && (
                  <p className="text-gray-600 dark:text-gray-300 mt-1 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Found <strong className="mx-1">{previewResponse.media_items.length}</strong> media items
                  </p>
                )}
              </div>

              {/* Expanded details */}
              <div className={`mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 text-sm transition-all duration-500 overflow-hidden ${
                expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 pt-0 mt-0 border-t-0'
              }`}>
                {/* Debug Screenshot */}
                {screenshotPath && (
                  <div className="mb-4 animate-fadeIn">
                    <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Debug Screenshot
                    </h4>
                    <div className="relative group cursor-zoom-in">
                      <img 
                        src={screenshotPath} 
                        alt="Debug screenshot" 
                        className="w-full max-h-80 object-contain border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm transition-all duration-300 group-hover:shadow-md"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/70 text-white px-3 py-2 rounded-lg shadow-lg flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Click to zoom
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Categorized debug info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="animate-fadeIn" style={{ animationDelay: '100ms' }}>
                    {renderDebugSection("Browser Information", browserInfo)}
                    {renderDebugSection("Navigation", navigationInfo)}
                  </div>
                  <div className="animate-fadeIn" style={{ animationDelay: '200ms' }}>
                    {renderDebugSection("Extraction", extractionInfo)}
                    {renderDebugSection("Errors", errorInfo)}
                  </div>
                </div>
                
                {/* Raw debug data (collapsible) */}
                <details className="mt-4 animate-fadeIn" style={{ animationDelay: '300ms' }}>
                  <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center w-fit">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Raw Debug Data
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs overflow-auto max-h-60 shadow-inner border border-gray-200 dark:border-gray-700">
                    {JSON.stringify(debug_info, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
            
            <div className="troubleshooting mt-5 animate-fadeIn" style={{ animationDelay: '150ms' }}>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-md font-medium mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-2 0c0 .993-.241 1.929-.668 2.754l-1.524-1.525a3.997 3.997 0 00.078-2.183l1.562-1.562C15.802 8.249 16 9.1 16 10zm-5.165 3.913l1.58 1.58A5.98 5.98 0 0110 16a5.976 5.976 0 01-2.516-.552l1.562-1.562a4.006 4.006 0 001.789.027zm-4.677-2.796a4.002 4.002 0 01-.041-2.08l-.08.08-1.53-1.533A5.98 5.98 0 004 10c0 .954.223 1.856.619 2.657l1.54-1.54zm1.088-6.45A5.974 5.974 0 0110 4c.954 0 1.856.223 2.657.619l-1.54 1.54a4.002 4.002 0 00-2.346.033L7.246 4.668zM12 10a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" />
                  </svg>
                  Media Loading Troubleshooting
                </h3>
                <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-750 p-4 rounded-xl shadow-sm">
                  <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                    {[
                      "Ensure the media URLs are correct and accessible",
                      "Check if your browser has any content blockers or privacy features preventing image loading",
                      "Verify that the backend server is correctly proxying media requests",
                      "Try using the test field above with a direct image URL from Instagram (e.g., profile picture)",
                      "Instagram may be blocking requests that don't come from authorized sources",
                      "Check browser console for CORS or network errors"
                    ].map((tip, index) => (
                      <li key={index} className="flex items-start animate-fadeIn" style={{ animationDelay: `${index * 100}ms` }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0 transform translate-y-0.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="debug-panel fixed bottom-0 left-0 right-0 bg-gray-50 dark:bg-gray-900 shadow-xl border-t border-gray-200 dark:border-gray-700 z-50 transition-all duration-500 ease-in-out" 
      style={{ 
        maxHeight: isExpanded ? '80vh' : '320px',
        transform: isExpanded ? 'translateY(0)' : 'translateY(calc(100% - 42px))',
      }}
    >
      {/* Floating handle for better UX */}
      <div 
        className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3 px-4 py-1 bg-blue-600 rounded-t-lg shadow-md cursor-pointer flex items-center justify-center text-white text-xs font-medium group hover:bg-blue-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
        </svg>
        {isExpanded ? 'Collapse' : 'Debug Panel'}
        <span className={`absolute bottom-0 left-0 right-0 h-0.5 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center ${isExpanded ? '' : 'animate-pulse'}`}></span>
      </div>

      <div className="debug-header flex justify-between items-center px-4 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 dark:from-blue-800/40 dark:to-purple-800/40 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Diagnostics & Debug</h2>
        </div>
        <div className="flex items-center gap-1">
          {/* Tab navigation */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {[
              { id: 'status', label: 'Status', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
              { id: 'logs', label: 'Logs', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
              { id: 'debug', label: 'Debug', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <div className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  {tab.label}
                </div>
              </button>
            ))}
          </div>
          <button 
            onClick={handleClose}
            className="p-1.5 rounded-md text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors duration-200 ml-2"
            aria-label="Close debug panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="debug-content p-4 overflow-auto custom-scrollbar" style={{ maxHeight: 'calc(80vh - 56px)' }}>
        {renderTabContent()}
      </div>
    </div>
  );
}
