## :rotating_light: Important

This extension has been deprecated as Visual Studio Code now has a [bundled JavaScript Debugger](https://github.com/microsoft/vscode-js-debug) that covers the same functionality. It is a debugger that debugs Node.js, Chrome, Edge, WebView2, VS Code extensions, and more. You can safely un-install this extension and you will still be able to have the functionality you need.

Please file any issues you encounter in [that repository](https://github.com/microsoft/vscode-js-debug).

---

<h1 align="center">
  <br>
    <img src="https://github.com/Microsoft/vscode-chrome-debug/blob/master/images/icon.png?raw=true" alt="logo" width="200">
  <br>
  VS Code - Debugger for Chrome
  <br>
  <br>
</h1>

<h4 align="center">Debug your JavaScript code running in Google Chrome from VS Code.</h4>

<p align="center">
  <a href="https://vscode.visualstudio.com/1e32b5a6-a974-467b-9d5f-f47e49589c5e/_build/definition?definitionId=9"><img src="https://vscode.visualstudio.com/_apis/public/build/definitions/1e32b5a6-a974-467b-9d5f-f47e49589c5e/9/badge" alt="vsts"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome"><img src="https://vsmarketplacebadge.apphb.com/version/msjsdiag.debugger-for-chrome.svg?label=Debugger%20for%20Chrome" alt="Marketplace bagde"></a>
    <a href="https://gitter.im/Microsoft/vscode-chrome-debug?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge"><img src="https://badges.gitter.im/Microsoft/vscode-chrome-debug.svg" alt="Release"></a>

</p>

A VS Code extension to debug your JavaScript code in the Google Chrome browser, or other targets that support the [Chrome DevTools Protocol](https://chromedevtools.github.io/debugger-protocol-viewer/).

![Demo](https://github.com/Microsoft/vscode-chrome-debug/blob/master/images/demo.gif?raw=true)

**Supported features**
* Setting breakpoints, including in source files when source maps are enabled
* Stepping, including with the buttons on the Chrome page
* The Locals pane
* Debugging eval scripts, script tags, and scripts that are added dynamically
* Watches
* Console

**Unsupported scenarios**
* Debugging web workers
* Debugging Chrome extensions
* Any features that aren't script debugging

## Getting Started
1. [Install the extension](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome)
2. Open the folder containing the project you want to work on.

## Using the debugger

When your launch config is set up, you can debug your project. Pick a launch config from the dropdown on the Debug pane in Code. Press the play button or F5 to start.

### Configuration

The extension operates in two modes - it can launch an instance of Chrome navigated to your app, or it can attach to a running instance of Chrome. Both modes requires you to be serving your web application from local web server, which is started from either a VS Code task or from your command-line. Using the `url` parameter you simply tell VS Code which URL to either open or launch in Chrome.

Just like when using the Node debugger, you configure these modes with a `.vscode/launch.json` file in the root directory of your project. You can create this file manually, or Code will create one for you if you try to run your project, and it doesn't exist yet.

> **Tip**: See recipes for debugging different frameworks here: https://github.com/Microsoft/vscode-recipes

### Launch
Two example `launch.json` configs with `"request": "launch"`. You must specify either `file` or `url` to launch Chrome against a local file or a url. If you use a url, set `webRoot` to the directory that files are served from. This can be either an absolute path or a path using `${workspaceFolder}` (the folder open in Code). `webRoot` is used to resolve urls (like "http://localhost/app.js") to a file on disk (like `/Users/me/project/app.js`), so be careful that it's set correctly.
```json
{
    "version": "0.1.0",
    "configurations": [
        {
            "name": "Launch localhost",
            "type": "chrome",
            "request": "launch",
            "url": "http://localhost/mypage.html",
            "webRoot": "${workspaceFolder}/wwwroot"
        },
        {
            "name": "Launch index.html",
            "type": "chrome",
            "request": "launch",
            "file": "${workspaceFolder}/index.html"
        },
    ]
}
```

If you want to use a different installation of Chrome, you can also set the `runtimeExecutable` field with a path to the Chrome app.

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
            "name": "Attach to url with files served from ./out",
            "type": "chrome",
            "request": "attach",
            "port": 9222,
            "url": "<url of the open browser tab to connect to>",
            "webRoot": "${workspaceFolder}/out"
        }
    ]
}
```

### Chrome user profile note (`Cannot connect to the target: connect ECONNREFUSED`)

Normally, if Chrome is already running when you start debugging with a launch config, then the new instance won't start in remote debugging mode. So by default, the extension launches Chrome with a separate user profile in a temp folder. Use the `userDataDir` launch config field to override or disable this. If you are using the `runtimeExecutable` field, this isn't enabled by default, but you can forcibly enable it with `"userDataDir": true`.

If you are using an attach config, make sure you close other running instances of Chrome before launching a new one with `--remote-debugging-port`. Or, use a new profile with the `--user-data-dir` flag yourself.

For other troubleshooting tips for this error, [see below](#cannot-connect-to-the-target:-connect-ECONNREFUSED-127.0.0.1:9222).

### Errors from chrome-error://chromewebdata

If you see errors with a location like `chrome-error://chromewebdata/` in the error stack, these errors are not from the extension or from your app - they are usually a sign that Chrome was not able to load your app.

When you see these errors, first check whether Chrome was able to load your app. Does Chrome say "This site can't be reached" or something similar? You must start your own server to run your app. Double-check that your server is running, and that the url and port are configured correctly.

### Other targets
You can also theoretically attach to other targets that support the same Chrome Debugging protocol, such as Electron or Cordova. These aren't officially supported, but should work with basically the same steps. You can use a launch config by setting `"runtimeExecutable"` to a program or script to launch, or an attach config to attach to a process that's already running. If Code can't find the target, you can always verify that it is actually available by navigating to `http://localhost:<port>/json` in a browser. If you get a response with a bunch of JSON, and can find your target page in that JSON, then the target should be available to this extension.

### Examples
See our wiki page for some configured example apps: [Examples](https://github.com/Microsoft/vscode-chrome-debug/wiki/Examples)


### Other optional launch config fields
* `trace`: When true, the adapter logs its own diagnostic info to a file. The file path will be printed in the Debug Console. This is often useful info to include when filing an issue on GitHub. If you set it to "verbose", it will also log to the console.
* `runtimeExecutable`: Workspace relative or absolute path to the runtime executable to be used. If not specified, Chrome will be used from the default install location.
* `runtimeArgs`: Optional arguments passed to the runtime executable.
* `env`: Optional dictionary of environment key/value pairs.
* `cwd`: Optional working directory for the runtime executable.
* `userDataDir`: Normally, if Chrome is already running when you start debugging with a launch config, then the new instance won't start in remote debugging mode. So by default, the extension launches Chrome with a separate user profile in a temp folder. Use this option to set a different path to use, or set to false to launch with your default user profile.
* `url`: On a 'launch' config, it will launch Chrome at this URL.
* `urlFilter`: On an 'attach' config, or a 'launch' config with no 'url' set, search for a page with this url and attach to it. It can also contain wildcards, for example, `"localhost:*/app"` will match either `"http://localhost:123/app"` or `"http://localhost:456/app"`, but not `"https://stackoverflow.com"`.
* `targetTypes`: On an 'attach' config, or a 'launch' config with no 'url' set, set a list of acceptable target types from the default `["page"]`. For example, if you are attaching to an Electron app, you might want to set this to `["page", "webview"]`. A value of `null` disables filtering by target type.
* `sourceMaps`: By default, the adapter will use sourcemaps and your original sources whenever possible. You can disable this by setting `sourceMaps` to false.
* `pathMapping`: This property takes a mapping of URL paths to local paths, to give you more flexibility in how URLs are resolved to local files. `"webRoot": "${workspaceFolder}"` is just shorthand for a pathMapping like `{ "/": "${workspaceFolder}" }`.
* `smartStep`: Automatically steps over code that doesn't map to source files. Especially useful for debugging with async/await.
* `disableNetworkCache`: If false, the network cache will be NOT disabled. It is disabled by default.
* `showAsyncStacks`: If true, callstacks across async calls (like `setTimeout`, `fetch`, resolved Promises, etc) will be shown.
* `breakOnLoad`: Experimental. If true, the debug adapter will attempt to set breakpoints in scripts before they are loaded, so it can hit breakpoints at the beginnings of those scripts. Has a perf impact.
* `breakOnLoadStrategy`: The strategy used for `breakOnLoad`. Options are "Instrument" or "Regex". Instrument "[tells] Chrome to pause as each script is loaded, resolving sourcemaps and setting breakpoints" Regex "[s]ets breakpoints optimistically in files with the same name as the file in which the breakpoint is set."

## Skip files / Blackboxing / Ignore files
You can use the `skipFiles` property to ignore/blackbox specific files while debugging. For example, if you set `"skipFiles": ["jquery.js"]`, then you will skip any file named 'jquery.js' when stepping through your code. You also won't break on exceptions thrown from 'jquery.js'. This works the same as "blackboxing scripts" in Chrome DevTools.

The supported formats are:
  * The name of a file (like `jquery.js`)
  * The name of a folder, under which to skip all scripts (like `node_modules`)
  * A path glob, to skip all scripts that match (like `node_modules/react/*.min.js`)

## Page refreshing
This debugger also enables you to refresh your target by simply hitting the restart button in the debugger UI. Additionally you can map the refresh action to your favorite keyboard shortcut by adding the following key mapping to [Key Bindings](https://code.visualstudio.com/docs/getstarted/keybindings):

```json
{
    "key": "ctrl+r",
    "command": "workbench.action.debug.restart",
    "when": "inDebugMode"
}
```
Read more here https://github.com/Microsoft/vscode-chrome-debug-core/issues/91#issuecomment-265027348

## Sourcemaps
The debugger uses sourcemaps to let you debug with your original sources, but sometimes the sourcemaps aren't generated properly and overrides are needed. In the config we support `sourceMapPathOverrides`, a mapping of source paths from the sourcemap, to the locations of these sources on disk. Useful when the sourcemap isn't accurate or can't be fixed in the build process.

The left hand side of the mapping is a pattern that can contain a wildcard, and will be tested against the `sourceRoot` + `sources` entry in the source map. If it matches, the source file will be resolved to the path on the right hand side, which should be an absolute path to the source file on disk.

A few mappings are applied by default, corresponding to some common default configs for Webpack and Meteor:
```javascript
// Note: These are the mappings that are included by default out of the box, with examples of how they could be resolved in different scenarios. These are not mappings that would make sense together in one project.
// webRoot = /Users/me/project
"sourceMapPathOverrides": {
    "webpack:///./~/*": "${webRoot}/node_modules/*",       // Example: "webpack:///./~/querystring/index.js" -> "/Users/me/project/node_modules/querystring/index.js"
    "webpack:///./*":   "${webRoot}/*",                    // Example: "webpack:///./src/app.js" -> "/Users/me/project/src/app.js",
    "webpack:///*":     "*",                               // Example: "webpack:///project/app.ts" -> "/project/app.ts"
    "webpack:///src/*": "${webRoot}/*",                    // Example: "webpack:///src/app.js" -> "/Users/me/project/app.js"
    "meteor://💻app/*": "${webRoot}/*"                    // Example: "meteor://💻app/main.ts" -> "/Users/me/project/main.ts"
}
```
If you set `sourceMapPathOverrides` in your launch config, that will override these defaults. `${workspaceFolder}` and `${webRoot}` can be used here. If you aren't sure what the left side should be, you can use the `.scripts` command (details below). You can also use the `trace` option to see the contents of the sourcemap, or look at the paths of the sources in Chrome DevTools, or open your `.js.map` file and check the values manually.

### Ionic/gulp-sourcemaps note
Ionic and gulp-sourcemaps output a sourceRoot of `"/source/"` by default. If you can't fix this via your build config, I suggest this setting:
```json
"sourceMapPathOverrides": {
    "/source/*": "${workspaceFolder}/*"
}
```

## Usage with remote VS Code extensions

This extension can be used with the [VS Code Remote Extensions](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack) to debug an app in a local Chrome window. Here's an example workflow using the [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) extension:

- Connect to the SSH remote where your project is located
- Launch the development server on the remote
- Run the "Forward Port From Active Host" command to forward the port the server is listening on. For example, if your development server is listening on port 3000, forward port 3000 to the local machine.
- Start your "chrome" launch config
- Chrome should start on the local machine, accessing your app via the forwarded port
- Debugging works as normally

There are a couple caveats to this workflow:
- Since the extension can't currently access the remote disk, sourcemaps can't be read from disk. If sourcemaps are inlined, they will still be used. If possible, they will be downloaded through your webserver.
- In a local window, when resolving your script locations with webRoot/pathMapping, the extension does some searching for the correct script. Again, since the extension can't check the remote disk, the extension can't do this searching, so your webRoot/pathMapping must be exactly accurate to resolve the script location.

If you have any other issues, please open an issue.

## Troubleshooting

### My breakpoints aren't hit. What's wrong?

If your breakpoints aren't hit, it's most likely a sourcemapping issue or because you are having breakpoints in immediately executed code. If you for example have a breakpoint in a `render function` that runs on page load, sometimes our debugger might not be attached to Chrome before the code has been executed. This means that you will have to refresh the page in Chrome after we have attached from VS Code to hit your breakpoint.

Alternatively, we have an experimental "break-on-load" configuration option which will make this timing issue more transparent. It landed in https://github.com/microsoft/vscode-chrome-debug-core/pull/241.

If you have a sourcemapping issue, please see https://github.com/Microsoft/vscode-chrome-debug#sourcemaps

### Cannot connect to the target: connect ECONNREFUSED 127.0.0.1:9222
This message means that the extension can't attach to Chrome, because Chrome wasn't launched in debug mode. Here are some things to try:
* If using an `attach` type config, ensure that you launched Chrome using `--remote-debugging-port=9222`. And if there was already a running instance, close it first or see note about `--user-data-dir` above.
* Ensure that the `port` property matches the port on which Chrome is listening for remote debugging connections. This is `9222` by default. Ensure nothing else is using this port, including your web server. If something else on your computer responds at `http://localhost:9222`, then set a different port.
* If using a `launch` type config with the `userDataDir` option explicitly disabled, close other running instances of Chrome - if Chrome is already running, the extension may not be able to attach, when using launch mode. Chrome can even stay running in the background when all its windows are closed, which will interfere - check the taskbar or kill the process if necessary.
* If all else fails, try to navigate to `http://localhost:<port>/json` in a browser when you see this message - if there is no response, then something is wrong upstream of the extension. If there is a page of JSON returned, then ensure that the `port` in the launch config matches the port in that url.

### General things to try if you're having issues:
* Ensure `webRoot` is set correctly if needed
* Look at your sourcemap config carefully. A sourcemap has a path to the source files, and this extension uses that path to find the original source files on disk. Check the `sourceRoot` and `sources` properties in your sourcemap and make sure that they can be combined with the `webRoot` property in your launch config to build the correct path to the original source files.
* This extension ignores sources that are inlined in the sourcemap - you may have a setup that works in Chrome Dev Tools, but not this extension, because the paths are incorrect, but Chrome Dev Tools are reading the inlined source content.
* Check the console for warnings that this extension prints in some cases when it can't attach.
* Ensure the code in Chrome matches the code in Code. Chrome may cache an old version.
* If your breakpoints bind, but aren't hit, try refreshing the page. If you set a breakpoint in code that runs immediately when the page loads, you won't hit that breakpoint until you refresh the page.
* File a bug in this extension's [GitHub repo](https://github.com/Microsoft/vscode-chrome-debug), including the debug adapter log file. Create the log file by setting the "trace" field in your launch config and reproducing the issue. It will print the path to the log file at the top of the Debug Console. You can drag this file into an issue comment to upload it to GitHub.
* If you're using Webpack, we recommend using the `"devtool": "source-map"` option (in your `webpack.config.js` file) as the others produce lower-fidelity sourcemaps and you may have issues setting breakpoints. See the [full list of devtool options for webpack](https://webpack.js.org/configuration/devtool/) for more information.

### The `.scripts` command
This feature is extremely useful for understanding how the extension maps files in your workspace to files running in Chrome. You can enter `.scripts` in the Debug Console to see a listing of all scripts loaded in the runtime, their sourcemap information, and how they are mapped to files on disk. The format is like this:

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

If the paths of your source files show as not being resolved correctly here, you may have to change `sourceMapPathOverrides` or `webRoot` to help the debugger resolve them to real paths on disk.

If you are wondering what a script is, for example, that 'eval' script, you can also use `.scripts` to get its contents: `.scripts eval://43`.

---

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
