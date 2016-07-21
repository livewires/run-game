
function get(url, cb) {
  var xhr = new XMLHttpRequest;
  xhr.open("GET", url);
  xhr.send();
  xhr.addEventListener('load', function(e) {
    if (xhr.status !== 200) throw new Error("HTTP " + xhr.status);
    cb(xhr.responseText, e);
  });
}

function getJSON(url, cb) {
  get(url, function(text) {
    cb(JSON.parse(text));
  });
}

function log(text) { 
  console.log(text);
} 

function readBuiltin(name) {
  if (Sk.builtinFiles === undefined ||
      Sk.builtinFiles["files"][name] === undefined) {
    var err = new Error("File not found: '" + name + "'");
    //console.error(err);
    throw err;
  } else {
    //console.log(name)
  }
  return Sk.builtinFiles["files"][name];
}

function runProgram(name, source) {
  Sk.configure({
    output: log,
    read: readBuiltin,
  });

  Sk.misceval.asyncToPromise(function() {
    return Sk.importMainWithBody(name, false, source, true);
  }).then(function(mod) {
    console.log('ok');
  }, function(err) {
    console.error(''+err);
  });
}

var count = 2;
Sk.builtinFiles.files['src/lib/livewires/__init__.js'] = "var $builtinmodule = function(name) { return {}; }";
get('lib/games.js', function(source) {
  Sk.builtinFiles.files['src/lib/livewires/games.js'] = source;
  if (!--count) loaded();
});
get('lib/colour.js', function(source) {
  Sk.builtinFiles.files['src/lib/livewires/colour.js'] = source;
  if (!--count) loaded();
});

var dir;
var gist;
function filePath(file) {
  return gist.files[file].raw_url;
}
function loaded() {
  var path = location.hash.slice(1);
  var parts = path.split('/');
  var sha = parts.shift();
  name = parts.join('/');
  getJSON('https://api.github.com/gists/' + sha, function(json) {
    gist = json;
    var source = json.files[name].content;
    runProgram(name, source);
  });
}

