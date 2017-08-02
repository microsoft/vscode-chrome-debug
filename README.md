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
  <a href="https://travis-ci.org/Microsoft/vscode-chrome-debug"><img src="https://api.travis-ci.org/Microsoft/vscode-chrome-debug.svg?branch=master" alt="Travis"></a>
  <a href="https://github.com/microsoft/vscode-chrome-debug/releases"><img src="https://img.shields.io/github/release/Microsoft/vscode-chrome-debug.svg" alt="Release"></a>
    <a href="https://gitter.im/Microsoft/vscode-chrome-debug?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge"><img src="https://badges.gitter.im/Microsoft/vscode-chrome-debug.svg" alt="Release"></a>

</p>


A VS Code extension to debug your JavaScript code in the Google Chrome browser, or other targets that support the [Chrome DevTools Protocol](https://chromedevtools.github.io/debugger-protocol-viewer/).

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

When your launch config is set up, you can debug your project. Pick a launch config from the dropdown on the Debug pane in Code. Press the play button or F5 to start.

### Configuration

The extension operates in two modes - it can launch an instance of Chrome navigated to your app, or it can attach to a running instance of Chrome. Both modes requires you to be serving your web application from local web server, which is started from either a VS Code task or from your commandline. Using the `url` parameter you simply tell VS Code which URL to either open or launch in Chrome.

Just like when using the Node debugger, you configure these modes with a `.vscode/launch.json` file in the root directory of your project. You can create this file manually, or Code will create one for you if you try to run your project, and it doesn't exist yet.

### Launch
Two example `launch.json` configs with `"request": "launch"`. You must specify either `file` or `url` to launch Chrome against a local file or a url. If you use a url, set `webRoot` to the directory that files are served from. This can be either an absolute path or a path using `${workspaceRoot}` (the folder open in Code). `webRoot` is used to resolve urls (like "http://localhost/app.js") to a file on disk (like "/Users/me/project/app.js"), so be careful that it's set correctly.
```json
{
    "version": "0.1.0",
    "configurations": [
        {
            "name": "Launch localhost",
            "type": "chrome",
            "request": "launch",
            "url": "http://localhost/mypage.html",
            "webRoot": "${workspaceRoot}/wwwroot"
        },
        {
            "name": "Launch index.html (disable sourcemaps)",
            "type": "chrome",
            "request": "launch",
            "sourceMaps": false,
            "file": "${workspaceRoot}/index.html"
        },
    ]
}
```

If you want to use a different installation of Chrome, you can also set the "runtimeExecutable" field with a path to the Chrome app.

> Chrome user profile note: Normally, if Chrome is already running when you start debugging with a launch config, then the new instance won't start in remote debugging mode. So by default, the extension launches Chrome with a separate user profile in a temp folder, (unless you are using the "runtimeExecutable" field). Use the `userDataDir` launch config field to override or disable this.

### Attach
With `"request": "attach"`, you must launch Chrome with remote debugging enabled in order for the extension to attach to it. Here's how to do that:

__Windows__
* Right click the Chrome shortcut, and select properties
* In the "target" field, append `--remote-debugging-port=9222`
* Or in a command prompt, execute `<path to chrome>/chrome.exe --remote-debugging-port=9222`

__macOS__
* In a terminal, execute `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222`

__Linux__
* In a terminal, launch `google-chrome --remote-debugging-port=9222`

If you have another instance of Chrome running and don't want to restart it, you can run the new instance under a separate user profile with the  `--user-data-dir` option. Example: `--user-data-dir=/tmp/chrome-debug`. This is the same as using the `userDataDir` option in a launch-type config.

Launch Chrome and navigate to your page.

An example `launch.json` file for an "attach" config.
```json
{
    "version": "0.1.0",
    "configurations": [
        {
            "name": "Attach",
            "type": "chrome",
            "request": "attach",
            "port": 9222,
            "url": "<url of the open browser tab to connect to>",
            "webRoot": "${workspaceRoot}"
        },
        {
            "name": "Attach to url with files served from ./out",
            "type": "chrome",
            "request": "attach",
            "port": 9222,
            "url": "<url of the open browser tab to connect to>",
            "webRoot": "${workspaceRoot}"
        }
    ]
}
```

### Other targets
You can also theoretically attach to other targets that support the same Chrome Debugging protocol, such as Electron or Cordova. These aren't officially supported, but should work with basically the same steps. You can use a launch config by setting `"runtimeExecutable"` to a program or script to launch, or an attach config to attach to a process that's already running. If Code can't find the target, you can always verify that it is actually available by navigating to `http://localhost:<port>/json` in a browser. If you get a response with a bunch of JSON, and can find your target page in that JSON, then the target should be available to this extension.

### Examples
See our wiki page for some configured example apps: [Examples](https://github.com/Microsoft/vscode-chrome-debug/wiki/Examples)


### Other optional launch config fields
* `trace`: When true, the adapter logs its own diagnostic info to this file: `~/.vscode/extensions/msjsdiag.debugger-for-chrome/vscode-chrome-debug.txt`. This is often useful info to include when filing an issue on GitHub. If you set it to "verbose", it will also log to the console.
* `runtimeExecutable`: Workspace relative or absolute path to the runtime executable to be used. If not specified, Chrome will be used from the default install location
* `runtimeArgs`: Optional arguments passed to the runtime executable
* `userDataDir`: Normally, if Chrome is already running when you start debugging with a launch config, then the new instance won't start in remote debugging mode. So by default, the extension launches Chrome with a separate user profile in a temp folder. Use this option to set a different path to use, or set to false to launch with your default user profile.
* `url`: On a 'launch' config, it will launch Chrome at this URL.
* `urlFilter`: On an 'attach' config, or a 'launch' config with no 'url' set, search for a page with this url and attach to it. It can also contain wildcards, for example, `"localhost:*/app"` will match either `"http://localhost:123/app"` or `"http://localhost:456/app"`, but not `"http://stackoverflow.com"`.
* `sourceMaps`: By default, the adapter will use sourcemaps and your original sources whenever possible. You can disable this by setting `sourceMaps` to false.
* `pathMapping`: This property takes a mapping of URL paths to local paths, to give you more flexibility in how URLs are resolved to local files. `"webRoot": "${workspaceRoot}"` is just shorthand for a pathMapping like `{ "/": "${workspaceRoot}" }`.
* `smartStep`: Automatically steps over code that doesn't map to source files. Especially useful for debugging with async/await.
* `disableNetworkCache`: If true, the network cache will be disabled.
* `showAsyncStacks`: If true, callstacks across async calls (like `setTimeout`, `fetch`, resolved Promises, etc) will be shown.

## Skip files / Blackboxing / Ignore files
You can use the `skipFiles` property to ignore/blackbox specific files while debugging. For example, if you set `"skipFiles": ["jquery.js"]`, then you will skip any file named 'jquery.js' when stepping through your code. You also won't break on exceptions thrown from 'jquery.js'. This works the same as "blackboxing scripts" in Chrome DevTools.

The supported formats are:
  * The name of a file (like `jquery.js`)
  * The name of a folder, under which to skip all scripts (like `node_modules`)
  * A path glob, to skip all scripts that match (like `node_modules/react/*.min.js`)

## Page refreshing
This debugger also enables you to refresh your target by simply hitting the `restart` button in the debugger UI. Additionally you can map the refresh action to your favorite keyboard shortcut by using the following key mapping:

```
{
    "key": "ctrl+r",
    "command": "workbench.action.debug.restart",
    "when": "inDebugMode"
}
```
Read more here https://github.com/Microsoft/vscode-chrome-debug-core/issues/91#issuecomment-265027348

## Sourcemaps
The debugger uses sourcemaps to let you debug with your original sources, but sometimes the sourcemaps aren't generated properly and overrides are needed. In the config we support `sourceMapPathOverrides`. A mapping of source paths from the sourcemap, to the locations of these sources on disk. Useful when the sourcemap isn't accurate or can't be fixed in the build process.

The left hand side of the mapping is a pattern that can contain a wildcard, and will be tested against the `sourceRoot` + `sources` entry in the source map. If it matches, the source file will be resolved to the path on the right hand side, which should be an absolute path to the source file on disk.

A few mappings are applied by default, corresponding to the default configs for Webpack and Meteor -
```
"sourceMapPathOverrides": {
    "webpack:///./~/*": "${webRoot}/node_modules/*",       // Example: "webpack:///./~/querystring/index.js" -> "/Users/me/project/node_modules/querystring/index.js"
    "webpack:///./*":   "${webRoot}/*",                    // Example: "webpack:///./src/app.js" -> "/users/me/project/src/app.js",
    "webpack:///*":     "*",                               // Example: "webpack:///C:/project/app.ts" -> "C:/project/app.ts"
    "webpack:///src/*": "${webRoot}/*",                    // Example: "webpack:///src/App.js" -> "C:/project/src/App.js"
    "meteor://💻app/*": "${webRoot}/*"                    // Example: "meteor://💻app/main.ts" -> "c:/code/main.ts"
}
```
If you set `sourceMapPathOverrides` in your launch config, that will override these defaults. `${workspaceRoot}` and `${webRoot}` can be used here. If you aren't sure what the left side should be, you can use the `.scripts` command (details below). You can also use the `trace` option to see the contents of the sourcemap, or look at the paths of the sources in Chrome DevTools, or open your `.js.map` file and check the values manually.

### Ionic/gulp-sourcemaps note
Ionic and gulp-sourcemaps output a sourceRoot of `"/source/"` by default. If you can't fix this via your build config, I suggest this setting:
```
"sourceMapPathOverrides": {
    "/source/*": "${workspaceRoot}/*"
}
```

## Troubleshooting

### Cannot connect to the target: connect ECONNREFUSED 127.0.0.1:9222
This message means that the extension can't attach to Chrome, because Chrome wasn't launched in debug mode. Here are some things to try:
* If using a `launch` type config, close other running instances of Chrome - if Chrome is already running, the extension may not be able to attach, when using launch mode. Chrome can even stay running in the background when all its windows are closed, which will interfere - check the taskbar or kill the process if necessary. Or, set the `userDataDir` property to a temp directory. Chrome will read this and launch a new instance using a different profile than running instances. It can be convenient to set `"userDataDir": "${workspaceRoot}/.vscode/chrome"`.
* If using an `attach` type config, ensure that you launched Chrome using `--remote-debugging-port=9222`. And if there was already a running instance, see the above.
* Ensure that the `port` property matches the port on which Chrome is listening for remote debugging connections. This is `9222` by default. Ensure nothing else is using this port, including your web server. If something else on your computer responds at `http://localhost:9222`, then set a different port.
* If all else fails, try to navigate to `http://localhost:<port>/json` in a browser when you see this message - if there is no response, then something is wrong upstream of the extension. If there is a page of JSON returned, then ensure that the `port` in the launch config matches the port in that url.

### General things to try if you're having issues:
* Ensure `webRoot` is set correctly if needed
* Look at your sourcemap config carefully. A sourcemap has a path to the source files, and this extension uses that path to find the original source files on disk. Check the `sourceRoot` and `sources` properties in your sourcemap and make sure that they can be combined with the `webRoot` property in your launch config to build the correct path to the original source files.
* This extension ignores sources that are inlined in the sourcemap - you may have a setup that works in Chrome Dev Tools, but not this extension, because the paths are incorrect, but Chrome Dev Tools are reading the inlined source content.
* Check the console for warnings that this extension prints in some cases when it can't attach
* Ensure the code in Chrome matches the code in Code. Chrome may cache an old version.
* If your breakpoints bind, but aren't hit, try refreshing the page. If you set a breakpoint in code that runs immediately when the page loads, you won't hit that breakpoint until you refresh the page.
* File a bug in this extension's [GitHub repo](https://github.com/Microsoft/vscode-chrome-debug). Set the "trace" field in your launch config and attach the logs when filing a bug. You can drag this file into the GitHub comment box: `~/.vscode/extensions/msjsdiag.debugger-for-chrome-<version>/vscode-chrome-debug.txt`.

### The `.scripts` command
This feature is extremely useful for understanding how the extension maps files in your workspace to files running in Chrome. You can enter `.scripts` in the debug console to see a listing of all scripts loaded in the runtime, their sourcemap information, and how they are mapped to files on disk. The format is like this:

```
› <The exact URL for a script, reported by Chrome> (<The local path that has been inferred for this script, using webRoot, if applicable>)
    - <The exact source path from the sourcemap> (<The local path inferred for the source, using sourceMapPathOverrides, or webRoot, etc, if applicable>)
```

Example:
```
.scripts
› eval://43
› http://localhost:8080/index.html (/Users/me/project/wwwroot/index.html)
› http://localhost:8080/out/test1.js (/Users/me/project/wwwroot/out/test1.js)
    - /src/test1a.ts (/Users/me/project/wwwroot/src/test1a.ts)
    - /src/test1b.ts (/Users/me/project/wwwroot/src/test1b.ts)
    - /src/test1c.ts (/Users/me/project/wwwroot/src/test1c.ts)
› http://localhost:8080/out/test2.js (/Users/me/project/wwwroot/out/test2.js)
    - /src/test2.ts (/Users/me/project/wwwroot/src/test2.ts)
```

If you are wondering what a script is, for example, that 'eval' script, you can also use `.scripts` to get its contents: `.scripts eval://43`.

===
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
