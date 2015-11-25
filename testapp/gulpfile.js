/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

var gulp = require('gulp');
var path = require('path');
var ts = require('gulp-typescript');
var log = require('gulp-util').log;
var typescript = require('typescript');
var sourcemaps = require('gulp-sourcemaps');
var browserSync = require('browser-sync');

var sources = [
    'wwwroot/client'
].map(function (tsFolder) { return tsFolder + '/**/*.ts'; });

var projectConfig = {
    target: 'ES6',
    typescript: typescript
};

gulp.task('build', function () {
    return gulp.src(sources, { base: 'wwwroot' })
        .pipe(sourcemaps.init())
        .pipe(ts(projectConfig))
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '/' }))
        .pipe(gulp.dest('./wwwroot/out'));
});

gulp.task('serve', ['build'], function (done) {
    browserSync({
        online: false,
        open: false,
        port: 8080,
        server: {
            baseDir: ['./wwwroot']
        }
    }, done);
});

gulp.task('bs-reload', ['build'], function() {
    browserSync.reload();
});

gulp.task('watch', ['serve'], function (cb) {
    log('Watching build sources...');
    gulp.watch(sources, ['build', 'bs-reload']);
});

gulp.task('default', ['build']);
