# vscode-webkit-debug
A Visual Studio Code extension to debug your Javascript code on targets that support the WebKit Debug Protocol, such as the Chrome browser.

When this extension is published to the Code extension gallery, installing will be easy! Until then, you need to follow these steps to install it yourself to your user extension directory.

## Install
* Install VS Code from code.visualstudio.com
* Install Python 2.7 (needed to build one of the npm packages)
* Install Chrome
* Install Node

### Windows
* In `C:/Users/<username>/.vscode/extensions/`, `git clone` this repository

### OS X
* `git clone` this repository
* Run `ln -s <path to repo> ~/.vscode/extensions/vsc-webkit`
* You could clone it to the extensions directory if you want, but working with hidden folders in OS X can be a pain.

### Then...
1. `cd` to the folder you just cloned
2. Run `npm install` and `npm install -g gulp`
3. Run `gulp build`

## Starting
The extension operates in two modes - it can launch an instance of Chrome navigated to your app, or it can attach to a running instance of Chrome. Just like when using the Node debugger, you configure these modes with a `.vscode/launch.json` file in the root directory of your project. You can create this file manually, or Code will create one for you if you try to run your project, and it doesn't exist yet.

To use this extension, you must open the folder containing the project you want to work on. (File > Open Folder).

### Launch
An example `launch.json` config.
```
{
    "version": "0.1.0",
    "configurations": [
        {
            // Name your config something useful
            "name": "launch chrome to index.html",
            // This is required to use this extension
            "type": "webkit",
            // To launch Chrome
            "request": "launch",
            // Set either "file" or "url" - "file" if you want to open a local file using the file:/// protocol, or "url" if you want to open a url.
            "file": "out/client/index.html",
            //"url": ["http://localhost:8080/out/client/index.html"],
            // You can set breakpoints in and debug your source files if this is true
            "sourceMaps": true,
            // Required if sourceMaps is enabled, if your output files are not in the same directory as your source files
            "outDir": "out"
        }
    ]
}
```

If you want to use Chrome from a different directory, you can also set the "runtimeExecutable" field with a path to the Chrome app.

### Attach
You must launch Chrome with remote debugging enabled in order for the extension to attach to it.
* Right click the Chrome shortcut
* Click properties
* In the "target" field, append `--remote-debugging-port=9222`
* TODO Directions for OS X?

Launch Chrome and navigate to your page.

An example `launch.json` config.
```
{
    "version": "0.1.0",
    "configurations": [
        {
            "name": "attach to chrome",
            "type": "webkit",
            // Or whatever port you used in the step above
            "port": 9222,
            "request": "attach"
        }
    ]
}
```

## Usage
When your launch config is set up, you can debug your project! Pick a launch config from the dropdown on the Debug pane in Code. Press the play button or F5 to start.

**Things that should work**
* Setting breakpoints, including in source files when source maps are enabled
* Stepping, including with the buttons on the Chrome page
* The Locals pane
* Debugging eval scripts, script tags, and scripts that are added dynamically
* Watches
* The debug console
* Most console APIs

**Unsupported scenarios**
* Debugging webworkers
