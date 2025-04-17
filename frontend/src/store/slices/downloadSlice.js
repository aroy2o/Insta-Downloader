import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  downloadingItems: {},
  downloadResult: null,
};

export const downloadSlice = createSlice({
  name: 'download',
  initialState,
  reducers: {
    setDownloadingItem: (state, action) => {
      const { url, isDownloading } = action.payload;
      state.downloadingItems = {
        ...state.downloadingItems,
        [url]: isDownloading
      };
    },
    setDownloadResult: (state, action) => {
      state.downloadResult = action.payload;
    },
    clearDownloadResult: (state) => {
      state.downloadResult = null;
    },
    resetDownloadingItems: (state) => {
      state.downloadingItems = {};
    }
  },
});

export const {
  setDownloadingItem,
  setDownloadResult,
  clearDownloadResult,
  resetDownloadingItems
} = downloadSlice.actions;

// Selectors
export const selectDownloadingItems = (state) => state.download.downloadingItems;
export const selectDownloadResult = (state) => state.download.downloadResult;
export const selectIsAnyDownloading = (state) => Object.values(state.download.downloadingItems).some(Boolean);

export default downloadSlice.reducer;