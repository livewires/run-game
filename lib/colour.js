var $builtinmodule = function(name) {

  var colours = {
    red:         [255,0,0],
    green:       [0,255,0],
    blue:        [0,0,255],
    black:       [0,0,0],
    white:       [255,255,255],
    dark_red:    [127,0,0],
    dark_green:  [0,102,0],
    dark_blue:   [0,0,127],
    dark_grey:   [76,76,76],
    grey:        [127,127,127],
    light_grey:  [178,178,178],
    yellow:      [229,204,0],
    brown:       [127,89,0],
    pink:        [255,0,204],
    purple:      [153,0,178],
  };

  var mod = {};
  for (key in colours) {
    mod[key] = new Sk.builtins['tuple'](colours[key]);
  }
  return mod;

};
