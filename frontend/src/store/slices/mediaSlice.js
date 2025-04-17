import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { setStatus, setError } from './uiSlice';
import { ensureAbsoluteUrl } from '../../utils/mediaHelper';

// Create an async thunk for fetching media preview
export const fetchMediaPreview = createAsyncThunk(
  'media/fetchMediaPreview',
  async ({ url, browser }, { dispatch }) => {
    try {
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

      // Using the proxy configured in vite.config.js
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, browser }),
      });

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
        
        // Return the processed result
        return { 
          processedItems, 
          contentType: result.content_type 
        };
      } else {
        throw new Error(result.error || 'No media items found');
      }
    } catch (error) {
      dispatch(setStatus('failed'));
      dispatch(setError(error.message));
      throw error;
    }
  }
);

const initialState = {
  mediaFiles: [],
  previewItems: [],
  contentType: null,
  previewResponse: null,
};

export const mediaSlice = createSlice({
  name: 'media',
  initialState,
  reducers: {
    setMediaFiles: (state, action) => {
      state.mediaFiles = action.payload;
    },
    addMediaFile: (state, action) => {
      state.mediaFiles.push(action.payload);
    },
    setPreviewItems: (state, action) => {
      state.previewItems = action.payload;
    },
    setContentType: (state, action) => {
      state.contentType = action.payload;
    },
    setPreviewResponse: (state, action) => {
      state.previewResponse = action.payload;
    },
    clearMediaState: (state) => {
      state.mediaFiles = [];
      state.previewItems = [];
      state.contentType = null;
      state.previewResponse = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMediaPreview.pending, (state) => {
        state.previewItems = [];
        state.contentType = null;
      })
      .addCase(fetchMediaPreview.fulfilled, (state, action) => {
        state.previewItems = action.payload.processedItems;
        state.contentType = action.payload.contentType;
      });
  }
});

export const { 
  setMediaFiles, 
  addMediaFile, 
  setPreviewItems, 
  setContentType, 
  setPreviewResponse, 
  clearMediaState 
} = mediaSlice.actions;

// Selectors
export const selectMediaFiles = (state) => state.media.mediaFiles;
export const selectPreviewItems = (state) => state.media.previewItems;
export const selectContentType = (state) => state.media.contentType;
export const selectPreviewResponse = (state) => state.media.previewResponse;

export default mediaSlice.reducer;