/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

var gulp = require('gulp');
var path = require('path');
var ts = require('gulp-typescript');
var log = require('gulp-util').log;
var typescript = require('typescript');
var sourcemaps = require('gulp-sourcemaps');
var mocha = require('gulp-mocha');

var sources = [
    'adapter',
    'common',
    'test',
    'typings',
    'webkit',
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });

var projectConfig = {
    noImplicitAny: false,
    target: 'ES5',
    module: 'commonjs',
    declarationFiles: true,
    typescript: typescript
};

gulp.task('build', function () {
    return gulp.src(sources, { base: '.' })
        .pipe(sourcemaps.init())
        .pipe(ts(projectConfig))
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '/opendebug-webkit' }))
        .pipe(gulp.dest('out'));
});

gulp.task('watch', ['build'], function(cb) {
    log('Watching build sources...');
    return gulp.watch(sources, ['build']);
});

gulp.task('default', ['build']);


function test() {
    return gulp.src('out/test/**/*.test.js', { read: false })
        .pipe(mocha())
        .on('error', function() { });
}

gulp.task('build-test', ['build'], test);
gulp.task('test', test);

gulp.task('watch-build-test', ['build', 'build-test'], function(cb) {
    return gulp.watch(sources, ['build', 'build-test']);
});
