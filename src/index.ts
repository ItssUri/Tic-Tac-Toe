import { app, BrowserWindow, ipcMain } from 'electron';
import { MongoClient } from 'mongodb';
import * as path from 'path';
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;


if (require('electron-squirrel-startup')) {
  app.quit();
}

const uri = "mongodb://localhost:27017/";
let client: MongoClient;
let changeStream;

// Create a MongoDB connection
async function connectToMongoDB() {
  client = new MongoClient(uri);
  await client.connect();
  const database = client.db('tictactoe');
  console.log("Connected to MongoDB");
  return database;
}

// Query MongoDB and return the result
ipcMain.handle('fetch-movie', async (_event) => {
  console.log("Fetching table...");
  try {
    const database = await connectToMongoDB(); // Your MongoDB connection logic
    const game = database.collection('main');

    // Fetch all documents in the collection as an array
    const movies = await game.find().sort({ row: 1, column: 1 }).toArray();

    // Log and return the movies array
    console.log("Movies fetched: ", movies);

    // Serialize the array to ensure it's safe for IPC
    return JSON.parse(JSON.stringify(movies));
  } catch (error) {
    console.error("Error fetching movies:", error);
    return { error: 'Failed to fetch movies.' };
  } finally {
    if (client) {
      await client.close();
    }
  }
});

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    icon: path.join(__dirname, 'src', 'app.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY, // Load the preload script
      contextIsolation: true, // Best practice for security
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  return mainWindow
};

app.on('ready', function() {
  var mainWindow = createWindow();
  mainWindow.webContents.openDevTools();
});



app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

