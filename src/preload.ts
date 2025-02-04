import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  fetchMovie: async () => {
    console.log('fetchMovie called in preload script');
    return await ipcRenderer.invoke('fetch-movie');
  },
  watchMovie: async () => {
    console.log('watchMovie called in preload script');
    return await ipcRenderer.invoke('watch-movie');
  },
  onMovieChange: (callback: (change: any) => void) => {
    ipcRenderer.on('movie-change', (_event, change) => {
      console.log("Change event received in preload script:", change);
      callback(change);
    });
  },
  makeMove: async (row: number, column: number) => {
    console.log(`makeMove called in preload script: row ${row}, col ${column}`);
    return await ipcRenderer.invoke("make-move", { row, column});
  },
  cleanTable: async () => {
    console.log(`cleanTable called`);
    return await ipcRenderer.invoke("clean-table");
  },
});