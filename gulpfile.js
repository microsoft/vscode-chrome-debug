/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

const gulp = require('gulp');
const path = require('path');
const ts = require('gulp-typescript');
const log = require('gulp-util').log;
const typescript = require('typescript');
const sourcemaps = require('gulp-sourcemaps');
const tslint = require('gulp-tslint');
const cp = require('child_process');
const mocha = require('gulp-mocha');
const os = require('os');

const sources = [
    'src',
    'test',
    'typings/globals'
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });

const lintSources = [
    'src'
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });

const projectConfig = {
    noImplicitAny: false,
    target: 'ES5',
    module: 'commonjs',
    declaration: true,
    typescript: typescript
};

gulp.task('build', function () {
	return gulp.src(sources, { base: '.' })
        .pipe(sourcemaps.init())
        .pipe(ts(projectConfig)).js
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: 'file:///' + __dirname }))
        .pipe(gulp.dest('out'));
});

gulp.task('watch', ['build'], function(cb) {
    log('Watching build sources...');
    return gulp.watch(sources, ['build']);
});

gulp.task('default', ['build']);

gulp.task('tslint', function() {
      return gulp.src(lintSources, { base: '.' })
        .pipe(tslint())
        .pipe(tslint.report('verbose'));
});

function runTests(child, cb) {
    gulp.src('out/test/**/*.test.js', { read: false })
        .pipe(mocha({ ui: 'tdd' }))
        .on('error', () => {
            // handled
        })
        .on('end', () => {
            if (os.platform() === 'win32') {
                // Windows-only hack, .kill() should work on linux/osx
                const taskKillCmd = 'taskkill /F /T /PID ' + child.pid;
                console.log(taskKillCmd);
                cp.exec(taskKillCmd);
            } else {
                child.kill();
            }

            cb();
        });
}

gulp.task('test', done => {
    const child = cp.spawn('gulp.cmd', ['buildAndServe'], { cwd: './testapp' });

    child.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
    });

    child.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });

    return new Promise(resolve => {
        child.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
            if (data.indexOf("Finished 'buildAndServe'") >= 0) {
                runTests(child, resolve);
            }
        });
    });
});