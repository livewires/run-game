
var inherits = function(cls, sup) {
  cls.prototype = Object.create(sup.prototype);
};

var addEvents = function(cla /*, events... */) {
  [].slice.call(arguments, 1).forEach(function(event) {
    addEvent(cla, event);
  });
};

var addEvent = function(cla, event) {
  var capital = event[0].toUpperCase() + event.substr(1);

  cla.prototype.addEventListener = cla.prototype.addEventListener || function(event, listener) {
    var listeners = this['$' + event] = this['$' + event] || [];
    listeners.push(listener);
    return this;
  };

  cla.prototype.removeEventListener = cla.prototype.removeEventListener || function(event, listener) {
    var listeners = this['$' + event];
    if (listeners) {
      var i = listeners.indexOf(listener);
      if (i !== -1) {
        listeners.splice(i, 1);
      }
    }
    return this;
  };

  cla.prototype.dispatchEvent = cla.prototype.dispatchEvent || function(event, arg) {
    var listeners = this['$' + event];
    if (listeners) {
      listeners.forEach(function(listener) {
        listener(arg);
      });
    }
    var listener = this['on' + event];
    if (listener) {
      listener(arg);
    }
    return this;
  };

  cla.prototype['on' + capital] = function(listener) {
    this.addEventListener(event, listener);
    return this;
  };

  cla.prototype['dispatch' + capital] = function(arg) {
    this.dispatchEvent(event, arg);
    return this;
  };
};


var Request = function() {
  this.loaded = 0;
  this.canceled = false;
};
addEvents(Request, 'load', 'progress', 'error', 'cancel');

Request.prototype.progress = function(loaded, total, lengthComputable) {
  this.loaded = loaded;
  this.total = total;
  this.lengthComputable = lengthComputable;
  this.dispatchProgress({
    loaded: loaded,
    total: total,
    lengthComputable: lengthComputable
  });
};

Request.prototype.load = function(result) {
  if (this.canceled) return;
  this.result = result;
  this.isDone = true;
  this.dispatchLoad(result);
};

Request.prototype.error = function(error) {
  this.result = error;
  this.isError = true;
  this.isDone = true;
  this.dispatchError(error);
};

Request.prototype.cancel = function() {
  if (this.canceled) return;
  this.canceled = true;
  this.dispatchCancel();
};

var CompositeRequest = function() {
  this.requests = [];
  this.isDone = true;
  this.update = this.update.bind(this);
  this.error = this.error.bind(this);
  this.canceled = false;
};
inherits(CompositeRequest, Request);

CompositeRequest.prototype.add = function(request) {
  if (request instanceof CompositeRequest) {
    for (var i = 0; i < request.requests.length; i++) {
      this.add(request.requests[i]);
    }
  } else {
    this.requests.push(request);
    request.addEventListener('progress', this.update);
    request.addEventListener('load', this.update);
    request.addEventListener('error', this.error);
    this.update();
  }
};

CompositeRequest.prototype.cancel = function() {
  if (this.canceled) return;
  this.canceled = true;
  var requests = this.requests;
  var i = requests.length;
  while (i--) {
    var r = requests[i];
    r.cancel();
  }
  this.dispatchCancel();
};

CompositeRequest.prototype.update = function() {
  if (this.canceled) return;
  if (this.isError) return;
  var requests = this.requests;
  var i = requests.length;
  var total = 0;
  var loaded = 0;
  var lengthComputable = true;
  var uncomputable = 0;
  var done = 0;
  while (i--) {
    var r = requests[i];
    loaded += r.loaded;
    if (r.isDone) {
      total += r.loaded;
      done += 1;
    } else if (r.lengthComputable) {
      total += r.total;
    } else {
      lengthComputable = false;
      uncomputable += 1;
    }
  }
  if (!lengthComputable && uncomputable !== requests.length) {
    var each = total / (requests.length - uncomputable) * uncomputable;
    i = requests.length;
    total = 0;
    loaded = 0;
    lengthComputable = true;
    while (i--) {
      var r = requests[i];
      if (r.lengthComputable) {
        loaded += r.loaded;
        total += r.total;
      } else {
        total += each;
        if (r.isDone) loaded += each;
      }
    }
  }
  this.progress(loaded, total, lengthComputable);
  this.doneCount = done;
  this.isDone = done === requests.length;
  if (this.isDone && !this.defer) {
    this.load(this.getResult());
  }
};

CompositeRequest.prototype.getResult = function() {
  throw new Error('Users must implement getResult()');
};


var get = function(url, callback) {
  var request = new Request;
  var xhr = new XMLHttpRequest;
  xhr.open('GET', url, true);
  xhr.onprogress = function(e) {
    request.progress(e.loaded, e.total, e.lengthComputable);
  };
  xhr.onload = function() {
    if (xhr.status === 200) {
      request.load(xhr.response);
    } else {
      request.error(new Error('HTTP ' + xhr.status + ': ' + xhr.statusText));
    }
  };
  xhr.onerror = function() {
    request.error(new Error('XHR Error'));
  };
  xhr.responseType = '';
  setTimeout(xhr.send.bind(xhr));

  if (callback) request.onLoad(callback.bind(null));
  return request;
};

/*****************************************************************************/

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
    console.log(err.traceback.map(function(line) {
      return 'L' + line.lineno + ' in ' + line.filename;
    }).join("\n"));
  });
}

var comp = new CompositeRequest();
var filePath;

function loadHash(hash) {
  comp = new CompositeRequest();

  var bar = document.createElement('div');
  bar.className = 'progress-bar';
  document.body.appendChild(bar);

  Sk.builtinFiles.files['src/lib/livewires/__init__.js'] = "var $builtinmodule = function(name) { return {}; }";

  comp.add(get('lib/games.js', function(source) {
    Sk.builtinFiles.files['src/lib/livewires/games.js'] = source;
  }));
  comp.add(get('lib/colour.js', function(source) {
    Sk.builtinFiles.files['src/lib/livewires/colour.js'] = source;
  }));
  comp.add(get('lib/boards.py', function(source) {
    Sk.builtinFiles.files['src/lib/livewires/boards.py'] = source;
  }));

  var path = hash.slice(1);
  var parts = path.split('/');
  var sha = parts.shift();
  name = parts.join('/');

  var gist;
  comp.add(get('https://api.github.com/gists/' + sha, function(text) {
    gist = JSON.parse(text);
  }));

  comp.getResult = function() {
    bar.style.opacity = '0';

    filePath = function(name) {
      return gist.files[name].raw_url;
    };

    var source = gist.files[name].content;
    name = name.replace(/\.py$/, '');
    runProgram(name, source);
  };

  comp.onProgress(function(data) {
    var progress = data.loaded / data.total;
    bar.style.width = (progress * 100) + '%';
  });

  comp.onError(function() {
    bar.className += ' error';
  });

  comp.onCancel(function() {
    quitGame();
    document.body.removeChild(bar);
  });
}

loadHash(location.hash);
window.addEventListener('hashchange', function(e) {
  comp.cancel();
  loadHash(location.hash);
});

