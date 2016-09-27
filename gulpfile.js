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
const mocha = require('gulp-mocha');

const sources = [
    'src',
    'test',
    'node_modules/@types',
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });

const lintSources = [
    'src'
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });


function computeSourceRoot(file) {
    // No idea why gulp-sourcemaps insists that 'sources' should be relative to out/, this is probably going to break some day
    return path.relative(path.dirname(file.path), path.join(__dirname, 'out'));
}

const tsProject = ts.createProject('tsconfig.json', { typescript });
gulp.task('build', function () {
	return gulp.src(sources, { base: '.' })
        .pipe(sourcemaps.init())
        .pipe(tsProject()).js
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: computeSourceRoot }))
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

gulp.task('test', function() {
    return gulp.src('out/test/**/*.test.js', { read: false })
        .pipe(mocha({ ui: 'tdd' }))
        .on('error', e => {
            log(e ? e.toString() : 'error in test task!');
            this.emit('end');
        });
})