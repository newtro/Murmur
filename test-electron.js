const electron = require('electron');
console.log('electron type:', typeof electron);
console.log('electron:', electron);
console.log('electron.app:', electron.app);
if (electron.app) {
  electron.app.whenReady().then(() => {
    console.log('App ready!');
    electron.app.quit();
  });
} else {
  process.exit(1);
}
