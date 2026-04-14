const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
      width: 1400,
          height: 900,
              minWidth: 900,
                  minHeight: 600,
                      title: 'Turo Fleet Manager',
                          backgroundColor: '#161616',
                              webPreferences: {
                                    nodeIntegration: false,
                                          contextIsolation: true,
                                              },
                                                  show: false,
                                                    });

                                                      mainWindow.loadFile('index.html');

                                                        mainWindow.once('ready-to-show', () => {
                                                            mainWindow.show();
                                                                mainWindow.focus();
                                                                  });

                                                                    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
                                                                        shell.openExternal(url);
                                                                            return { action: 'deny' };
                                                                              });

                                                                                mainWindow.on('closed', () => {
                                                                                    mainWindow = null;
                                                                                      });
                                                                                      }

                                                                                      app.whenReady().then(() => {
                                                                                        createWindow();
                                                                                          app.on('activate', () => {
                                                                                              if (BrowserWindow.getAllWindows().length === 0) createWindow();
                                                                                                });
                                                                                                });

                                                                                                app.on('window-all-closed', () => {
                                                                                                  if (process.platform !== 'darwin') app.quit();
                                                                                                  });
