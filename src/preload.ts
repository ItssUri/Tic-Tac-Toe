import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  fetchMovie: async () => {
    console.log('fetchMovie called in preload script');
    return await ipcRenderer.invoke('fetch-movie');
  },
});
