/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

const gulp = require('gulp');
const path = require('path');
const ts = require('gulp-typescript');
const log = require('gulp-util').log;
const typescript = require('typescript');
const sourcemaps = require('gulp-sourcemaps');
const browserSync = require('browser-sync');
const concat = require('gulp-concat');
const filter = require('gulp-filter');

const sources = [
    'wwwroot/client with space'
].map(function (tsFolder) { return tsFolder + '/**/*.ts'; });

const tsProject = ts.createProject('tsconfig.json', { typescript });
gulp.task('build', function () {
    const test1filter = filter(['**/test1*'], { restore: true});

    return gulp.src(sources, { base: 'wwwroot' })
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject))
            .pipe(test1filter)
            .pipe(concat('client with space/test1.js'))
            .pipe(test1filter.restore)
        .pipe(sourcemaps.write('.', { includeContent: true, sourceRoot: '/' }))
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
