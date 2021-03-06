module.exports = function(grunt) {

  grunt.initConfig({
		pkg: grunt.file.readJSON( 'package.json' ),

		sass: {
		  dev: {
		    options: {
		      style: 'expanded',
		      sourcemap: 'none',
		    },
		    files: {
		      'dist/css/style.css': 'src/sass/style.scss'
		    }
		  }
		},

    jshint: {
			files: [ 'Gruntfile.js', 'src/js/**/*.js', 'src/js/*.js' ],
      options: {
        globals: {
          console: true,
        },
        esnext: true
      },
		},

    browserify: {
      dist: {
        options: {
            transform: [
               ['babelify']
            ]
         },
         files: {
            'dist/js/app.js': [ 'src/js/app.js' ]
         }
      }
    },

    jsdoc : {
        dist : {
            src: ['src/js/*.js', 'src/js/helpers.js'],
            options: {
                destination: 'docs',
                access: 'all'

            }
        }
    },

    // Express Server
    express: {
      all: {
        options: {
          port: 9000,
          hostname: 'localhost',
          bases: '.',
          livereload: true
        }
      }
    },

		watch: {
      options: {
        livereload: true
      },
      html: {
        files: [ 'index.html' ],
      },
			css: {
				files: [ 'src/sass/*.scss', 'src/sass/*/*.scss' ],
				tasks: [ 'sass' ]
			},
      js: {
        files: [ 'src/js/*.js','src/js/**/*.js' ],
        tasks: [ 'jshint', 'browserify' ] //jsdoc
      },
		}

   });

	grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-jsdoc');
	grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-express');
	grunt.registerTask('default',['watch']);
  grunt.registerTask('server',['express', 'watch']);

};
