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
var concat = require('gulp-concat');
var filter = require('gulp-filter');

var sources = [
    'wwwroot/client with space'
].map(function (tsFolder) { return tsFolder + '/**/*.ts'; });

var projectConfig = {
    target: 'ES6',
    typescript: typescript
};

gulp.task('build', function () {
    var test1filter = filter(['**/test1*'], { restore: true});

    return gulp.src(sources, { base: 'wwwroot' })
        .pipe(sourcemaps.init())
        .pipe(ts(projectConfig))
            .pipe(test1filter)
            .pipe(concat('client with space/test1.js'))
            .pipe(test1filter.restore)
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '/' }))
        .pipe(gulp.dest('./wwwroot/out'));
});

function serve(done) {
    browserSync({
        online: false,
        open: false,
        port: 8080,
        server: {
            baseDir: ['./wwwroot']
        }
    }, done);
}

gulp.task('serve', serve);
gulp.task('buildAndServe', ['build'], serve);

gulp.task('bs-reload', ['build'], function() {
    browserSync.reload();
});

gulp.task('watch', ['build', 'serve'], function (cb) {
    log('Watching build sources...');
    gulp.watch(sources, ['build', 'bs-reload']);
});

gulp.task('default', ['build']);
