var $builtinmodule = function(name) {

  // TODO pygame = {}
  // TODO pygame.transform = {}
  // TODO pygame.mixer.quit()
  // TODO pygame.mixer.init(buffer=512)

  var mod = {};

  var AudioContext = window.AudioContext || window.webkitAudioContext;
  var audioContext = AudioContext && new AudioContext;

  var volumeNode = audioContext.createGain();
  volumeNode.gain.value = 1;
  volumeNode.connect(audioContext.destination);

  var playSound = function(sound) {
    if (!sound.buffer) return;
    if (!sound.node) {
      sound.node = audioContext.createGain();
      sound.node.gain.value = 1;
      sound.node.connect(volumeNode);
    }

    if (sound.source) {
      sound.source.disconnect();
    }
    sound.source = audioContext.createBufferSource();
    sound.source.buffer = sound.buffer;
    sound.source.connect(sound.node);

    sound.source.start(audioContext.currentTime);
  };

  var py = function(j) {
    switch (typeof j) {
      case 'number':
        return Sk.builtin.assk$(j);
      case 'string':
        return new Sk.builtin.str(j);
      case 'boolean':
        return new Sk.builtin.bool(j);
      case 'undefined':
        return undefined;
      case 'object':
        if (j === null) {
          return Sk.builtin.none.none$;
        }
        switch (j.constructor) {
          case Array:
            return new Sk.builtin.list(j.map(py));
          case Wrap:
          case Sk.misceval.Suspension:
          case Sk.builtin.tuple:
            return j;
        }
        // TODO dict
        return j;
    }
  };
  var js = function(p) {
    if (p === undefined || p === null) {
      return p;
    }
    switch (p.constructor) {
      case Sk.builtin.none:
        return null;
      case Sk.builtin.dict:
        // TODO dict
        return p;
      case Sk.builtin.list:
      case Sk.builtin.tuple:
        return p.v.map(js);
      case Sk.builtin.bool:
        return !!p.v;
      case Sk.builtin.int_:
      case Sk.builtin.float_:
      case Sk.builtin.lng:
        return Sk.builtin.asnum$(p);
      case Wrap:
      case Sk.misceval.Suspension:
        return p;
      default:
        return p.v === undefined ? p : p.v;
    }
  };

 var tuple = function(array) {
    return Sk.builtin.tuple(array.map(py));
  };

  var Wrap = function(v) {
    this.value = v;
  };
  var wrap = function(v) {
    if (!v || v.constructor === Wrap) debugger;
    return new Wrap(v);
  };
  var unwrap = function(w) {
    if (!w || w.constructor !== Wrap) debugger;
    return w.value;
  };

  function cls(name, inherits, dict) {
    return mod[name] = Sk.misceval.buildClass(mod, function($gbl, $loc) {
      for (var key in dict) {
        if (!/^_/.test(key)) {
          dict[key].func_code.co_name = key;
        }
        if (/^init/.test(key)) {
          $loc.__init__ = dict[key];
        }
        $loc[key] = dict[key];
      }
    }, name, inherits.map(function(other) { return mod[other]; }));
  }

  function def(defaults, func) {
    var m = /\(([^)]*)\)/.exec(''+func);
    var names = m[1] ? m[1].split(',').map(function(x) { return x.trim(); }) : [];
    var length = names.length;
    if (length !== func.length) {
      debugger;
      throw new Error("oops: " + names);
    }

    defaults = defaults.map(function(value) {
      //if (value === null) return Sk.builtin.none.none$;
      return value;
    });
    var offset = length - defaults.length;

    var def = function() {
      var args = [];
      for (var i=0; i<length; i++) {
        var arg = arguments[i];
        if (arg === undefined) {
          args.push(defaults[i - offset]);
        } else {
          args.push(js(arg));
        }
      }
      return py(func.apply(this, args));
    };
    if (func.name) def.co_name = func.name;
    def.co_varnames = names;
    def.$defaults = defaults;
    def.co_numargs = func.length;
    return new Sk.builtin.func(def);
  }

  var getattr = function(thing, name) {
    return js(Sk.builtin.getattr(thing, py(name)));
  };
  var setattr = function(thing, name, value) {
    return Sk.builtin.setattr(thing, py(name), py(value));
  };
  var call = function(pyFunc/* args */) {
    var args = [pyFunc];
    for (var i=1; i<arguments.length; i++) {
      args.push(py(arguments[i]));
    }
    return js(Sk.misceval.callsim.apply(this, args));
  };

  function promise(func) {
    var susp = new Sk.misceval.Suspension();
    var result;
    susp.resume = function () {
      return result;
    };
    susp.data = {
      type: "Sk.promise",
      promise: new Promise(function(resolve) {
        func(function(value) {
          result = value;
          resolve(py(value));
        });
      }),
    };
    return susp;
  }

  /* * */

  function rgbStyle(rgb) {
    return 'rgb(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ')';
  }

  function makeCanvas(width, height, colour, outline) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // canvas.style.width = width + 'px';
    // canvas.style.height = height + 'px';
    canvas.style.position = 'absolute';
    return canvas;
  }

  function blit(src, dst, x, y) {
    if (src.constructor === Wrap) debugger;
    var ctx = dst.getContext("2d");
    ctx.drawImage(src, x|0, y|0);
  }

  function collideRect(a, b) {
    return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] + a[3] > b[1] && a[1] < b[1] + b[3];
  }

  // nb. 
  //   `self` here is actually an internal thing, accessible only to JS...
  //   only methods are accessible to Python.
  //   I abuse this everywhere, to create "private" variables. Sorry.
  //

  cls('GamesError', [], {});

  cls('Screen', [], {
    init_screen: def([640, 480], function(self, width, height) {
      self.root = document.createElement('div');
      window.document.body.appendChild(self.root);
      self.width = width;
      self.height = height;
      self.root.style.width = width + 'px';
      self.root.style.height = height + 'px';
      self.root.style.position = 'absolute';
      self.root.style.overflow = 'hidden';
      self.root.style.background = '#000';
      call(getattr(self, '_resize'), self);

      setattr(self, '_width', self.width);
      setattr(self, '_height', self.height);

      self.exit = false;
      self.objects = [];
      self.background = makeCanvas(self.width, self.height);
      self.root.appendChild(self.background);

      self.keys = {};
      self._mouseX = 0;
      self._mouseY = 0;
      self._buttons = [0, 0, 0];
      self._events = [];

      var controls = document.createElement('div');
      controls.className = 'keyset';
      window.document.body.appendChild(controls);
      (window.keySet || []).forEach(function(key) {
        var code = keys[key];
        var button = document.createElement('button');
        button.className = 'key';
        button.textContent = key;
        button.addEventListener('click', function(e) {
          self._events.push({ type: 'KEYDOWN', key: code });
        });
        controls.appendChild(button);
      });

      document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.altKey || e.metaKey) {
          return;
        }
        self.keys[e.keyCode] = true;
        e.stopPropagation();
        e.preventDefault();
        self._events.push({ type: 'KEYDOWN', key: e.keyCode });
      });
      document.addEventListener('keyup', function(e) {
        self.keys[e.keyCode] = false;
        e.stopPropagation();
        e.preventDefault();
      });

      document.addEventListener('mousedown', function(e) {
        updateMouse(e);
        self._buttons[e.button] = true;

        self._events.push({
          type: 'MOUSEBUTTONDOWN',
          // TODO translate events
          pos: tuple(toWorld(e.clientX, e.clientY)),
          button: e.button + 1,
        });
        e.preventDefault();
        self.root.focus();
      });
      document.addEventListener('mousemove', function(e) {
        updateMouse(e);
      });
      document.addEventListener('mouseup', function(e) {
        updateMouse(e);
        self._buttons[e.button] = false;
        self._events.push({
          type: 'MOUSEBUTTONUP',
          pos: tuple(toWorld(e.clientX, e.clientY)),
          button: e.button + 1,
        });
      });

      // TODO touch events
      document.addEventListener('touchstart', function(e) {
        self._buttons[1] = true;
        for (var i = 0; i < e.changedTouches.length; i++) {
          updateMouse(e.changedTouches[i]);
          self._events.push({
            type: 'MOUSEBUTTONDOWN',
            pos: tuple([e.clientX, e.clientY]),
            button: 1,
          });
        }
      });
      document.addEventListener('touchmove', function(e) {
        updateMouse(e.changedTouches[0]);
      });
      document.addEventListener('touchend', function(e) {
        self._buttons[1] = false;
        self._events.push({
          type: 'MOUSEBUTTONDOWN',
          pos: tuple([e.clientX, e.clientY]),
          button: 1,
        });
      });

      function toWorld(sx, sy) {
        // TODO
        var x = (sx - self.translateX) / self.scale;
        var y = (sy - self.translateY) / self.scale;
        return [x, y];
      }

      function updateMouse(e) {
        var pos = toWorld(self, e.clientX, e.clientY);
        self.mouseX = pos[0];
        self.mouseY = pos[1];
      }

    }),

    _resize: def([], function(self) {
      var s = Math.min(1, window.innerWidth / self.width, window.innerHeight / self.height);
      var x = (window.innerWidth - self.width * s) / 2;
      var y = (window.innerHeight - self.height * s) / 2;
      self.root.style.transform = (
        'translate(' + x + 'px, ' + y + 'px) ' +
        'scale(' + s + ')'
      );
      self.root.style.transformOrigin = '0 0';
      self.scale = s;
      self.translateX = x;
      self.translateY = y;
    }),

    keypress: def([], function(self, key) {}),
    mouse_down: def([], function(self, pos, button) {}),
    mouse_up: def([], function(self, pos, button) {}),

    is_pressed: def([], function(self, key) {
      return self.keys[key] || false;
    }),
    mouse_buttons: def([], function(self) {
      return tuple(self._buttons.slice(0, 3));
    }),
    mouse_position: def([], function(self) {
      return tuple([self._mouseX, self._mouseY]);
    }),
    set_background: def([], function(self, background) {
      blit(unwrap(background), self.background);
    }),
    set_background_colour: def([], function(self, back_col) {
      // TODO
    }),

    tick: def([], function(self) {}),

    handle_events: def([], function(self) {
      var events = self._events.slice();
      self._events = [];
      for (var i=0; i<events.length; i++) {
        var event = events[i];
        switch (event.type) {
          case 'KEYDOWN':
            call(getattr(self, 'keypress'), event.key);
            break;
          case 'MOUSEBUTTONDOWN':
            call(getattr(self, 'mouse_down'), event.pos, event.button);
            break;
          case 'MOUSEBUTTONUP':
            call(getattr(self, 'mouse_up'), event.pos, event.button);
            break;
        }
      }
    }),

    clear: def([], function(self) {
      // destroy all objects
      for (var i=self.objects.length; i--; ) self.objects[i].destroy();
      self.objects = [];
    }),

    mainloop: def([50], function(self, fps) {
      self.exit = false;

      window.quitGame = function() {
        self.exit = true;
        document.body.removeChild(self.root);
      };

      function frame() {
        call(getattr(self, 'tick'));

        call(getattr(self, '_resize'));

        var objects = self.objects.slice();
        var length = self.objects.length;
        for (var i=0; i<length; i++) {
          var o = objects[i];
          if (o.tickable) {
            call(getattr(o, '_tick'), o);
          }
        }

        for (var i=0; i<length; i++) {
          var o = objects[i];
          if (o.dirty) {
            if (!o._draw) debugger;
            o._draw(o);
          }
          o._transform(o);
        }

        call(getattr(self, 'handle_events'));
      }

      return promise(function(resolve) {
        var interval = setInterval(function() {
          if (self.exit) {
            resolve(Sk.misceval.none);
            return;
          }
          try {
            frame();
          } catch (e) {
            console.error(e);
            clearInterval(interval);
            throw e;
          }
        }, 1000 / fps);
      });
    }),
    quit: def([], function(self) {
      self.exit = true;
      document.body.removeChild(self.root);
    }),

    overlapping_objects: def([], function(self, rectangle) {
      var r = rectangle, x = r[0], y = r[1], w = r[2], h = r[3];
      var objects = self.objects;
      var length = objects.length;
      var results = [];
      for (var i=0; i<length; i++) {
        var o = objects[i];
        if (collideRect(o.bbox, rectangle)) {
          results.push(o);
        }
      }
      return results;
    }),
    all_objects: def([], function(self) {
      return self.objects.slice();
    }),
    add_object: def([], function(self, object) {
      self.objects.push(object);
      if (object.canvas.constructor === Wrap) debugger;
      self.root.appendChild(object.canvas);
      // TODO
    }),
    remove_object: def([], function(self, object) {
      var index = self.objects.indexOf(object);
      if (index === -1) {
        return; // already removed, ok
      }
      self.objects.splice(index, 1);
      self.root.removeChild(object.canvas);
    }),

    // _update_display: def([], function(self)
    // _wait_frame: def([], function(self, fps)
    // _raise(self,: def([], functionit, above=None)
    // _lower(self,: def([], functionobject, below=None)
    // _raise_list(self,: def([], functionobjects, above=None)
    // _lower_list(self,: def([], functionobjects, below=None)
    // add_object: def([], function(self, object)
    // remove_object: def([], function(self, object)
    // blit_and_dirty: def([], function(self, source_surf, dest_pos)
    // blit_background: def([], function(self, rect)

  });

  var Obj = cls('Object', [], {
    __init__: def([0, 0, 0, 0], function(self, screen, x, y, surface, a, x_offset, y_offset, static) {
      self.screen = screen;
      setattr(self, 'screen', screen);
      self.canvas = unwrap(surface);
      call(getattr(self.screen, 'add_object'), self);
      self.x_offset = x_offset;
      self.y_offset = y_offset;
      self.x = 0;
      self.y = 0;
      call(getattr(self, 'move_to'), x, y);
      self.a = 0;
      call(getattr(self, 'rotate_to'), a);
      self.tickable = 0;
      self.gone = 0;
      self._transform(self);
      // nb. ignore 'static'
    }),

    _transform: function(self) {
      var xo = self.x_offset;
      var yo = self.y_offset;
      var x = self.x + xo;
      var y = self.y + yo;
      self.canvas.style.transform = (
        'translate(' + x + 'px, ' + y + 'px) ' +
        'rotate(' + self.a + 'deg)'
      );
      self.canvas.style.transformOrigin = -xo + 'px ' + -yo + 'px';

      // TODO rotated rect
      var w = self.width;
      var h = self.height;
      self.bbox = [x, y, w, h];
    },

    destroy: def([], function(self) {
      call(getattr(self.screen, 'remove_object'), self);
    }),

    pos: def([], function(self) {
      return tuple([self.x, self.y]);
    }),
    xpos: def([], function(self) {
      return self.x;
    }),
    ypos: def([], function(self) {
      return self.y;
    }),
    bbox: def([], function(self) {
      return tuple(self.bbox);
    }),
    move_to: def([null], function(self, x, y) {
      if (typeof x === 'number') {
        self.x = x;
        self.y = y;
      } else {
        self.x = x[0];
        self.y = x[1];
      }
    }),
    move_by: def([null], function(self, x, y) {
      if (typeof x === 'number') {
        self.x += x;
        self.y += y;
      } else {
        self.x += x[0];
        self.y += x[1];
      }
    }),
    rotate_to: def([], function(self, angle) {
      self.a = angle;
    }),
    rotate_by: def([], function(self, angle) {
      self.a += angle;
    }),
    angle: def([], function(self) {
      return self.a % 360;
    }),

    overlaps: def([], function(self, object) {
      // TODO
    }),
    overlapping_objects: def([], function(self) {
      var objects = call(self.screen.overlapping_objects, self.screen, self.bbox);
      var length = objects.length;
      for (var i=0; i<length; i++) {
        if (objects[i] === self) {
          objects.splice(i, 1);
          break;
        }
      }

      // TODO use filter_overlaps

      return objects;
    }),
    filter_overlaps: def([], function(self, object) {
      return 1;
    }),

    raise_object: def([null], function(self, above) {
      // TODO
    }),
    lower_object: def([null], function(self, below) {
      // TODO
    }),

    _draw: function(self, w, h, path) {
      self.canvas.width = w;
      self.canvas.height = h;
      var ctx = self.canvas.getContext("2d");
      ctx.lineWidth = 1;
      ctx.beginPath();
      path(ctx);
      if (self.filled) {
        ctx.fillStyle = rgbStyle(self.colour);
        ctx.fill();
        if (self.outline) {
          ctx.strokeStyle = rgbStyle(self.outline);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = rgbStyle(self.outline || self.colour);
        ctx.stroke();
      }
      self.dirty = false;
    },

    // _erase: def([], function(self)
    // _draw: def([], function(self)
    // replace_image(self,: def([], functionsurface)
    // _replace: def([], function(self, surface)
    // def _rotate(self)
    // _set_offsets(self,: def([], functionx,y)
    // def _fix_offsets(self)
    // def treat_as_dynamic(self)
    // def treat_as_static(self)
  });

  cls('ColourMixin', [], {
    set_colour: def([], function(self, colour) {
      self.colour = colour;
      self.dirty = true;
    }),
    get_colour: def([], function(self) {
      return tuple(self.colour);
    }),
  });

  cls('OutlineMixin', [], {
    set_outline: def([], function(self, outline) {
      self.outline = outline;
      self.dirty = true;
    }),
    get_outline: def([], function(self) {
      return tuple(self.outline);
    }),
  });

  cls('Sprite', ['Object'], {
    init_sprite: def([0, 0], function(self, screen, x, y, image, a, static) {
      image = unwrap(image);
      var x_offset = -image.naturalWidth / 2;
      var y_offset = -image.naturalHeight / 2;
      call(Obj.__init__, self, screen, x, y, wrap(image), a, x_offset, y_offset, static);
    }),
  });

  cls('Polygon', ['Object', 'ColourMixin', 'OutlineMixin'], {
    init_polygon: def([1, null, 0, 1], function(self, screen, x, y, shape, colour, filled, outline, static, thickness) {
      self.canvas = makeCanvas(0, 0);
      self.colour = colour;
      self.outline = outline;
      self.filled = filled;
      self.thickness = thickness;
      self.shape = shape;
      self._draw(self);
      call(Obj.__init__, self, screen, x, y, wrap(self.canvas), 0, self.x_offset, self.y_offset, static);
    }),
    set_shape: def([], function(self, shape) {
      self.shape = shape;
      self.dirty = true;
    }),
    get_shape: def([], function(self) {
      return tuple(self.shape.map(tuple));
    }),
    _draw: function(self) {
      var shape = self.shape;
      var first = shape[0];
      var minx = first[0];
      var miny = first[1];
      var maxx = minx;
      var maxy = miny;
      for (var i=0; i<shape.length; i++) {
        var x = shape[i][0];
        var y = shape[i][1];
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
      self.width = maxx - minx;
      self.height = maxy - miny;
      self.x_offset = minx;
      self.y_offset = miny;

      Obj._draw(self, self.width, self.height, function(ctx) {
        ctx.lineWidth = self.thickness;
        ctx.translate(-minx, -miny);
        ctx.moveTo(first[0], first[1]);
        for (var i=1; i<shape.length; i++) {
          var pos = shape[i];
          ctx.lineTo(pos[0], pos[1]);
        }
        ctx.closePath();
      });
    },
  });

  cls('Circle', ['Object', 'ColourMixin', 'OutlineMixin'], {
    init_circle: def([1, null, 0], function(self, screen, x, y, radius, colour, filled, outline, static) {
      self.canvas = makeCanvas(2 * radius, 2 * radius);
      self.colour = colour;
      self.outline = outline;
      self.filled = filled;
      call(self.set_radius, self, radius); 
      self._draw(self);
      call(Obj.__init__, self, screen, x, y, wrap(self.canvas), 0, self.x_offset, self.y_offset, static);
    }),
    set_radius: def([], function(self, radius) {
      if (self.radius === radius) return;
      self.radius = radius;
      self.x_offset = self.y_offset = -(radius + 1);
      self.width = 2 * (radius + 1)
      self.height = 2 * (radius + 1)
      self.dirty = true;
    }),
    get_radius: def([], function(self) {
      return self.radius;
    }),
    filter_overlaps: def([], function(self, object) {
      // TODO
    }),
    _draw: function(self) {
      var r = self.radius;
      Obj._draw(self, 2 * r + 2, 2 * r + 2, function(ctx) {
        ctx.arc(r + 1, r + 1, r, 0, 2 * Math.PI, false);
      });
    },
  });

  cls('Text', ['Object', 'ColourMixin'], {
    init_text: def([0], function(self, screen, x, y, text, size, colour, static) {
      self.canvas = makeCanvas(0, 0);
      self.text = text;
      self.size = size;
      self.colour = colour;
      self._draw(self);
      call(Obj.__init__, self, screen, x, y, wrap(self.canvas), 0, self.x_offset, self.y_offset, static);
    }),
    set_text: def([], function(self, text) {
      if (self.text === text) return;
      self.text = text;
      self.dirty = true;
    }),
    get_text: def([], function(self) {
      return self.text;
    }),
    _draw: function(self) {
      var ctx = self.canvas.getContext("2d");
      var s = self.size * 0.75;
      var font = '500 ' + s + 'px Arial, sans-serif';
      ctx.font = font;
      var metrics = ctx.measureText(self.text);
      self.canvas.width = self.width = metrics.width;
      self.canvas.height = self.height = s;
      // resizing canvas clears font
      ctx.font = font;
      ctx.clearRect(0, 0, self.width, self.height);
      self.x_offset = -self.width / 2;
      self.y_offset = -self.height / 2;
      ctx.fillStyle = rgbStyle(self.colour);
      ctx.textBaseline = 'middle';
      ctx.fillText(self.text, 0, s / 2);
      self.dirty = false;
    },
  });

  cls('Timer', [], {
    init_timer: def([1, 1], function(self, interval, running) {
      self.tickable = running;
      self.interval = interval;
      self.next = 0;
    }),
    start: def([], function(self) {
      self.tickable = 1;
      self.next = 0;
    }),
    stop: def([], function(self) {
      self.tickable = 0;
    }),
    get_interval: def([], function(self) {
      return self.interval;
    }),
    set_interval: def([], function(self, interval) {
      self.interval = interval;
    }),
    _tick: def([], function(self) {
      self.next++;
      if (self.next >= self.interval) {
        self.next = 0;
        call(getattr(self, 'tick'));
      }
    }),
    tick: def([], function(self) {}),
  });

  cls('Mover', ['Timer'], {
    init_mover: def([0], function(self, dx, dy, da) {
      call(getattr(self, 'set_velocity'), dx, dy);
      call(getattr(self, 'set_angular_speed'), da);
      call(getattr(self, 'init_timer'), 1);
    }),
    get_velocity: def([], function(self) {
      return tuple([self.dx, self.dy]);
    }),
    set_velocity: def([null], function(self, dx, dy) {
      if (typeof dx === 'number') {
        self.dx = dx;
        self.dy = dy;
      } else {
        self.dx = dx[0];
        self.dy = dx[1];
      }
    }),
    get_angular_speed: def([], function(self) {
      return self.da;
    }),
    set_angular_speed: def([], function(self, da) {
      self.da = da;
    }),
    _tick: def([], function(self) {
      self.x += self.dx;
      self.y += self.dy;
      self.a += self.da;
      call(getattr(self, 'moved'));
    }),
    moved: def([], function(self) {}),
  });

  cls('Message', ['Text', 'Timer'], {
    init_message: def([null], function(self, screen, x, y, text, size, colour, lifetime, after_death) {
      self.after_death = after_death;
      call(getattr(self, 'init_text'), screen, x, y, text, size, colour);
      call(getattr(self, 'init_timer'), lifetime);
    }),
    tick: def([], function(self) {
      if (self.after_death) {
        call(self.after_death);
      }
      call(getattr(self, 'stop'));
      call(getattr(self, 'destroy'));
    }),
  });

  cls('Animation', ['Sprite', 'Timer'], {
    init_animation: def([], function(self, screen, x, y, nonrepeating_images, repeating_images, n_repeats, repeat_interval) {
      // TODO
    }),
  });

  /* * */

  var images = [];
  mod.load_image = def([1], function(file, transparent) {
    // TODO transparent
    return promise(function(resolve) {
      var image = new Image;
      image.addEventListener('load', function(e) {
        resolve(wrap(image));
      });
      image.src = window.filePath(file);
      images.push(image);
    });
  });

  mod.load_animation = def([null, 1], function(nonrepeating_files, repeating_files, transparent) {
    if (repeating_files === null) repeating_files = [];
    // TODO
  });

  /* * */

  //mod._have_mixer = ???

  var Sound = cls('Sound', [], {
    __init__: def([], function(self, buffer) {
      self.buffer = buffer;
    }),
    play: def([0, 0, 0], function(self, loops, maxtime, fade_ms) {
      playSound(self);
      // TODO return Channel ?
    }),
    stop: def([], function() {
      // TODO
    }),
    set_volume: def([], function(value) {
      // TODO
    }),
    get_volume: def([], function() {
      // TODO
    }),
    get_length: def([], function() {
      // TODO
    }),
    // fadeout: def([], function(time) { }),
    // get_num_channels: def([], function() { }),
    // get_raw: def([], function() { }),
  });

  mod.load_sound = def([], function(file) {
    return promise(function(resolve) {
      function done(buffer) {
        resolve(Sk.misceval.callsim(Sound, buffer));
      }
      if (!audioContext) {
        done(null);
        return;
      }

      var xhr = new XMLHttpRequest;
      xhr.open('GET', window.filePath(file));
      xhr.responseType = 'arraybuffer';
      xhr.addEventListener('load', function(e) {
        var ab = xhr.response;
        audioContext.decodeAudioData(ab, function(buffer) {
          done(buffer);
        }, function(err) {
          console.warn('Failed to load audio');
          done(null);
        });
      });
      xhr.addEventListener('error', function(e) {
        done(null);
      });
      xhr.send();
    });
    return s;
  });

  /* * */

  var keys = window.keyCodes = {
    UP: 38,
    DOWN: 40,
    LEFT: 37,
    RIGHT: 39,
    SPACE: 32,
    ESCAPE: 27,
    RETURN: 13,
    BACKSPACE: 8,
    TAB: 9,
  };
  for (var i=0; i<=10; i++) { keys[''+i] = i + 48; }
  for (var i=1; i<=12; i++) { keys['F'+i] = i + 111; }
  for (var i=65; i<=90; i++) { keys[String.fromCharCode(i + 32)] = i; }
  for (name in keys) {
    mod['K_' + name] = py(keys[name]);
  }

  return mod;

};
