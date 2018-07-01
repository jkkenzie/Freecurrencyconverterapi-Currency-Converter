/**
 * Copyright 2018 jkkenzie@gmail.com Joseph K. Mutai. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import fs from 'fs';
import del from 'del';
import path from 'path';
import cssnano from 'cssnano';
import gulpcssnano from 'gulp-cssnano';
import atImport from 'postcss-import';
import cssnext from 'postcss-cssnext';

import gulp from 'gulp';
import replace from 'gulp-replace';
import htmlmin from 'gulp-htmlmin';
import postcss from 'gulp-postcss';
import concat from 'gulp-concat';
import rev from 'gulp-rev';

import sourcemaps from 'gulp-sourcemaps';
import browserify from 'browserify';
import babelify from 'babelify';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';

import sass from 'gulp-sass';

import uglify from 'gulp-uglify';
import autoprefixer from 'autoprefixer';

import plumber from 'gulp-plumber';


const browserSync = require('browser-sync').create();
import  runSequence from 'run-sequence';

const CRITICAL_STYLES = ['./public/styles/critical/main.css'];
const STYLES = ['./public/styles/*.css'];
const HTML = ['./public/index.html'];


/*
 * Store project files paths
 * @return {getPathsConfig.gulpfileAnonym$0}
 */
const ConfigPathEntries = function ConfigPathEntries() {
    return {
        
        dist: './dist', scripts: `./public/scripts`, html:`./public/index.html`,scss: `./public/scss`,
        etc: [`./public/sw.js`, `./public/**/*.{ico,svg}`, `./public/manifest.json`]
    };
};
const ProjectPaths = ConfigPathEntries();

/*
 * TASK scss
 * Process SCSS(SASS) /CSS
 */
gulp.task('scss', () => gulp.src(`${ProjectPaths.scss}/**/*.scss`)
            .pipe(sourcemaps.init())
            .pipe(sass().on('error', sass.logError))
            .pipe(plumber())  // Error checkpoint
            .pipe(postcss([autoprefixer]))
            .pipe(gulpcssnano())  // Minify results
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest(`${ProjectPaths.dist}/css`)));

const BROWSERS = [
  'last 2 Chrome versions',
  'last 2 Firefox versions',
  'last 2 Safari versions',
  '> 1%',
  'not last 2 OperaMini versions',
];
const CSS_AT_IMPORT = [atImport()];
const CSS_NEXT = [
  cssnext({
    browsers: BROWSERS,
    features: {
      customProperties: {
        preserve: true,
        warnings: false,
      },
      colorFunction: false,
    },
  }),
];
const CSS_NANO = [
  cssnano({
    autoprefixer: false,
    browsers: BROWSERS,
    zindex: false,
    discardComments: {
      removeAll: true,
    },
  }),
];

gulp.task('critical-styles', () =>
  gulp
  .src(CRITICAL_STYLES)
  .pipe(postcss(CSS_AT_IMPORT))
  .pipe(concat('critical.css'))
  .pipe(postcss(CSS_NEXT))
  .pipe(gulp.dest('.temp/styles'))
);

gulp.task('critical-styles-min', () =>
  gulp
  .src('.temp/styles/critical.css')
  .pipe(concat('critical.min.css'))
  .pipe(postcss(CSS_NANO))
  .pipe(gulp.dest('.temp/styles'))
);

gulp.task('noncritical-styles', () => {
  let processedCritical = fs.readFileSync('.temp/styles/critical.css', 'utf8');
  return (
    gulp
    .src(CRITICAL_STYLES.concat(STYLES))
    .pipe(postcss(CSS_AT_IMPORT))
    .pipe(concat('styles.css'))
    .pipe(postcss(CSS_NEXT))
    // Remove all critical styles from the generated file.
    // This allows us to maintain our build pipeline and use information in
    // the critical styles without repeating it in the lazy-loaded ones.
    // Assumes that the pipeline produces deterministic and incremental code.
    .pipe(replace(processedCritical, ''))
    .pipe(gulp.dest('.temp/styles'))
  );
});

gulp.task('noncritical-styles-min', () =>
  gulp
  .src('.temp/styles/styles.css')
  .pipe(concat('styles.min.css'))
  .pipe(postcss(CSS_NANO))
  .pipe(gulp.dest('.temp/styles'))
);

