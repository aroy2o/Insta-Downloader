import { configureStore } from '@reduxjs/toolkit';
import mediaReducer from './slices/mediaSlice';
import uiReducer from './slices/uiSlice';
import downloadReducer from './slices/downloadSlice';

export const store = configureStore({
  reducer: {
    media: mediaReducer,
    ui: uiReducer,
    download: downloadReducer,
  },
});