## 2.3.2
* Fix console.log regression in 2.3.1

## 2.3.1
* Fix crash when refreshing the page in some cases - [#297](https://github.com/Microsoft/vscode-chrome-debug/issues/297)

## 2.3.0
* The restart button will now refresh the page instead of relaunching Chrome (works in Insiders, or VS Code 1.8) - [#91](https://github.com/Microsoft/vscode-chrome-debug-core/issues/91)
* The `experimentalLibraryCode` setting is now called `experimentalSkipFiles`
* The `experimentalSkipFiles` setting now takes a glob pattern instead of a regex - [#127](https://github.com/Microsoft/vscode-chrome-debug-core/issues/127)
* The `experimentalSkipFiles` setting can now take sourcemapped paths to exclude - [#128](https://github.com/Microsoft/vscode-chrome-debug-core/issues/128)
* An issue with breakpoints moving around on a page refresh has hopefully been fixed - [#296](https://github.com/Microsoft/vscode-chrome-debug/issues/296)
* Fix crash "path must be a string" when parsing sourcemaps on some eval scripts - [#268](https://github.com/Microsoft/vscode-chrome-debug/issues/268)
* Fix errors when pausing in chrome extension scripts by blackboxing extension content scripts - [#124](https://github.com/Microsoft/vscode-chrome-debug/issues/124)

## 2.2.2
* Handle another format of Console.MessageAdded - [#276](https://github.com/Microsoft/vscode-chrome-debug/issues/276)
* Fix "Pending breakpoints resolved after refreshing the page sometimes don't bind correctly" - [#279](https://github.com/Microsoft/vscode-chrome-debug/issues/279)
* Strip %c color specifiers - [#282](https://github.com/Microsoft/vscode-chrome-debug/issues/282)

## 2.2.1
* Add the `experimentalLibraryCode` launch option (see README).
* Log unhandled exceptions for [#276](https://github.com/Microsoft/vscode-chrome-debug/issues/276)
* Tweak in-box webpack configs to fit default configs that I've seen.
* Fix "Breakpoints can go to wrong lines when set in merged files on startup" [#277](https://github.com/Microsoft/vscode-chrome-debug/issues/277)

## 2.2.0
* Implement the `.scripts` command in the debug console to print all the scripts loaded in Chrome, their sourcemap details, and inferred local paths, to make it easier to debug a project's debug config. See the README for more details.
* Make the "Add watch" context menu item work much more robustly.
* Fix "Console logs missing in pre-Chrome 54" [#265](https://github.com/Microsoft/vscode-chrome-debug/issues/265)
* Fix "sourceMapPathOverrides matching doesn't work when sourceRoot does not end in /" - [Microsoft/vscode-chrome-debug-core](https://github.com/microsoft/vscode-chrome-debug-core/issues/78)

## 2.1.3
* Error handling for invalid messages from Chrome, to avoid crashing - [#274](https://github.com/Microsoft/vscode-chrome-debug/issues/274)
* Fix potential issue with sourcemap path handling on Windows

## 2.1.2
* Revert an earlier change to the filtering logic, which only worked for vscode 1.7+, and caused some objects to not be expandable - [#273](https://github.com/Microsoft/vscode-chrome-debug/issues/273)

## 2.1.1
* Fix setting breakpoints before startup in scripts that don't have sourcemaps - [Microsoft/vscode-chrome-debug-core#121](https://github.com/Microsoft/vscode-chrome-debug-core/issues/121)
* Fix a certain format of sourceMappingUrl - [#269](https://github.com/Microsoft/vscode-chrome-debug/issues/269)

## 2.1.0
* Object previews - see the first several properties of an object or array inline, without having to expand it - [Microsoft/vscode-chrome-debug-core#120](https://github.com/Microsoft/vscode-chrome-debug-core/issues/120)
* Fix debugging with file:/// paths on windows - [#264](https://github.com/Microsoft/vscode-node-debug2/issues/264)

## 2.0.0
* New feature - set `"smartStep": true` to automatically step over code that doesn't have a sourcemapping - [Microsoft/vscode-chrome-debug-core#34](https://github.com/Microsoft/vscode-chrome-debug-core/issues/34)
* Switch to new log API to fix [#245](https://github.com/Microsoft/vscode-chrome-debug/issues/245)
* Invalid watches say "not available" instead of showing an error - [Microsoft/vscode-node-debug2#31](https://github.com/Microsoft/vscode-node-debug2/issues/31)
* Completions are shown when typing in the console - [Microsoft/vscode-chrome-debug-core#87](https://github.com/Microsoft/vscode-chrome-debug-core/issues/87)
* Variables tree is not jarringly redrawn between steps - [Microsoft/vscode-node-debug2#30](https://github.com/Microsoft/vscode-node-debug2/issues/30)
* Target userAgent is logged under 'diagnosticLogging'
* And a few large non-feature engineering changs

## 1.2.2
* Fix occasional error that can cause breakpoints to not bind

## 1.2.1
* Disable caching downloaded sourcemaps, hoping to fix [#247](https://github.com/Microsoft/vscode-chrome-debug/issues/247)

## 1.2.0
* Change the way that sourcemaps are downloaded, hoping to fix [#251](https://github.com/Microsoft/vscode-chrome-debug/issues/251)
* Fix breakpoints being moved around after refreshing the page - [#250](https://github.com/Microsoft/vscode-chrome-debug/issues/250)
* Fix global eval sometimes failing, and incorrect error handling - [#244](https://github.com/Microsoft/vscode-chrome-debug/issues/244)
* Fix error with sourcemaps for eval scripts - [#256](https://github.com/Microsoft/vscode-chrome-debug/issues/256)

## 1.1.0
* Changed the way that targets are queried for, hoping to fix [#237](https://github.com/Microsoft/vscode-chrome-debug/issues/237)
* Enable breakpoints for fsharp - [#243](https://github.com/Microsoft/vscode-chrome-debug/pull/243) - Thanks @octref
* Fix -core links in changelog - [#239](https://github.com/Microsoft/vscode-chrome-debug/pull/239) - Thanks @marvinhagemeister

## 1.0.0 - Largest update ever!
* Evaluate getters in the variables pane - [Microsoft/vscode-chrome-debug-core#77](https://github.com/Microsoft/vscode-chrome-debug-core/issues/77)
* Paging chunks of large arrays - [Microsoft/vscode-chrome-debug-core#4](https://github.com/Microsoft/vscode-chrome-debug-core/issues/4)
* Show Map/Set members - [Microsoft/vscode-chrome-debug-core#31](https://github.com/Microsoft/vscode-chrome-debug-core/issues/31)
* Show inlined sources when the source can't be resolved to a file on disk - [Microsoft/vscode-chrome-debug-core#85](https://github.com/Microsoft/vscode-chrome-debug-core/issues/85)
* Hover on breakpoints to see error messages when breakpoints don't bind - [Microsoft/vscode-chrome-debug-core#38](https://github.com/Microsoft/vscode-chrome-debug-core/issues/38)
* Editing variable values - [Microsoft/vscode-chrome-debug-core#58](https://github.com/Microsoft/vscode-chrome-debug-core/issues/58)
* Conditional breakpoints - [Microsoft/vscode-chrome-debug-core#10](https://github.com/Microsoft/vscode-chrome-debug-core/issues/10)

## 0.4.8
* Fix for not attaching correctly when using the 'launch' config with Chrome already open - [#79](https://github.com/Microsoft/vscode-chrome-debug/issues/79)
    * Note - as part of this, it will no longer attach to a random tab when it can't find a match using the `"url"` parameter. If that parameter is set in the launch config, there must be a match.
* Make the attach retry logic more resilient.
* Support wildcards in the `"url"` parameter for 'attach' configs - [#200](https://github.com/Microsoft/vscode-chrome-debug/issues/200)
* Fix `NaN` and `Infinity` display - [#190](https://github.com/Microsoft/vscode-chrome-debug/issues/190)
* Fix `sourceMapPathOverrides` doc mistake - [#194](https://github.com/Microsoft/vscode-chrome-debug/issues/194), thanks @lijunle!