gulp.task('styles-rev', () =>
  gulp
  .src('.temp/styles/styles.min.css')
  .pipe(rev())
  .pipe(gulp.dest('dist/styles'))
//  .pipe(
//    rev.manifest(REV_MANIFEST, {
//      base: '.temp',
//      merge: true,
//    })
//  )
//  .pipe(gulp.dest('.temp'))
);

gulp.task(
  'styles',
  gulp.series(
    'critical-styles',
    gulp.parallel(
      'critical-styles-min',
      gulp.series('noncritical-styles', 'noncritical-styles-min', 'styles-rev')
    )
  )
);
//gulp.task('styles', () => {
//    runSequence('critical-styles', ['critical-styles-min'], ['noncritical-styles', 'noncritical-styles-min']);
//});
/*
 * TASK scripts
 * Bundle scripts, transpile as well
 */
gulp.task('scripts', () => {
    const bundler = browserify(`${ProjectPaths.scripts}/index.js`, {
        debug: true
    }).transform(babelify, {presets: ["babel-preset-env"]});

    return bundler.bundle()
            .on('error', function (error) {
                console.log(error.message);
                this.emit('end');
            })
            .pipe(source('index.js'))
            .pipe(buffer())
            .pipe(uglify())
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest(`${ProjectPaths.dist}/js`));
});

gulp.task('html', () =>
  gulp
  .src(HTML)
  // Inline critical path CSS.
  .pipe(
    replace('<!-- {% include critical css %} -->', (s) => {
      let style = fs.readFileSync('.temp/styles/critical.min.css', 'utf8');
      return '<style>\n' + style + '\n</style>';
    })
  )
  // Inline main JS.
//  .pipe(
//    replace('<!-- {% include main js %} -->', (s) => {
//      let script = fs.readFileSync('.temp/scripts/main.js', 'utf8');
//      return '<script>\n' + script + '\n</script>';
//    })
//  )
  // Replace links with revisioned URLs.
//  .pipe(
//    revReplace({
//      manifest: gulp.src(REV_MANIFEST),
//    })
//  )
  // Minify HTML.
  .pipe(
    htmlmin({
      collapseWhitespace: true,
      removeComments: true,
    })
  )
  .pipe(gulp.dest('dist/'))
);


// Clean the dist folder
gulp.task('clean', done => {
    del([`${ProjectPaths.dist}/**/*`]).then(() => {
        done();
    });
    gulp.task('clean', () => del(['.temp', 'dist']));
});


// Watch Files for Changes
   
gulp.task('watch', function() {
  gulp.watch(`${ProjectPaths.scripts}/**/*.js`, gulp.series('scripts'));
  gulp.watch(ProjectPaths.etc, gulp.series('copy'));
  gulp.watch(ProjectPaths.html, gulp.series('html'));
  //gulp.watch(`$(ProjectPaths.images}/*`, gulp.series('images'));
  gulp.watch(`${ProjectPaths.scss}/**/*.scss`, gulp.series('scss'));

});

// copy documents not necessary for gulp graph or too many to be handled one at a time... haha
gulp.task('copy', () => gulp.src(ProjectPaths.etc).pipe(gulp.dest(ProjectPaths.dist)));

// Serve Files Task: Render for Browser
gulp.task('serve', () => {
    browserSync.init({
        files: [`${ProjectPaths.dist}/**/*`],
        server: {
            baseDir: ProjectPaths.dist
        }
    });
});

// Build Files Task: Just build for deployment
//gulp.task('build', () => {
//    runSequence('clean', ['copy'], ['styles', 'scripts','html']);
//});

gulp.task('build',
  gulp.series('clean',
    gulp.parallel('copy','styles', 'scripts', 'scss'),
    gulp.parallel('html')));

// Gulp Default Task: Build, Serve & Watch
//gulp.task('default', () => {
//    runSequence('clean', ['copy'], ['styles', 'scripts', 'html'], ['serve', 'watch']);
//});

gulp.task('default',
  gulp.series('clean',
    gulp.parallel('copy','styles', 'scripts', 'scss'),
        gulp.parallel('html'),
            gulp.parallel('serve', 'watch')));
