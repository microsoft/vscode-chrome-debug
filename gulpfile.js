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

const sources = [
    'src',
    'typings/main'
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
