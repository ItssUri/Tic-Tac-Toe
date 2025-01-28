const iconGen = require('icon-gen');
const path = require('path');

// Input PNG file
const inputFile = path.resolve('./tictactoe.png');
// Output directory
const outputDir = path.resolve('E:\\M6\\tic-tac-toe\\src\\.output\\');

// Generate icons
iconGen(inputFile, outputDir, {
  report: true, // Enable detailed output
  types: ['icns'], // Specify ICNS generation
})
  .then(() => {
    console.log('ICNS file generated successfully!');
  })
  .catch((err) => {
    console.error('Error generating ICNS file:', err);
  });
