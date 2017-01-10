/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

const gulp = require('gulp');
const ts = require('gulp-typescript');
const typescript = require('typescript');
const sourcemaps = require('gulp-sourcemaps');
const concat = require('gulp-concat');
const filter = require('gulp-filter');

const tsProject = ts.createProject('tsconfig.json', { typescript });
gulp.task('build', function () {
    const sourceBFilter = filter(['**/sourceB*'], { restore: true });

    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject()).js
            .pipe(sourceBFilter)
            .pipe(concat('b.js'))
            .pipe(sourceBFilter.restore)
        .pipe(sourcemaps.write('.', { includeContent: false }))
        .pipe(gulp.dest('./out'));
});
