import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: null,
  error: null,
  isHeaderCollapsed: false,
  isScrolled: false,
  activeTab: 'preview',
  showFullPreview: false,
  showDebugPanel: false,
  theme: localStorage.getItem('theme') || 
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setStatus: (state, action) => {
      state.status = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setHeaderCollapsed: (state, action) => {
      state.isHeaderCollapsed = action.payload;
    },
    setScrolled: (state, action) => {
      state.isScrolled = action.payload;
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setShowFullPreview: (state, action) => {
      state.showFullPreview = action.payload;
    },
    setShowDebugPanel: (state, action) => {
      state.showDebugPanel = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', state.theme);
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    },
  },
});

export const {
  setStatus,
  setError,
  clearError,
  setHeaderCollapsed,
  setScrolled,
  setActiveTab,
  setShowFullPreview,
  setShowDebugPanel,
  toggleTheme,
  setTheme,
} = uiSlice.actions;

// Selectors
export const selectStatus = (state) => state.ui.status;
export const selectError = (state) => state.ui.error;
export const selectIsHeaderCollapsed = (state) => state.ui.isHeaderCollapsed;
export const selectIsScrolled = (state) => state.ui.isScrolled;
export const selectActiveTab = (state) => state.ui.activeTab;
export const selectShowFullPreview = (state) => state.ui.showFullPreview;
export const selectShowDebugPanel = (state) => state.ui.showDebugPanel;
export const selectTheme = (state) => state.ui.theme;

export default uiSlice.reducer;