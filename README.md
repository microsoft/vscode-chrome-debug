<h1 align="center">
  <br>
    <img src="https://cdn.rawgit.com/Microsoft/vscode-chrome-debug/master/images/icon.png" alt="logo" width="200">
  <br>
  VS Code - Debugger for Chrome
  <br>
  <br>
</h1>

<h4 align="center">Debug your JavaScript code running in Google Chrome from VS Code.</h4>

<p align="center">
  <a href="https://travis-ci.com/Microsoft/vscode-chrome-debug"><img src="https://api.travis-ci.org/Microsoft/vscode-chrome-debug.svg?branch=master" alt="Travis"></a>
  <a href="https://github.com/microsoft/vscode-chrome-debug/releases"><img src="https://img.shields.io/github/release/Microsoft/vscode-chrome-debug.svg" alt="Release"></a>
    <a href="https://gitter.im/Microsoft/vscode-chrome-debug?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge"><img src="https://badges.gitter.im/Microsoft/vscode-chrome-debug.svg" alt="Release"></a>
    
</p>


A VS Code extension to debug your JavaScript code in the Google Chrome browser, or other targets that support the [Chrome Debugging Protocol](https://chromedevtools.github.io/debugger-protocol-viewer/).

![Demo](https://cdn.rawgit.com/Microsoft/vscode-chrome-debug/master/images/demo.gif)

**Supported features**
* Setting breakpoints, including in source files when source maps are enabled
* Stepping, including with the buttons on the Chrome page
* The Locals pane
* Debugging eval scripts, script tags, and scripts that are added dynamically
* Watches
* Console

**Unsupported scenarios**
* Debugging web workers
* Any features that aren't script debugging.

## Getting Started
To use this extension, you must first open the folder containing the project you want to work on.

## Using the debugger

When your launch config is set up, you can debug your project! Pick a launch config from the dropdown on the Debug pane in Code. Press the play button or F5 to start.

### Configuration 

The extension operates in two modes - it can launch an instance of Chrome navigated to your app, or it can attach to a running instance of Chrome. Just like when using the Node debugger, you configure these modes with a `.vscode/launch.json` file in the root directory of your project. You can create this file manually, or Code will create one for you if you try to run your project, and it doesn't exist yet.

### Launch
Two example `launch.json` configs. You must specify either `file` or `url` to launch Chrome against a local file or a url. If you use a url, set `webRoot` to the directory that files are served from. This can be either an absolute path or a path relative to the workspace (the folder open in Code). It's used to resolve urls (like "http://localhost/app.js") to a file on disk (like "/users/me/project/app.js"), so be careful that it's set correctly.
```json
{
    "version": "0.1.0",
    "configurations": [
        {
            "name": "Launch localhost with sourcemaps",
            "type": "chrome",
            "request": "launch",
            "url": "http://localhost/mypage.html",
            "webRoot": "${workspaceRoot}/app/files",
            "sourceMaps": true
        },
        {
            "name": "Launch index.html (without sourcemaps)",
            "type": "chrome",
            "request": "launch",
            "file": "${workspaceRoot}/index.html"
        },
    ]
}
```

If you want to use Chrome from a different directory, you can also set the "runtimeExecutable" field with a path to the Chrome app.

### Attach
You must launch Chrome with remote debugging enabled in order for the extension to attach to it.

__Windows__
* Right click the Chrome shortcut, and select properties
* In the "target" field, append `--remote-debugging-port=9222`
* Or in a command prompt, execute `<path to chrome>/chrome.exe --remote-debugging-port=9222`

__OS X__
* In a terminal, execute `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222`

__Linux__
* In a terminal, launch `google-chrome --remote-debugging-port=9222`

Launch Chrome and navigate to your page.

An example `launch.json` config.
```json
{
    "version": "0.1.0",
    "configurations": [
        {
            "name": "Attach with sourcemaps",
            "type": "chrome",
            "request": "attach",
            "port": 9222,
            "sourceMaps": true
        },
        {
            "name": "Attach to url with files served from ./out",
            "type": "chrome",
            "request": "attach",
            "port": 9222,
            "webRoot": "${workspaceRoot}/out"
        }
    ]
}
```

### Other targets
You can also theoretically attach to other targets that support the same Chrome Debugging protocol, such as Electron or Cordova. These aren't officially supported, but should work with basically the same steps. You can use a launch config by setting `"runtimeExecutable"` to a program or script to launch, or an attach config to attach to a process that's already running. If Code can't find the target, you can always verify that it is actually available by navigating to `http://localhost:<port>/json` in a browser. If you get a response with a bunch of JSON, and can find your target page in that JSON, then the target should be available to this extension.

### Examples
See our wiki page for some configured example apps: [Examples](https://github.com/Microsoft/vscode-chrome-debug/wiki/Examples)


### Other optional launch config fields
* `diagnosticLogging`: When true, the adapter logs its own diagnostic info to the console, _and_ to this file: `~/.vscode/extensions/msjsdiag.debugger-for-chrome/vscode-chrome-debug.txt`. This is often useful info to include when filing an issue on GitHub.
* `runtimeExecutable`: Workspace relative or absolute path to the runtime executable to be used. If not specified, Chrome will be used from the default install location
* `runtimeArgs`: Optional arguments passed to the runtime executable
* `userDataDir`: Can be set to a temp directory, then Chrome will use that directory as the user profile directory. If Chrome is already running when you start debugging with a launch config, then the new instance won't start in remote debugging mode. If you don't want to close the original instance, you can set this property and the new instance will correctly be in remote debugging mode.
* `url`: Required for a 'launch' config. For an attach config, the debugger will search for a tab that has that URL. It can also contain wildcards, for example, `"localhost:*/app"` will match either `"http://localhost:123/app"` or `"http://localhost:456/app"`, but not `"http://stackoverflow.com"`.
* `sourceMapPathOverrides`: A mapping of source paths from the sourcemap, to the locations of these sources on disk. Useful when the sourcemap isn't accurate or can't be fixed during the build process. The left hand side of the mapping is a pattern that can contain a wildcard, and will be tested against the `sourceRoot` + `sources` entry in the source map. If it matches, the source file will be resolved to the path on the right hand side, which should be an absolute path to the source file on disk.
 A couple mappings are applied by default, corresponding to the default configs for Webpack and Meteor -
```
"sourceMapPathOverrides": {
    "webpack:///*": "${webRoot}/*", // Example: "webpack:///src/app.js" -> "/users/me/project/src/app.js"
    "meteor://💻app/*": "${webRoot}/*" // Example: "meteor://💻app/main.ts" -> "c:/code/main.ts"
}
```
If you set `sourceMapPathOverrides` in your launch config, that will override these defaults. `${workspaceRoot}` and `${webRoot}` can be used here. If you aren't sure what the left side should be, you can use the `diagnosticLogging` option to see the contents of the sourcemap, or look at the paths of the sources in Chrome DevTools, or open your `.js.map` file and check the values manually.

## Ionic/gulp-sourcemaps note
Ionic and gulp-sourcemaps output a sourceRoot of `"/source/"` by default. If you can't fix this via your build config, I suggest this setting:
```
"sourceMapPathOverrides": {
    "/source/*": "${workspaceRoot}/*"
}
```

## Troubleshooting
General things to try if you're having issues:
* Ensure `webRoot` is set correctly if needed
* Look at your sourcemap config carefully. A sourcemap has a path to the source files, and this extension uses that path to find the original source files on disk. Check the `sourceRoot` and `sources` properties in your sourcemap and make sure that they can be combined with the `webRoot` property in your launch config to build the correct path to the original source files.
* This extension ignores sources that are inlined in the sourcemap - you may have a setup that works in Chrome Dev Tools, but not this extension, because the paths are incorrect, but Chrome Dev Tools are reading the inlined source content.
* Close other running instances of Chrome - if Chrome is already running, the extension may not be able to attach, when using launch mode. Chrome can even stay running in the background when all its windows are closed, which will interfere - check the taskbar or kill the process if necessary.
* Ensure nothing else is using port 9222, or specify a different port in your launch config
* Check the console for warnings that this extension prints in some cases when it can't attach
* Ensure the code in Chrome matches the code in Code. Chrome may cache an old version.
* If you set a breakpoint in code that runs immediately when the page loads, you won't hit that breakpoint until you refresh the page.
* File a bug in this extension's [GitHub repo](https://github.com/Microsoft/vscode-chrome-debug). Set the "diagnosticLogging" field in your launch config and attach the logs when filing a bug. You can drag this file into the GitHub comment box: `~/.vscode/extensions/msjsdiag.debugger-for-chrome/vscode-chrome-debug.txt`.

===
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
