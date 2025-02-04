import { app, BrowserWindow, ipcMain } from 'electron';
import { MongoClient, ChangeStream } from 'mongodb';
import { ObjectId } from "mongodb";
import * as path from 'path';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

// MongoDB configuration
const uri = "mongodb://localhost:27017/";
let client: MongoClient;
let changeStream: ChangeStream | null = null;

// Create a MongoDB connection
async function connectToMongoDB() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    console.log("Connected to MongoDB");
  }
  return client.db('tictactoe');
}

// IPC handler for fetching the initial table data
ipcMain.handle('fetch-movie', async (_event) => {
  console.log("Fetching table...");
  try {
    const database = await connectToMongoDB();
    const game = database.collection('main');

    // Fetch all documents in the collection as an array
    const movies = await game.find().sort({ row: 1, column: 1 }).toArray();
    console.log("Movies fetched: ", movies);

    // Serialize the array to ensure it's safe for IPC
    return JSON.parse(JSON.stringify(movies));
  } catch (error) {
    console.error("Error fetching movies:", error);
    return { error: 'Failed to fetch movies.' };
  }
});

// Set up real-time watching of the MongoDB collection
ipcMain.handle('watch-movie', async (_event) => {
  console.log("Setting up ChangeStream for watching changes...");

  const database = await connectToMongoDB();
  const game = database.collection('main');

  changeStream = game.watch();

  changeStream.on("change", async (change) => {
    console.log("Change detected:", change);

    if (change.operationType === "update") {
      // Fetch the full updated document
      const updatedDocument = await game.findOne({ _id: change.documentKey._id });

      if (updatedDocument) {
        console.log("Sending updated document:", updatedDocument);
        _event.sender.send("movie-change", { ...change, fullDocument: updatedDocument });
      }
    } else {
      // Send the change as is (for insert/delete)
      _event.sender.send("movie-change", change);
    }
  });
});

ipcMain.handle("make-move", async (_event, { row, column }) => {
  console.log(`🔄 Updating database with move at row ${row}, col ${column}...`);
  try {
    const database = await connectToMongoDB();
    const game = database.collection("main");

    // Fetch the current turn
    const turnDoc = await game.findOne({ turn: { $exists: true } });
    if (!turnDoc) {
      throw new Error("Turn document not found!");
    }

    const currentTurn = turnDoc.turn; // Get current turn
    const nextTurn = currentTurn + 1; // Increment turn
 
    // Update the board and turn in a single operation
    await game.updateOne(
      { row, column },
      { $set: { value: "X" } }
    );

    // Update the turn counter
    await game.updateOne(
      { turn: { $exists: true } },
      { $set: { turn: nextTurn } }
    );
    const boardDocs = await game.find().toArray();

    // Ensure only valid board objects are passed to checkWinner
    const board = boardDocs
    .filter(doc => typeof doc.row === "number" && typeof doc.column === "number" && typeof doc.value === "string")
    .map(doc => ({
      row: doc.row, 
      column: doc.column, 
      value: doc.value
    }));

    const winner = checkWinner(board);
    console.log("winner : " + winner)
    await game.updateOne(
      { _id: new ObjectId("67a0fa5fd49631dd0b680655") }, // Match the correct document
      { $set: { winner: winner } }
    );

    console.log(`✅ Move saved! Turn updated to ${nextTurn}`);
    return { success: true, nextTurn };
  } catch (error) {
    console.error("❌ Error making move:", error);
    return { error: "Failed to make move." };
  }
});

ipcMain.handle("clean-table", async (_event) => {
  console.log(`Cleaning Table.`);
  try {
    const database = await connectToMongoDB();
    const game = database.collection("main");

    // Fetch the current turn
    const turnDoc = await game.findOne({ turn: { $exists: true } });
    if (!turnDoc) {
      throw new Error("Turn document not found!");
    }
 
    // Update the board and turn in a single operation
    await game.updateMany(
      { row: { $exists: true }},
      { $set: { value: "" } }
    );

    // Update the turn counter
    await game.updateOne(
      { turn: { $exists: true } },
      { $set: { turn: 1 } }
    );



    console.log(`✅ Move saved! Turn updated to 1`);
    return { success: true};
  } catch (error) {
    console.error("❌ Error making move:", error);
    return { error: "Failed to make move." };
  }
});


// Electron window creation
const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    icon: path.join(__dirname, 'src', 'app.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  return mainWindow;
};

// App lifecycle events
app.on('ready', () => {
  const mainWindow = createWindow();
  mainWindow.setTitle("Tic Tac Toe | Player X")
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    // Close MongoDB connection and change streams on app quit
    console.log("Closing MongoDB connection...");
    if (changeStream) await changeStream.close();
    if (client) await client.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function checkWinner(board: { row: number; column: number; value: string }[]): string | null {
  console.log("Board being checked:", JSON.stringify(board, null, 2));
  const grid: string[][] = Array(3).fill(null).map(() => Array(3).fill(""));

  // Populate the 3x3 grid from the board array
  for (const cell of board) {
    grid[cell.row][cell.column] = cell.value;
  }

  // Winning combinations: Rows, Columns, Diagonals
  const winningLines = [
    // Rows
    [grid[0][0], grid[0][1], grid[0][2]],
    [grid[1][0], grid[1][1], grid[1][2]],
    [grid[2][0], grid[2][1], grid[2][2]],
    // Columns
    [grid[0][0], grid[1][0], grid[2][0]],
    [grid[0][1], grid[1][1], grid[2][1]],
    [grid[0][2], grid[1][2], grid[2][2]],
    // Diagonals
    [grid[0][0], grid[1][1], grid[2][2]],
    [grid[0][2], grid[1][1], grid[2][0]],
  ];

  for (const line of winningLines) {
    if (line[0] && line[0] === line[1] && line[1] === line[2]) {
      return line[0]; // Returns "X" or "O" as the winner
    }
  }
  const isDraw = board.every(cell => cell.value !== "");
  if (isDraw) {
    return "draw";
  } else {
    return "none"
  }
}
