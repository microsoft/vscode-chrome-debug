/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

var gulp = require('gulp');
var path = require('path');
var ts = require('gulp-typescript');
var log = require('gulp-util').log;
var typescript = require('typescript');
var sourcemaps = require('gulp-sourcemaps');

var sources = [
    'common',
    'node',
    'webkit',
    'typings',
    'mux'
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });

var projectConfig = {
    noImplicitAny: false,
    target: 'ES5',
    module: 'commonjs',
    declarationFiles: true,
    typescript: typescript
};

gulp.task('build', function () {
    gulp.src(sources, { base: '.' })
        .pipe(sourcemaps.init())
        .pipe(ts(projectConfig))
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '/opendebug-webkit' }))
        .pipe(gulp.dest('out'));
});

gulp.task('ts-watch', ['build'], function(cb) {
    log('Watching build sources...');
    gulp.watch(sources, ['build']);
});

gulp.task('default', ['build']);
