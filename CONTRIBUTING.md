## Development setup
I welcome any quality bugfixes or contributions!

To avoid a conflict, delete the installed extension at `~/.vscode/extensions/msjsdiag.debugger-for-chrome`.

### Windows
* In `C:/Users/<username>/.vscode/extensions/`, `git clone` this repository

### OS X/Linux
* `git clone` this repository
* Run `ln -s <path to repo> ~/.vscode/extensions/vsc-webkit`
* You could clone it to the extensions directory if you want, but working with hidden folders in OS X can be a pain.

### Then...
* `cd` to the folder you just cloned
* Run `npm install -g gulp` and `npm install`
    * You may see an error if `bufferutil` or `utf-8-validate` fail to build. These native modules required by `ws` are optional and the adapter should work fine without them.
* Run `gulp build`


## Debugging
In VS Code, run the `launch as server` launch config - it will start the adapter as a server listening on port 4712. In your test app launch.json, include this flag at the top level: `"debugServer": "4712"`. Then you'll be able to debug the adapter in the first instance of VS Code, in its original TypeScript, using sourcemaps.

## Testing
There is a set of mocha tests which can be run with `gulp test` or with the `test` launch config. Also run `gulp tslint` to check your code against our tslint rules.

See the project under testapp/ for a bunch of test scenarios crammed onto one page.

## Code
Some files were copied from [the Node adapter](https://github.com/Microsoft/vscode-node-debug) and I'll periodically check for fixes to port over.
* Files under common/
* adapter/sourceMaps/sourceMaps.ts
* adapter/sourceMaps/pathUtilities.ts