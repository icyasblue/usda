// from https://github.com/icyasblue/utils/blob/master/js/utils.js
// TODO, submodule this

var Utils = {
  // format string the python way (sort of)
  // eg: format('a{0}b{1}c{2}', [1,2,3]) -> 'a1b2c3'
  //     format('a{a}b{b}c{c}', {a:1, b:2, c:3}) -> 'a1b2c3'
  //     format('a{{{}}}{0}b', [1]) -> 'a{{}}1b' // in case of '{' or '}'
  // TODO, handle mix of '{}' and keys in {}
  format : function (str, args) {
    var base = '';
    var open = 0;
    var key = '';
    for (var i = 0; i < str.length; i ++) {
      switch (str[i]) {
        case '{':
          if(open)
            base += '{';
          else
            open = 1;
          break;
        case '}':
          if (open) {
            if (!key) {
              if (str[i+1] == '}')
                base += '}';
              else
                open = 0;
            } else {
              if (args[key] == null || args[key] == undefined) {
                throw('Missing key ' + key + ' in the arguments');
              }
              base += args[key];
              key = '';
              open = 0;
            }
          } else {
            throw('more } than {!');
          }
          break;
        default:
          if (open)
            key += str[i];
          else
            base += str[i];
      }
    }
    return base;
  },

  // merge object properties
  merge: function(dest, obj, override) {
    var ov = override == undefined ? 1 : override;
    for (var key in Object.keys(obj)) {
      if (!override && dest.hasOwnProperty(key))
        continue;
      dest[key] = obj[key];
    }
  },

  // shell_quote
  shell_quote: function (str) {
    return str.replace(/\"/g, "'");
  },

  // TODO, blocking childProcess.spawn, does not work yet
  run: function (cmd, argArr, dir) {
    var running = true;
    var returnCode = 0;
    var spawn = require('child_process').spawn;
    var process = spawn(cmd, argArr, { cwd: dir });
    process.on('close', function (code) {
      running = false;
      returnCode = code;
    });
    while (running) {}
    return returnCode;
  },
};

module.exports = Utils;