(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var convnetjs = convnetjs || { REVISION: 'ALPHA' };
(function(global) {
  "use strict";

  // Random number utilities
  var return_v = false;
  var v_val = 0.0;
  var gaussRandom = function() {
    if(return_v) { 
      return_v = false;
      return v_val; 
    }
    var u = 2*Math.random()-1;
    var v = 2*Math.random()-1;
    var r = u*u + v*v;
    if(r == 0 || r > 1) return gaussRandom();
    var c = Math.sqrt(-2*Math.log(r)/r);
    v_val = v*c; // cache this
    return_v = true;
    return u*c;
  }
  var randf = function(a, b) { return Math.random()*(b-a)+a; }
  var randi = function(a, b) { return Math.floor(Math.random()*(b-a)+a); }
  var randn = function(mu, std){ return mu+gaussRandom()*std; }

  // Array utilities
  var zeros = function(n) {
    if(typeof(n)==='undefined' || isNaN(n)) { return []; }
    if(typeof ArrayBuffer === 'undefined') {
      // lacking browser support
      var arr = new Array(n);
      for(var i=0;i<n;i++) { arr[i]= 0; }
      return arr;
    } else {
      return new Float64Array(n);
    }
  }

  var arrContains = function(arr, elt) {
    for(var i=0,n=arr.length;i<n;i++) {
      if(arr[i]===elt) return true;
    }
    return false;
  }

  var arrUnique = function(arr) {
    var b = [];
    for(var i=0,n=arr.length;i<n;i++) {
      if(!arrContains(b, arr[i])) {
        b.push(arr[i]);
      }
    }
    return b;
  }

  // return max and min of a given non-empty array.
  var maxmin = function(w) {
    if(w.length === 0) { return {}; } // ... ;s
    var maxv = w[0];
    var minv = w[0];
    var maxi = 0;
    var mini = 0;
    var n = w.length;
    for(var i=1;i<n;i++) {
      if(w[i] > maxv) { maxv = w[i]; maxi = i; } 
      if(w[i] < minv) { minv = w[i]; mini = i; } 
    }
    return {maxi: maxi, maxv: maxv, mini: mini, minv: minv, dv:maxv-minv};
  }

  // create random permutation of numbers, in range [0...n-1]
  var randperm = function(n) {
    var i = n,
        j = 0,
        temp;
    var array = [];
    for(var q=0;q<n;q++)array[q]=q;
    while (i--) {
        j = Math.floor(Math.random() * (i+1));
        temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
  }

  // sample from list lst according to probabilities in list probs
  // the two lists are of same size, and probs adds up to 1
  var weightedSample = function(lst, probs) {
    var p = randf(0, 1.0);
    var cumprob = 0.0;
    for(var k=0,n=lst.length;k<n;k++) {
      cumprob += probs[k];
      if(p < cumprob) { return lst[k]; }
    }
  }

  // syntactic sugar function for getting default parameter values
  var getopt = function(opt, field_name, default_value) {
    return typeof opt[field_name] !== 'undefined' ? opt[field_name] : default_value;
  }

  global.randf = randf;
  global.randi = randi;
  global.randn = randn;
  global.zeros = zeros;
  global.maxmin = maxmin;
  global.randperm = randperm;
  global.weightedSample = weightedSample;
  global.arrUnique = arrUnique;
  global.arrContains = arrContains;
  global.getopt = getopt;
  
})(convnetjs);
(function(global) {
  "use strict";

  // Vol is the basic building block of all data in a net.
  // it is essentially just a 3D volume of numbers, with a
  // width (sx), height (sy), and depth (depth).
  // it is used to hold data for all filters, all volumes,
  // all weights, and also stores all gradients w.r.t. 
  // the data. c is optionally a value to initialize the volume
  // with. If c is missing, fills the Vol with random numbers.
  var Vol = function(sx, sy, depth, c) {
    // this is how you check if a variable is an array. Oh, Javascript :)
    if(Object.prototype.toString.call(sx) === '[object Array]') {
      // we were given a list in sx, assume 1D volume and fill it up
      this.sx = 1;
      this.sy = 1;
      this.depth = sx.length;
      // we have to do the following copy because we want to use
      // fast typed arrays, not an ordinary javascript array
      this.w = global.zeros(this.depth);
      this.dw = global.zeros(this.depth);
      for(var i=0;i<this.depth;i++) {
        this.w[i] = sx[i];
      }
    } else {
      // we were given dimensions of the vol
      this.sx = sx;
      this.sy = sy;
      this.depth = depth;
      var n = sx*sy*depth;
      this.w = global.zeros(n);
      this.dw = global.zeros(n);
      if(typeof c === 'undefined') {
        // weight normalization is done to equalize the output
        // variance of every neuron, otherwise neurons with a lot
        // of incoming connections have outputs of larger variance
        var scale = Math.sqrt(1.0/(sx*sy*depth));
        for(var i=0;i<n;i++) { 
          this.w[i] = global.randn(0.0, scale);
        }
      } else {
        for(var i=0;i<n;i++) { 
          this.w[i] = c;
        }
      }
    }
  }

  Vol.prototype = {
    get: function(x, y, d) { 
      var ix=((this.sx * y)+x)*this.depth+d;
      return this.w[ix];
    },
    set: function(x, y, d, v) { 
      var ix=((this.sx * y)+x)*this.depth+d;
      this.w[ix] = v; 
    },
    add: function(x, y, d, v) { 
      var ix=((this.sx * y)+x)*this.depth+d;
      this.w[ix] += v; 
    },
    get_grad: function(x, y, d) { 
      var ix = ((this.sx * y)+x)*this.depth+d;
      return this.dw[ix]; 
    },
    set_grad: function(x, y, d, v) { 
      var ix = ((this.sx * y)+x)*this.depth+d;
      this.dw[ix] = v; 
    },
    add_grad: function(x, y, d, v) { 
      var ix = ((this.sx * y)+x)*this.depth+d;
      this.dw[ix] += v; 
    },
    cloneAndZero: function() { return new Vol(this.sx, this.sy, this.depth, 0.0)},
    clone: function() {
      var V = new Vol(this.sx, this.sy, this.depth, 0.0);
      var n = this.w.length;
      for(var i=0;i<n;i++) { V.w[i] = this.w[i]; }
      return V;
    },
    addFrom: function(V) { for(var k=0;k<this.w.length;k++) { this.w[k] += V.w[k]; }},
    addFromScaled: function(V, a) { for(var k=0;k<this.w.length;k++) { this.w[k] += a*V.w[k]; }},
    setConst: function(a) { for(var k=0;k<this.w.length;k++) { this.w[k] = a; }},

    toJSON: function() {
      // todo: we may want to only save d most significant digits to save space
      var json = {}
      json.sx = this.sx; 
      json.sy = this.sy;
      json.depth = this.depth;
      json.w = this.w;
      return json;
      // we wont back up gradients to save space
    },
    fromJSON: function(json) {
      this.sx = json.sx;
      this.sy = json.sy;
      this.depth = json.depth;

      var n = this.sx*this.sy*this.depth;
      this.w = global.zeros(n);
      this.dw = global.zeros(n);
      // copy over the elements.
      for(var i=0;i<n;i++) {
        this.w[i] = json.w[i];
      }
    }
  }

  global.Vol = Vol;
})(convnetjs);
(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience

  // Volume utilities
  // intended for use with data augmentation
  // crop is the size of output
  // dx,dy are offset wrt incoming volume, of the shift
  // fliplr is boolean on whether we also want to flip left<->right
  var augment = function(V, crop, dx, dy, fliplr) {
    // note assumes square outputs of size crop x crop
    if(typeof(fliplr)==='undefined') var fliplr = false;
    if(typeof(dx)==='undefined') var dx = global.randi(0, V.sx - crop);
    if(typeof(dy)==='undefined') var dy = global.randi(0, V.sy - crop);
    
    // randomly sample a crop in the input volume
    var W;
    if(crop !== V.sx || dx!==0 || dy!==0) {
      W = new Vol(crop, crop, V.depth, 0.0);
      for(var x=0;x<crop;x++) {
        for(var y=0;y<crop;y++) {
          if(x+dx<0 || x+dx>=V.sx || y+dy<0 || y+dy>=V.sy) continue; // oob
          for(var d=0;d<V.depth;d++) {
           W.set(x,y,d,V.get(x+dx,y+dy,d)); // copy data over
          }
        }
      }
    } else {
      W = V;
    }

    if(fliplr) {
      // flip volume horziontally
      var W2 = W.cloneAndZero();
      for(var x=0;x<W.sx;x++) {
        for(var y=0;y<W.sy;y++) {
          for(var d=0;d<W.depth;d++) {
           W2.set(x,y,d,W.get(W.sx - x - 1,y,d)); // copy data over
          }
        }
      }
      W = W2; //swap
    }
    return W;
  }

  // img is a DOM element that contains a loaded image
  // returns a Vol of size (W, H, 4). 4 is for RGBA
  var img_to_vol = function(img, convert_grayscale) {

    if(typeof(convert_grayscale)==='undefined') var convert_grayscale = false;

    var canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");

    // due to a Firefox bug
    try {
      ctx.drawImage(img, 0, 0);
    } catch (e) {
      if (e.name === "NS_ERROR_NOT_AVAILABLE") {
        // sometimes happens, lets just abort
        return false;
      } else {
        throw e;
      }
    }

    try {
      var img_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
      if(e.name === 'IndexSizeError') {
        return false; // not sure what causes this sometimes but okay abort
      } else {
        throw e;
      }
    }

    // prepare the input: get pixels and normalize them
    var p = img_data.data;
    var W = img.width;
    var H = img.height;
    var pv = []
    for(var i=0;i<p.length;i++) {
      pv.push(p[i]/255.0-0.5); // normalize image pixels to [-0.5, 0.5]
    }
    var x = new Vol(W, H, 4, 0.0); //input volume (image)
    x.w = pv;

    if(convert_grayscale) {
      // flatten into depth=1 array
      var x1 = new Vol(W, H, 1, 0.0);
      for(var i=0;i<W;i++) {
        for(var j=0;j<H;j++) {
          x1.set(i,j,0,x.get(i,j,0));
        }
      }
      x = x1;
    }

    return x;
  }
  
  global.augment = augment;
  global.img_to_vol = img_to_vol;

})(convnetjs);
(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience

  // This file contains all layers that do dot products with input,
  // but usually in a different connectivity pattern and weight sharing
  // schemes: 
  // - FullyConn is fully connected dot products 
  // - ConvLayer does convolutions (so weight sharing spatially)
  // putting them together in one file because they are very similar
  var ConvLayer = function(opt) {
    var opt = opt || {};

    // required
    this.out_depth = opt.filters;
    this.sx = opt.sx; // filter size. Should be odd if possible, it's cleaner.
    this.in_depth = opt.in_depth;
    this.in_sx = opt.in_sx;
    this.in_sy = opt.in_sy;
    
    // optional
    this.sy = typeof opt.sy !== 'undefined' ? opt.sy : this.sx;
    this.stride = typeof opt.stride !== 'undefined' ? opt.stride : 1; // stride at which we apply filters to input volume
    this.pad = typeof opt.pad !== 'undefined' ? opt.pad : 0; // amount of 0 padding to add around borders of input volume
    this.l1_decay_mul = typeof opt.l1_decay_mul !== 'undefined' ? opt.l1_decay_mul : 0.0;
    this.l2_decay_mul = typeof opt.l2_decay_mul !== 'undefined' ? opt.l2_decay_mul : 1.0;

    // computed
    // note we are doing floor, so if the strided convolution of the filter doesnt fit into the input
    // volume exactly, the output volume will be trimmed and not contain the (incomplete) computed
    // final application.
    this.out_sx = Math.floor((this.in_sx + this.pad * 2 - this.sx) / this.stride + 1);
    this.out_sy = Math.floor((this.in_sy + this.pad * 2 - this.sy) / this.stride + 1);
    this.layer_type = 'conv';

    // initializations
    var bias = typeof opt.bias_pref !== 'undefined' ? opt.bias_pref : 0.0;
    this.filters = [];
    for(var i=0;i<this.out_depth;i++) { this.filters.push(new Vol(this.sx, this.sy, this.in_depth)); }
    this.biases = new Vol(1, 1, this.out_depth, bias);
  }
  ConvLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;

      var A = new Vol(this.out_sx, this.out_sy, this.out_depth, 0.0);
      for(var d=0;d<this.out_depth;d++) {
        var f = this.filters[d];
        var x = -this.pad;
        var y = -this.pad;
        for(var ax=0; ax<this.out_sx; x+=this.stride,ax++) {
          y = -this.pad;
          for(var ay=0; ay<this.out_sy; y+=this.stride,ay++) {

            // convolve centered at this particular location
            // could be bit more efficient, going for correctness first
            var a = 0.0;
            for(var fx=0;fx<f.sx;fx++) {
              for(var fy=0;fy<f.sy;fy++) {
                for(var fd=0;fd<f.depth;fd++) {
                  var oy = y+fy; // coordinates in the original input array coordinates
                  var ox = x+fx;
                  if(oy>=0 && oy<V.sy && ox>=0 && ox<V.sx) {
                    //a += f.get(fx, fy, fd) * V.get(ox, oy, fd);
                    // avoid function call overhead for efficiency, compromise modularity :(
                    a += f.w[((f.sx * fy)+fx)*f.depth+fd] * V.w[((V.sx * oy)+ox)*V.depth+fd];
                  }
                }
              }
            }
            a += this.biases.w[d];
            A.set(ax, ay, d, a);
          }
        }
      }
      this.out_act = A;
      return this.out_act;
    },
    backward: function() { 

      // compute gradient wrt weights, biases and input data
      var V = this.in_act;
      V.dw = global.zeros(V.w.length); // zero out gradient wrt bottom data, we're about to fill it
      for(var d=0;d<this.out_depth;d++) {
        var f = this.filters[d];
        var x = -this.pad;
        var y = -this.pad;
        for(var ax=0; ax<this.out_sx; x+=this.stride,ax++) {
          y = -this.pad;
          for(var ay=0; ay<this.out_sy; y+=this.stride,ay++) {
            // convolve and add up the gradients. 
            // could be more efficient, going for correctness first
            var chain_grad = this.out_act.get_grad(ax,ay,d); // gradient from above, from chain rule
            for(var fx=0;fx<f.sx;fx++) {
              for(var fy=0;fy<f.sy;fy++) {
                for(var fd=0;fd<f.depth;fd++) {
                  var oy = y+fy;
                  var ox = x+fx;
                  if(oy>=0 && oy<V.sy && ox>=0 && ox<V.sx) {
                    // forward prop calculated: a += f.get(fx, fy, fd) * V.get(ox, oy, fd);
                    //f.add_grad(fx, fy, fd, V.get(ox, oy, fd) * chain_grad);
                    //V.add_grad(ox, oy, fd, f.get(fx, fy, fd) * chain_grad);

                    // avoid function call overhead and use Vols directly for efficiency
                    var ix1 = ((V.sx * oy)+ox)*V.depth+fd;
                    var ix2 = ((f.sx * fy)+fx)*f.depth+fd;
                    f.dw[ix2] += V.w[ix1]*chain_grad;
                    V.dw[ix1] += f.w[ix2]*chain_grad;
                  }
                }
              }
            }
            this.biases.dw[d] += chain_grad;
          }
        }
      }
    },
    getParamsAndGrads: function() {
      var response = [];
      for(var i=0;i<this.out_depth;i++) {
        response.push({params: this.filters[i].w, grads: this.filters[i].dw, l2_decay_mul: this.l2_decay_mul, l1_decay_mul: this.l1_decay_mul});
      }
      response.push({params: this.biases.w, grads: this.biases.dw, l1_decay_mul: 0.0, l2_decay_mul: 0.0});
      return response;
    },
    toJSON: function() {
      var json = {};
      json.sx = this.sx; // filter size in x, y dims
      json.sy = this.sy;
      json.stride = this.stride;
      json.in_depth = this.in_depth;
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      json.l1_decay_mul = this.l1_decay_mul;
      json.l2_decay_mul = this.l2_decay_mul;
      json.pad = this.pad;
      json.filters = [];
      for(var i=0;i<this.filters.length;i++) {
        json.filters.push(this.filters[i].toJSON());
      }
      json.biases = this.biases.toJSON();
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type;
      this.sx = json.sx; // filter size in x, y dims
      this.sy = json.sy;
      this.stride = json.stride;
      this.in_depth = json.in_depth; // depth of input volume
      this.filters = [];
      this.l1_decay_mul = typeof json.l1_decay_mul !== 'undefined' ? json.l1_decay_mul : 1.0;
      this.l2_decay_mul = typeof json.l2_decay_mul !== 'undefined' ? json.l2_decay_mul : 1.0;
      this.pad = typeof json.pad !== 'undefined' ? json.pad : 0;
      for(var i=0;i<json.filters.length;i++) {
        var v = new Vol(0,0,0,0);
        v.fromJSON(json.filters[i]);
        this.filters.push(v);
      }
      this.biases = new Vol(0,0,0,0);
      this.biases.fromJSON(json.biases);
    }
  }

  var FullyConnLayer = function(opt) {
    var opt = opt || {};

    // required
    // ok fine we will allow 'filters' as the word as well
    this.out_depth = typeof opt.num_neurons !== 'undefined' ? opt.num_neurons : opt.filters;

    // optional 
    this.l1_decay_mul = typeof opt.l1_decay_mul !== 'undefined' ? opt.l1_decay_mul : 0.0;
    this.l2_decay_mul = typeof opt.l2_decay_mul !== 'undefined' ? opt.l2_decay_mul : 1.0;

    // computed
    this.num_inputs = opt.in_sx * opt.in_sy * opt.in_depth;
    this.out_sx = 1;
    this.out_sy = 1;
    this.layer_type = 'fc';

    // initializations
    var bias = typeof opt.bias_pref !== 'undefined' ? opt.bias_pref : 0.0;
    this.filters = [];
    for(var i=0;i<this.out_depth ;i++) { this.filters.push(new Vol(1, 1, this.num_inputs)); }
    this.biases = new Vol(1, 1, this.out_depth, bias);
  }

  FullyConnLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      var A = new Vol(1, 1, this.out_depth, 0.0);
      var Vw = V.w;
      for(var i=0;i<this.out_depth;i++) {
        var a = 0.0;
        var wi = this.filters[i].w;
        for(var d=0;d<this.num_inputs;d++) {
          a += Vw[d] * wi[d]; // for efficiency use Vols directly for now
        }
        a += this.biases.w[i];
        A.w[i] = a;
      }
      this.out_act = A;
      return this.out_act;
    },
    backward: function() {
      var V = this.in_act;
      V.dw = global.zeros(V.w.length); // zero out the gradient in input Vol
      
      // compute gradient wrt weights and data
      for(var i=0;i<this.out_depth;i++) {
        var tfi = this.filters[i];
        var chain_grad = this.out_act.dw[i];
        for(var d=0;d<this.num_inputs;d++) {
          V.dw[d] += tfi.w[d]*chain_grad; // grad wrt input data
          tfi.dw[d] += V.w[d]*chain_grad; // grad wrt params
        }
        this.biases.dw[i] += chain_grad;
      }
    },
    getParamsAndGrads: function() {
      var response = [];
      for(var i=0;i<this.out_depth;i++) {
        response.push({params: this.filters[i].w, grads: this.filters[i].dw, l1_decay_mul: this.l1_decay_mul, l2_decay_mul: this.l2_decay_mul});
      }
      response.push({params: this.biases.w, grads: this.biases.dw, l1_decay_mul: 0.0, l2_decay_mul: 0.0});
      return response;
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      json.num_inputs = this.num_inputs;
      json.l1_decay_mul = this.l1_decay_mul;
      json.l2_decay_mul = this.l2_decay_mul;
      json.filters = [];
      for(var i=0;i<this.filters.length;i++) {
        json.filters.push(this.filters[i].toJSON());
      }
      json.biases = this.biases.toJSON();
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type;
      this.num_inputs = json.num_inputs;
      this.l1_decay_mul = typeof json.l1_decay_mul !== 'undefined' ? json.l1_decay_mul : 1.0;
      this.l2_decay_mul = typeof json.l2_decay_mul !== 'undefined' ? json.l2_decay_mul : 1.0;
      this.filters = [];
      for(var i=0;i<json.filters.length;i++) {
        var v = new Vol(0,0,0,0);
        v.fromJSON(json.filters[i]);
        this.filters.push(v);
      }
      this.biases = new Vol(0,0,0,0);
      this.biases.fromJSON(json.biases);
    }
  }

  global.ConvLayer = ConvLayer;
  global.FullyConnLayer = FullyConnLayer;
  
})(convnetjs);
(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience
  
  var PoolLayer = function(opt) {

    var opt = opt || {};

    // required
    this.sx = opt.sx; // filter size
    this.in_depth = opt.in_depth;
    this.in_sx = opt.in_sx;
    this.in_sy = opt.in_sy;

    // optional
    this.sy = typeof opt.sy !== 'undefined' ? opt.sy : this.sx;
    this.stride = typeof opt.stride !== 'undefined' ? opt.stride : 2;
    this.pad = typeof opt.pad !== 'undefined' ? opt.pad : 0; // amount of 0 padding to add around borders of input volume

    // computed
    this.out_depth = this.in_depth;
    this.out_sx = Math.floor((this.in_sx + this.pad * 2 - this.sx) / this.stride + 1);
    this.out_sy = Math.floor((this.in_sy + this.pad * 2 - this.sy) / this.stride + 1);
    this.layer_type = 'pool';
    // store switches for x,y coordinates for where the max comes from, for each output neuron
    this.switchx = global.zeros(this.out_sx*this.out_sy*this.out_depth);
    this.switchy = global.zeros(this.out_sx*this.out_sy*this.out_depth);
  }

  PoolLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;

      var A = new Vol(this.out_sx, this.out_sy, this.out_depth, 0.0);
      
      var n=0; // a counter for switches
      for(var d=0;d<this.out_depth;d++) {
        var x = -this.pad;
        var y = -this.pad;
        for(var ax=0; ax<this.out_sx; x+=this.stride,ax++) {
          y = -this.pad;
          for(var ay=0; ay<this.out_sy; y+=this.stride,ay++) {

            // convolve centered at this particular location
            var a = -99999; // hopefully small enough ;\
            var winx=-1,winy=-1;
            for(var fx=0;fx<this.sx;fx++) {
              for(var fy=0;fy<this.sy;fy++) {
                var oy = y+fy;
                var ox = x+fx;
                if(oy>=0 && oy<V.sy && ox>=0 && ox<V.sx) {
                  var v = V.get(ox, oy, d);
                  // perform max pooling and store pointers to where
                  // the max came from. This will speed up backprop 
                  // and can help make nice visualizations in future
                  if(v > a) { a = v; winx=ox; winy=oy;}
                }
              }
            }
            this.switchx[n] = winx;
            this.switchy[n] = winy;
            n++;
            A.set(ax, ay, d, a);
          }
        }
      }
      this.out_act = A;
      return this.out_act;
    },
    backward: function() { 
      // pooling layers have no parameters, so simply compute 
      // gradient wrt data here
      var V = this.in_act;
      V.dw = global.zeros(V.w.length); // zero out gradient wrt data
      var A = this.out_act; // computed in forward pass 

      var n = 0;
      for(var d=0;d<this.out_depth;d++) {
        var x = -this.pad;
        var y = -this.pad;
        for(var ax=0; ax<this.out_sx; x+=this.stride,ax++) {
          y = -this.pad;
          for(var ay=0; ay<this.out_sy; y+=this.stride,ay++) {

            var chain_grad = this.out_act.get_grad(ax,ay,d);
            V.add_grad(this.switchx[n], this.switchy[n], d, chain_grad);
            n++;

          }
        }
      }
    },
    getParamsAndGrads: function() {
      return [];
    },
    toJSON: function() {
      var json = {};
      json.sx = this.sx;
      json.sy = this.sy;
      json.stride = this.stride;
      json.in_depth = this.in_depth;
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      json.pad = this.pad;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type;
      this.sx = json.sx;
      this.sy = json.sy;
      this.stride = json.stride;
      this.in_depth = json.in_depth;
      this.pad = typeof json.pad !== 'undefined' ? json.pad : 0; // backwards compatibility
      this.switchx = global.zeros(this.out_sx*this.out_sy*this.out_depth); // need to re-init these appropriately
      this.switchy = global.zeros(this.out_sx*this.out_sy*this.out_depth);
    }
  }

  global.PoolLayer = PoolLayer;

})(convnetjs);

(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience
  
  var InputLayer = function(opt) {
    var opt = opt || {};

    // this is a bit silly but lets allow people to specify either ins or outs
    this.out_sx = typeof opt.out_sx !== 'undefined' ? opt.out_sx : opt.in_sx;
    this.out_sy = typeof opt.out_sy !== 'undefined' ? opt.out_sy : opt.in_sy;
    this.out_depth = typeof opt.out_depth !== 'undefined' ? opt.out_depth : opt.in_depth;
    this.layer_type = 'input';
  }
  InputLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      this.out_act = V;
      return this.out_act; // dummy identity function for now
    },
    backward: function() { },
    getParamsAndGrads: function() {
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type; 
    }
  }

  global.InputLayer = InputLayer;
})(convnetjs);
(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience
  
  // Layers that implement a loss. Currently these are the layers that 
  // can initiate a backward() pass. In future we probably want a more 
  // flexible system that can accomodate multiple losses to do multi-task
  // learning, and stuff like that. But for now, one of the layers in this
  // file must be the final layer in a Net.

  // This is a classifier, with N discrete classes from 0 to N-1
  // it gets a stream of N incoming numbers and computes the softmax
  // function (exponentiate and normalize to sum to 1 as probabilities should)
  var SoftmaxLayer = function(opt) {
    var opt = opt || {};

    // computed
    this.num_inputs = opt.in_sx * opt.in_sy * opt.in_depth;
    this.out_depth = this.num_inputs;
    this.out_sx = 1;
    this.out_sy = 1;
    this.layer_type = 'softmax';
  }

  SoftmaxLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;

      var A = new Vol(1, 1, this.out_depth, 0.0);

      // compute max activation
      var as = V.w;
      var amax = V.w[0];
      for(var i=1;i<this.out_depth;i++) {
        if(as[i] > amax) amax = as[i];
      }

      // compute exponentials (carefully to not blow up)
      var es = global.zeros(this.out_depth);
      var esum = 0.0;
      for(var i=0;i<this.out_depth;i++) {
        var e = Math.exp(as[i] - amax);
        esum += e;
        es[i] = e;
      }

      // normalize and output to sum to one
      for(var i=0;i<this.out_depth;i++) {
        es[i] /= esum;
        A.w[i] = es[i];
      }

      this.es = es; // save these for backprop
      this.out_act = A;
      return this.out_act;
    },
    backward: function(y) {

      // compute and accumulate gradient wrt weights and bias of this layer
      var x = this.in_act;
      x.dw = global.zeros(x.w.length); // zero out the gradient of input Vol

      for(var i=0;i<this.out_depth;i++) {
        var indicator = i === y ? 1.0 : 0.0;
        var mul = -(indicator - this.es[i]);
        x.dw[i] = mul;
      }

      // loss is the class negative log likelihood
      return -Math.log(this.es[y]);
    },
    getParamsAndGrads: function() { 
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      json.num_inputs = this.num_inputs;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type;
      this.num_inputs = json.num_inputs;
    }
  }

  // implements an L2 regression cost layer,
  // so penalizes \sum_i(||x_i - y_i||^2), where x is its input
  // and y is the user-provided array of "correct" values.
  var RegressionLayer = function(opt) {
    var opt = opt || {};

    // computed
    this.num_inputs = opt.in_sx * opt.in_sy * opt.in_depth;
    this.out_depth = this.num_inputs;
    this.out_sx = 1;
    this.out_sy = 1;
    this.layer_type = 'regression';
  }

  RegressionLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      this.out_act = V;
      return V; // identity function
    },
    // y is a list here of size num_inputs
    backward: function(y) { 

      // compute and accumulate gradient wrt weights and bias of this layer
      var x = this.in_act;
      x.dw = global.zeros(x.w.length); // zero out the gradient of input Vol
      var loss = 0.0;
      if(y instanceof Array || y instanceof Float64Array) {
        for(var i=0;i<this.out_depth;i++) {
          var dy = x.w[i] - y[i];
          x.dw[i] = dy;
          loss += 2*dy*dy;
        }
      } else {
        // assume it is a struct with entries .dim and .val
        // and we pass gradient only along dimension dim to be equal to val
        var i = y.dim;
        var yi = y.val;
        var dy = x.w[i] - yi;
        x.dw[i] = dy;
        loss += 2*dy*dy;
      }
      return loss;
    },
    getParamsAndGrads: function() { 
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      json.num_inputs = this.num_inputs;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type;
      this.num_inputs = json.num_inputs;
    }
  }

  var SVMLayer = function(opt) {
    var opt = opt || {};

    // computed
    this.num_inputs = opt.in_sx * opt.in_sy * opt.in_depth;
    this.out_depth = this.num_inputs;
    this.out_sx = 1;
    this.out_sy = 1;
    this.layer_type = 'svm';
  }

  SVMLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      this.out_act = V; // nothing to do, output raw scores
      return V;
    },
    backward: function(y) {

      // compute and accumulate gradient wrt weights and bias of this layer
      var x = this.in_act;
      x.dw = global.zeros(x.w.length); // zero out the gradient of input Vol

      var yscore = x.w[y]; // score of ground truth
      var margin = 1.0;
      var loss = 0.0;
      for(var i=0;i<this.out_depth;i++) {
        if(-yscore + x.w[i] + margin > 0) {
          // violating example, apply loss
          // I love hinge loss, by the way. Truly.
          // Seriously, compare this SVM code with Softmax forward AND backprop code above
          // it's clear which one is superior, not only in code, simplicity
          // and beauty, but also in practice.
          x.dw[i] += 1;
          x.dw[y] -= 1;
          loss += -yscore + x.w[i] + margin;
        }
      }

      return loss;
    },
    getParamsAndGrads: function() { 
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      json.num_inputs = this.num_inputs;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type;
      this.num_inputs = json.num_inputs;
    }
  }
  
  global.RegressionLayer = RegressionLayer;
  global.SoftmaxLayer = SoftmaxLayer;
  global.SVMLayer = SVMLayer;

})(convnetjs);

(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience
  
  // Implements ReLU nonlinearity elementwise
  // x -> max(0, x)
  // the output is in [0, inf)
  var ReluLayer = function(opt) {
    var opt = opt || {};

    // computed
    this.out_sx = opt.in_sx;
    this.out_sy = opt.in_sy;
    this.out_depth = opt.in_depth;
    this.layer_type = 'relu';
  }
  ReluLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      var V2 = V.clone();
      var N = V.w.length;
      var V2w = V2.w;
      for(var i=0;i<N;i++) { 
        if(V2w[i] < 0) V2w[i] = 0; // threshold at 0
      }
      this.out_act = V2;
      return this.out_act;
    },
    backward: function() {
      var V = this.in_act; // we need to set dw of this
      var V2 = this.out_act;
      var N = V.w.length;
      V.dw = global.zeros(N); // zero out gradient wrt data
      for(var i=0;i<N;i++) {
        if(V2.w[i] <= 0) V.dw[i] = 0; // threshold
        else V.dw[i] = V2.dw[i];
      }
    },
    getParamsAndGrads: function() {
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type; 
    }
  }

  // Implements Sigmoid nnonlinearity elementwise
  // x -> 1/(1+e^(-x))
  // so the output is between 0 and 1.
  var SigmoidLayer = function(opt) {
    var opt = opt || {};

    // computed
    this.out_sx = opt.in_sx;
    this.out_sy = opt.in_sy;
    this.out_depth = opt.in_depth;
    this.layer_type = 'sigmoid';
  }
  SigmoidLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      var V2 = V.cloneAndZero();
      var N = V.w.length;
      var V2w = V2.w;
      var Vw = V.w;
      for(var i=0;i<N;i++) { 
        V2w[i] = 1.0/(1.0+Math.exp(-Vw[i]));
      }
      this.out_act = V2;
      return this.out_act;
    },
    backward: function() {
      var V = this.in_act; // we need to set dw of this
      var V2 = this.out_act;
      var N = V.w.length;
      V.dw = global.zeros(N); // zero out gradient wrt data
      for(var i=0;i<N;i++) {
        var v2wi = V2.w[i];
        V.dw[i] =  v2wi * (1.0 - v2wi) * V2.dw[i];
      }
    },
    getParamsAndGrads: function() {
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type; 
    }
  }

  // Implements Maxout nnonlinearity that computes
  // x -> max(x)
  // where x is a vector of size group_size. Ideally of course,
  // the input size should be exactly divisible by group_size
  var MaxoutLayer = function(opt) {
    var opt = opt || {};

    // required
    this.group_size = typeof opt.group_size !== 'undefined' ? opt.group_size : 2;

    // computed
    this.out_sx = opt.in_sx;
    this.out_sy = opt.in_sy;
    this.out_depth = Math.floor(opt.in_depth / this.group_size);
    this.layer_type = 'maxout';

    this.switches = global.zeros(this.out_sx*this.out_sy*this.out_depth); // useful for backprop
  }
  MaxoutLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      var N = this.out_depth; 
      var V2 = new Vol(this.out_sx, this.out_sy, this.out_depth, 0.0);

      // optimization branch. If we're operating on 1D arrays we dont have
      // to worry about keeping track of x,y,d coordinates inside
      // input volumes. In convnets we do :(
      if(this.out_sx === 1 && this.out_sy === 1) {
        for(var i=0;i<N;i++) {
          var ix = i * this.group_size; // base index offset
          var a = V.w[ix];
          var ai = 0;
          for(var j=1;j<this.group_size;j++) {
            var a2 = V.w[ix+j];
            if(a2 > a) {
              a = a2;
              ai = j;
            }
          }
          V2.w[i] = a;
          this.switches[i] = ix + ai;
        }
      } else {
        var n=0; // counter for switches
        for(var x=0;x<V.sx;x++) {
          for(var y=0;y<V.sy;y++) {
            for(var i=0;i<N;i++) {
              var ix = i * this.group_size;
              var a = V.get(x, y, ix);
              var ai = 0;
              for(var j=1;j<this.group_size;j++) {
                var a2 = V.get(x, y, ix+j);
                if(a2 > a) {
                  a = a2;
                  ai = j;
                }
              }
              V2.set(x,y,i,a);
              this.switches[n] = ix + ai;
              n++;
            }
          }
        }

      }
      this.out_act = V2;
      return this.out_act;
    },
    backward: function() {
      var V = this.in_act; // we need to set dw of this
      var V2 = this.out_act;
      var N = this.out_depth;
      V.dw = global.zeros(V.w.length); // zero out gradient wrt data

      // pass the gradient through the appropriate switch
      if(this.out_sx === 1 && this.out_sy === 1) {
        for(var i=0;i<N;i++) {
          var chain_grad = V2.dw[i];
          V.dw[this.switches[i]] = chain_grad;
        }
      } else {
        // bleh okay, lets do this the hard way
        var n=0; // counter for switches
        for(var x=0;x<V2.sx;x++) {
          for(var y=0;y<V2.sy;y++) {
            for(var i=0;i<N;i++) {
              var chain_grad = V2.get_grad(x,y,i);
              V.set_grad(x,y,this.switches[n],chain_grad);
              n++;
            }
          }
        }
      }
    },
    getParamsAndGrads: function() {
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      json.group_size = this.group_size;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type; 
      this.group_size = json.group_size;
      this.switches = global.zeros(this.group_size);
    }
  }

  // a helper function, since tanh is not yet part of ECMAScript. Will be in v6.
  function tanh(x) {
    var y = Math.exp(2 * x);
    return (y - 1) / (y + 1);
  }
  // Implements Tanh nnonlinearity elementwise
  // x -> tanh(x) 
  // so the output is between -1 and 1.
  var TanhLayer = function(opt) {
    var opt = opt || {};

    // computed
    this.out_sx = opt.in_sx;
    this.out_sy = opt.in_sy;
    this.out_depth = opt.in_depth;
    this.layer_type = 'tanh';
  }
  TanhLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      var V2 = V.cloneAndZero();
      var N = V.w.length;
      for(var i=0;i<N;i++) { 
        V2.w[i] = tanh(V.w[i]);
      }
      this.out_act = V2;
      return this.out_act;
    },
    backward: function() {
      var V = this.in_act; // we need to set dw of this
      var V2 = this.out_act;
      var N = V.w.length;
      V.dw = global.zeros(N); // zero out gradient wrt data
      for(var i=0;i<N;i++) {
        var v2wi = V2.w[i];
        V.dw[i] = (1.0 - v2wi * v2wi) * V2.dw[i];
      }
    },
    getParamsAndGrads: function() {
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type; 
    }
  }
  
  global.TanhLayer = TanhLayer;
  global.MaxoutLayer = MaxoutLayer;
  global.ReluLayer = ReluLayer;
  global.SigmoidLayer = SigmoidLayer;

})(convnetjs);

(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience

  // An inefficient dropout layer
  // Note this is not most efficient implementation since the layer before
  // computed all these activations and now we're just going to drop them :(
  // same goes for backward pass. Also, if we wanted to be efficient at test time
  // we could equivalently be clever and upscale during train and copy pointers during test
  // todo: make more efficient.
  var DropoutLayer = function(opt) {
    var opt = opt || {};

    // computed
    this.out_sx = opt.in_sx;
    this.out_sy = opt.in_sy;
    this.out_depth = opt.in_depth;
    this.layer_type = 'dropout';
    this.drop_prob = typeof opt.drop_prob !== 'undefined' ? opt.drop_prob : 0.5;
    this.dropped = global.zeros(this.out_sx*this.out_sy*this.out_depth);
  }
  DropoutLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      if(typeof(is_training)==='undefined') { is_training = false; } // default is prediction mode
      var V2 = V.clone();
      var N = V.w.length;
      if(is_training) {
        // do dropout
        for(var i=0;i<N;i++) {
          if(Math.random()<this.drop_prob) { V2.w[i]=0; this.dropped[i] = true; } // drop!
          else {this.dropped[i] = false;}
        }
      } else {
        // scale the activations during prediction
        for(var i=0;i<N;i++) { V2.w[i]*=this.drop_prob; }
      }
      this.out_act = V2;
      return this.out_act; // dummy identity function for now
    },
    backward: function() {
      var V = this.in_act; // we need to set dw of this
      var chain_grad = this.out_act;
      var N = V.w.length;
      V.dw = global.zeros(N); // zero out gradient wrt data
      for(var i=0;i<N;i++) {
        if(!(this.dropped[i])) { 
          V.dw[i] = chain_grad.dw[i]; // copy over the gradient
        }
      }
    },
    getParamsAndGrads: function() {
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      json.drop_prob = this.drop_prob;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type; 
      this.drop_prob = json.drop_prob;
    }
  }
  

  global.DropoutLayer = DropoutLayer;
})(convnetjs);
(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience
  
  // a bit experimental layer for now. I think it works but I'm not 100%
  // the gradient check is a bit funky. I'll look into this a bit later.
  // Local Response Normalization in window, along depths of volumes
  var LocalResponseNormalizationLayer = function(opt) {
    var opt = opt || {};

    // required
    this.k = opt.k;
    this.n = opt.n;
    this.alpha = opt.alpha;
    this.beta = opt.beta;

    // computed
    this.out_sx = opt.in_sx;
    this.out_sy = opt.in_sy;
    this.out_depth = opt.in_depth;
    this.layer_type = 'lrn';

    // checks
    if(this.n%2 === 0) { console.log('WARNING n should be odd for LRN layer'); }
  }
  LocalResponseNormalizationLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;

      var A = V.cloneAndZero();
      this.S_cache_ = V.cloneAndZero();
      var n2 = Math.floor(this.n/2);
      for(var x=0;x<V.sx;x++) {
        for(var y=0;y<V.sy;y++) {
          for(var i=0;i<V.depth;i++) {

            var ai = V.get(x,y,i);

            // normalize in a window of size n
            var den = 0.0;
            for(var j=Math.max(0,i-n2);j<=Math.min(i+n2,V.depth-1);j++) {
              var aa = V.get(x,y,j);
              den += aa*aa;
            }
            den *= this.alpha / this.n;
            den += this.k;
            this.S_cache_.set(x,y,i,den); // will be useful for backprop
            den = Math.pow(den, this.beta);
            A.set(x,y,i,ai/den);
          }
        }
      }

      this.out_act = A;
      return this.out_act; // dummy identity function for now
    },
    backward: function() { 
      // evaluate gradient wrt data
      var V = this.in_act; // we need to set dw of this
      V.dw = global.zeros(V.w.length); // zero out gradient wrt data
      var A = this.out_act; // computed in forward pass 

      var n2 = Math.floor(this.n/2);
      for(var x=0;x<V.sx;x++) {
        for(var y=0;y<V.sy;y++) {
          for(var i=0;i<V.depth;i++) {

            var chain_grad = this.out_act.get_grad(x,y,i);
            var S = this.S_cache_.get(x,y,i);
            var SB = Math.pow(S, this.beta);
            var SB2 = SB*SB;

            // normalize in a window of size n
            for(var j=Math.max(0,i-n2);j<=Math.min(i+n2,V.depth-1);j++) {              
              var aj = V.get(x,y,j); 
              var g = -aj*this.beta*Math.pow(S,this.beta-1)*this.alpha/this.n*2*aj;
              if(j===i) g+= SB;
              g /= SB2;
              g *= chain_grad;
              V.add_grad(x,y,j,g);
            }

          }
        }
      }
    },
    getParamsAndGrads: function() { return []; },
    toJSON: function() {
      var json = {};
      json.k = this.k;
      json.n = this.n;
      json.alpha = this.alpha; // normalize by size
      json.beta = this.beta;
      json.out_sx = this.out_sx; 
      json.out_sy = this.out_sy;
      json.out_depth = this.out_depth;
      json.layer_type = this.layer_type;
      return json;
    },
    fromJSON: function(json) {
      this.k = json.k;
      this.n = json.n;
      this.alpha = json.alpha; // normalize by size
      this.beta = json.beta;
      this.out_sx = json.out_sx; 
      this.out_sy = json.out_sy;
      this.out_depth = json.out_depth;
      this.layer_type = json.layer_type;
    }
  }
  

  global.LocalResponseNormalizationLayer = LocalResponseNormalizationLayer;
})(convnetjs);
(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience

  // transforms x-> [x, x_i*x_j forall i,j]
  // so the fully connected layer afters will essentially be doing tensor multiplies
  var QuadTransformLayer = function(opt) {
    var opt = opt || {};

    // computed
    this.out_sx = opt.in_sx;
    this.out_sy = opt.in_sy;
    // linear terms, and then quadratic terms, of which there are 1/2*n*(n+1),
    // (offdiagonals and the diagonal total) and arithmetic series.
    // Actually never mind, lets not be fancy here yet and just include
    // terms x_ix_j and x_jx_i twice. Half as efficient but much less
    // headache.
    this.out_depth = opt.in_depth + opt.in_depth * opt.in_depth;
    this.layer_type = 'quadtransform';

  }
  QuadTransformLayer.prototype = {
    forward: function(V, is_training) {
      this.in_act = V;
      var N = this.out_depth;
      var Ni = V.depth;
      var V2 = new Vol(this.out_sx, this.out_sy, this.out_depth, 0.0);
      for(var x=0;x<V.sx;x++) {
        for(var y=0;y<V.sy;y++) {
          for(var i=0;i<N;i++) {
            if(i<Ni) {
              V2.set(x,y,i,V.get(x,y,i)); // copy these over (linear terms)
            } else {
              var i0 = Math.floor((i-Ni)/Ni);
              var i1 = (i-Ni) - i0*Ni;
              V2.set(x,y,i,V.get(x,y,i0) * V.get(x,y,i1)); // quadratic
            }
          }
        }
      }
      this.out_act = V2;
      return this.out_act; // dummy identity function for now
    },
    backward: function() {
      var V = this.in_act;
      V.dw = global.zeros(V.w.length); // zero out gradient wrt data
      var V2 = this.out_act;
      var N = this.out_depth;
      var Ni = V.depth;
      for(var x=0;x<V.sx;x++) {
        for(var y=0;y<V.sy;y++) {
          for(var i=0;i<N;i++) {
            var chain_grad = V2.get_grad(x,y,i);
            if(i<Ni) {
              V.add_grad(x,y,i,chain_grad);
            } else {
              var i0 = Math.floor((i-Ni)/Ni);
              var i1 = (i-Ni) - i0*Ni;
              V.add_grad(x,y,i0,V.get(x,y,i1)*chain_grad);
              V.add_grad(x,y,i1,V.get(x,y,i0)*chain_grad);
            }
          }
        }
      }
    },
    getParamsAndGrads: function() {
      return [];
    },
    toJSON: function() {
      var json = {};
      json.out_depth = this.out_depth;
      json.out_sx = this.out_sx;
      json.out_sy = this.out_sy;
      json.layer_type = this.layer_type;
      return json;
    },
    fromJSON: function(json) {
      this.out_depth = json.out_depth;
      this.out_sx = json.out_sx;
      this.out_sy = json.out_sy;
      this.layer_type = json.layer_type; 
    }
  }
  

  global.QuadTransformLayer = QuadTransformLayer;
})(convnetjs);
(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience
  
  // Net manages a set of layers
  // For now constraints: Simple linear order of layers, first layer input last layer a cost layer
  var Net = function(options) {
    this.layers = [];
  }

  Net.prototype = {
    
    // takes a list of layer definitions and creates the network layer objects
    makeLayers: function(defs) {

      // few checks for now
      if(defs.length<2) {console.log('ERROR! For now at least have input and softmax layers.');}
      if(defs[0].type !== 'input') {console.log('ERROR! For now first layer should be input.');}

      // desugar syntactic for adding activations and dropouts
      var desugar = function() {
        var new_defs = [];
        for(var i=0;i<defs.length;i++) {
          var def = defs[i];
          
          if(def.type==='softmax' || def.type==='svm') {
            // add an fc layer here, there is no reason the user should
            // have to worry about this and we almost always want to
            new_defs.push({type:'fc', num_neurons: def.num_classes});
          }

          if(def.type==='regression') {
            // add an fc layer here, there is no reason the user should
            // have to worry about this and we almost always want to
            new_defs.push({type:'fc', num_neurons: def.num_neurons});
          }

          if((def.type==='fc' || def.type==='conv') 
              && typeof(def.bias_pref) === 'undefined'){
            def.bias_pref = 0.0;
            if(typeof def.activation !== 'undefined' && def.activation === 'relu') {
              def.bias_pref = 0.1; // relus like a bit of positive bias to get gradients early
              // otherwise it's technically possible that a relu unit will never turn on (by chance)
              // and will never get any gradient and never contribute any computation. Dead relu.
            }
          }
          
          if(typeof def.tensor !== 'undefined') {
            // apply quadratic transform so that the upcoming multiply will include
            // quadratic terms, equivalent to doing a tensor product
            if(def.tensor) {
              new_defs.push({type: 'quadtransform'});
            }
          }

          new_defs.push(def);

          if(typeof def.activation !== 'undefined') {
            if(def.activation==='relu') { new_defs.push({type:'relu'}); }
            else if (def.activation==='sigmoid') { new_defs.push({type:'sigmoid'}); }
            else if (def.activation==='tanh') { new_defs.push({type:'tanh'}); }
            else if (def.activation==='maxout') {
              // create maxout activation, and pass along group size, if provided
              var gs = def.group_size !== 'undefined' ? def.group_size : 2;
              new_defs.push({type:'maxout', group_size:gs});
            }
            else { console.log('ERROR unsupported activation ' + def.activation); }
          }
          if(typeof def.drop_prob !== 'undefined' && def.type !== 'dropout') {
            new_defs.push({type:'dropout', drop_prob: def.drop_prob});
          }

        }
        return new_defs;
      }
      defs = desugar(defs);

      // create the layers
      this.layers = [];
      for(var i=0;i<defs.length;i++) {
        var def = defs[i];
        if(i>0) {
          var prev = this.layers[i-1];
          def.in_sx = prev.out_sx;
          def.in_sy = prev.out_sy;
          def.in_depth = prev.out_depth;
        }

        switch(def.type) {
          case 'fc': this.layers.push(new global.FullyConnLayer(def)); break;
          case 'lrn': this.layers.push(new global.LocalResponseNormalizationLayer(def)); break;
          case 'dropout': this.layers.push(new global.DropoutLayer(def)); break;
          case 'input': this.layers.push(new global.InputLayer(def)); break;
          case 'softmax': this.layers.push(new global.SoftmaxLayer(def)); break;
          case 'regression': this.layers.push(new global.RegressionLayer(def)); break;
          case 'conv': this.layers.push(new global.ConvLayer(def)); break;
          case 'pool': this.layers.push(new global.PoolLayer(def)); break;
          case 'relu': this.layers.push(new global.ReluLayer(def)); break;
          case 'sigmoid': this.layers.push(new global.SigmoidLayer(def)); break;
          case 'tanh': this.layers.push(new global.TanhLayer(def)); break;
          case 'maxout': this.layers.push(new global.MaxoutLayer(def)); break;
          case 'quadtransform': this.layers.push(new global.QuadTransformLayer(def)); break;
          case 'svm': this.layers.push(new global.SVMLayer(def)); break;
          default: console.log('ERROR: UNRECOGNIZED LAYER TYPE!');
        }
      }
    },

    // forward prop the network. A trainer will pass in is_training = true
    forward: function(V, is_training) {
      if(typeof(is_training)==='undefined') is_training = false;
      var act = this.layers[0].forward(V, is_training);
      for(var i=1;i<this.layers.length;i++) {
        act = this.layers[i].forward(act, is_training);
      }
      return act;
    },
    
    // backprop: compute gradients wrt all parameters
    backward: function(y) {
      var N = this.layers.length;
      var loss = this.layers[N-1].backward(y); // last layer assumed softmax
      for(var i=N-2;i>=0;i--) { // first layer assumed input
        this.layers[i].backward();
      }
      return loss;
    },
    getParamsAndGrads: function() {
      // accumulate parameters and gradients for the entire network
      var response = [];
      for(var i=0;i<this.layers.length;i++) {
        var layer_reponse = this.layers[i].getParamsAndGrads();
        for(var j=0;j<layer_reponse.length;j++) {
          response.push(layer_reponse[j]);
        }
      }
      return response;
    },
    getPrediction: function() {
      var S = this.layers[this.layers.length-1]; // softmax layer
      var p = S.out_act.w;
      var maxv = p[0];
      var maxi = 0;
      for(var i=1;i<p.length;i++) {
        if(p[i] > maxv) { maxv = p[i]; maxi = i;}
      }
      return maxi;
    },
    toJSON: function() {
      var json = {};
      json.layers = [];
      for(var i=0;i<this.layers.length;i++) {
        json.layers.push(this.layers[i].toJSON());
      }
      return json;
    },
    fromJSON: function(json) {
      this.layers = [];
      for(var i=0;i<json.layers.length;i++) {
        var Lj = json.layers[i]
        var t = Lj.layer_type;
        var L;
        if(t==='input') { L = new global.InputLayer(); }
        if(t==='relu') { L = new global.ReluLayer(); }
        if(t==='sigmoid') { L = new global.SigmoidLayer(); }
        if(t==='tanh') { L = new global.TanhLayer(); }
        if(t==='dropout') { L = new global.DropoutLayer(); }
        if(t==='conv') { L = new global.ConvLayer(); }
        if(t==='pool') { L = new global.PoolLayer(); }
        if(t==='lrn') { L = new global.LocalResponseNormalizationLayer(); }
        if(t==='softmax') { L = new global.SoftmaxLayer(); }
        if(t==='regression') { L = new global.RegressionLayer(); }
        if(t==='fc') { L = new global.FullyConnLayer(); }
        if(t==='maxout') { L = new global.MaxoutLayer(); }
        if(t==='quadtransform') { L = new global.QuadTransformLayer(); }
        if(t==='svm') { L = new global.SVMLayer(); }
        L.fromJSON(Lj);
        this.layers.push(L);
      }
    }
  }
  

  global.Net = Net;
})(convnetjs);
(function(global) {
  "use strict";
  var Vol = global.Vol; // convenience

  var Trainer = function(net, options) {

    this.net = net;

    var options = options || {};
    this.learning_rate = typeof options.learning_rate !== 'undefined' ? options.learning_rate : 0.01;
    this.l1_decay = typeof options.l1_decay !== 'undefined' ? options.l1_decay : 0.0;
    this.l2_decay = typeof options.l2_decay !== 'undefined' ? options.l2_decay : 0.0;
    this.batch_size = typeof options.batch_size !== 'undefined' ? options.batch_size : 1;
    this.method = typeof options.method !== 'undefined' ? options.method : 'sgd'; // sgd/adagrad/adadelta/windowgrad

    this.momentum = typeof options.momentum !== 'undefined' ? options.momentum : 0.9;
    this.ro = typeof options.ro !== 'undefined' ? options.ro : 0.95; // used in adadelta
    this.eps = typeof options.eps !== 'undefined' ? options.eps : 1e-6; // used in adadelta

    this.k = 0; // iteration counter
    this.gsum = []; // last iteration gradients (used for momentum calculations)
    this.xsum = []; // used in adadelta
  }

  Trainer.prototype = {
    train: function(x, y) {

      var start = new Date().getTime();
      this.net.forward(x, true); // also set the flag that lets the net know we're just training
      var end = new Date().getTime();
      var fwd_time = end - start;

      var start = new Date().getTime();
      var cost_loss = this.net.backward(y);
      var l2_decay_loss = 0.0;
      var l1_decay_loss = 0.0;
      var end = new Date().getTime();
      var bwd_time = end - start;
      
      this.k++;
      if(this.k % this.batch_size === 0) {

        var pglist = this.net.getParamsAndGrads();

        // initialize lists for accumulators. Will only be done once on first iteration
        if(this.gsum.length === 0 && (this.method !== 'sgd' || this.momentum > 0.0)) {
          // only vanilla sgd doesnt need either lists
          // momentum needs gsum
          // adagrad needs gsum
          // adadelta needs gsum and xsum
          for(var i=0;i<pglist.length;i++) {
            this.gsum.push(global.zeros(pglist[i].params.length));
            if(this.method === 'adadelta') {
              this.xsum.push(global.zeros(pglist[i].params.length));
            } else {
              this.xsum.push([]); // conserve memory
            }
          }
        }

        // perform an update for all sets of weights
        for(var i=0;i<pglist.length;i++) {
          var pg = pglist[i]; // param, gradient, other options in future (custom learning rate etc)
          var p = pg.params;
          var g = pg.grads;

          // learning rate for some parameters.
          var l2_decay_mul = typeof pg.l2_decay_mul !== 'undefined' ? pg.l2_decay_mul : 1.0;
          var l1_decay_mul = typeof pg.l1_decay_mul !== 'undefined' ? pg.l1_decay_mul : 1.0;
          var l2_decay = this.l2_decay * l2_decay_mul;
          var l1_decay = this.l1_decay * l1_decay_mul;

          var plen = p.length;
          for(var j=0;j<plen;j++) {
            l2_decay_loss += l2_decay*p[j]*p[j]/2; // accumulate weight decay loss
            l1_decay_loss += l1_decay*Math.abs(p[j]);
            var l1grad = l1_decay * (p[j] > 0 ? 1 : -1);
            var l2grad = l2_decay * (p[j]);

            var gij = (l2grad + l1grad + g[j]) / this.batch_size; // raw batch gradient

            var gsumi = this.gsum[i];
            var xsumi = this.xsum[i];
            if(this.method === 'adagrad') {
              // adagrad update
              gsumi[j] = gsumi[j] + gij * gij;
              var dx = - this.learning_rate / Math.sqrt(gsumi[j] + this.eps) * gij;
              p[j] += dx;
            } else if(this.method === 'windowgrad') {
              // this is adagrad but with a moving window weighted average
              // so the gradient is not accumulated over the entire history of the run. 
              // it's also referred to as Idea #1 in Zeiler paper on Adadelta. Seems reasonable to me!
              gsumi[j] = this.ro * gsumi[j] + (1-this.ro) * gij * gij;
              var dx = - this.learning_rate / Math.sqrt(gsumi[j] + this.eps) * gij; // eps added for better conditioning
              p[j] += dx;
            } else if(this.method === 'adadelta') {
              // assume adadelta if not sgd or adagrad
              gsumi[j] = this.ro * gsumi[j] + (1-this.ro) * gij * gij;
              var dx = - Math.sqrt((xsumi[j] + this.eps)/(gsumi[j] + this.eps)) * gij;
              xsumi[j] = this.ro * xsumi[j] + (1-this.ro) * dx * dx; // yes, xsum lags behind gsum by 1.
              p[j] += dx;
            } else {
              // assume SGD
              if(this.momentum > 0.0) {
                // momentum update
                var dx = this.momentum * gsumi[j] - this.learning_rate * gij; // step
                gsumi[j] = dx; // back this up for next iteration of momentum
                p[j] += dx; // apply corrected gradient
              } else {
                // vanilla sgd
                p[j] +=  - this.learning_rate * gij;
              }
            }
            g[j] = 0.0; // zero out gradient so that we can begin accumulating anew
          }
        }
      }

      // appending softmax_loss for backwards compatibility, but from now on we will always use cost_loss
      // in future, TODO: have to completely redo the way loss is done around the network as currently 
      // loss is a bit of a hack. Ideally, user should specify arbitrary number of loss functions on any layer
      // and it should all be computed correctly and automatically. 
      return {fwd_time: fwd_time, bwd_time: bwd_time, 
              l2_decay_loss: l2_decay_loss, l1_decay_loss: l1_decay_loss,
              cost_loss: cost_loss, softmax_loss: cost_loss, 
              loss: cost_loss + l1_decay_loss + l2_decay_loss}
    }
  }
  
  global.Trainer = Trainer;
  global.SGDTrainer = Trainer; // backwards compatibility
})(convnetjs);

(function(global) {
  "use strict";

  // used utilities, make explicit local references
  var randf = global.randf;
  var randi = global.randi;
  var Net = global.Net;
  var Trainer = global.Trainer;
  var maxmin = global.maxmin;
  var randperm = global.randperm;
  var weightedSample = global.weightedSample;
  var getopt = global.getopt;
  var arrUnique = global.arrUnique;

  /*
  A MagicNet takes data: a list of convnetjs.Vol(), and labels
  which for now are assumed to be class indeces 0..K. MagicNet then:
  - creates data folds for cross-validation
  - samples candidate networks
  - evaluates candidate networks on all data folds
  - produces predictions by model-averaging the best networks
  */
  var MagicNet = function(data, labels, opt) {
    var opt = opt || {};
    if(typeof data === 'undefined') { data = []; }
    if(typeof labels === 'undefined') { labels = []; }

    // required inputs
    this.data = data; // store these pointers to data
    this.labels = labels;

    // optional inputs
    this.train_ratio = getopt(opt, 'train_ratio', 0.7);
    this.num_folds = getopt(opt, 'num_folds', 10);
    this.num_candidates = getopt(opt, 'num_candidates', 50); // we evaluate several in parallel
    // how many epochs of data to train every network? for every fold?
    // higher values mean higher accuracy in final results, but more expensive
    this.num_epochs = getopt(opt, 'num_epochs', 50); 
    // number of best models to average during prediction. Usually higher = better
    this.ensemble_size = getopt(opt, 'ensemble_size', 10);

    // candidate parameters
    this.batch_size_min = getopt(opt, 'batch_size_min', 10);
    this.batch_size_max = getopt(opt, 'batch_size_max', 300);
    this.l2_decay_min = getopt(opt, 'l2_decay_min', -4);
    this.l2_decay_max = getopt(opt, 'l2_decay_max', 2);
    this.learning_rate_min = getopt(opt, 'learning_rate_min', -4);
    this.learning_rate_max = getopt(opt, 'learning_rate_max', 0);
    this.momentum_min = getopt(opt, 'momentum_min', 0.9);
    this.momentum_max = getopt(opt, 'momentum_max', 0.9);
    this.neurons_min = getopt(opt, 'neurons_min', 5);
    this.neurons_max = getopt(opt, 'neurons_max', 30);

    // computed
    this.folds = []; // data fold indices, gets filled by sampleFolds()
    this.candidates = []; // candidate networks that are being currently evaluated
    this.evaluated_candidates = []; // history of all candidates that were fully evaluated on all folds
    this.unique_labels = arrUnique(labels);
    this.iter = 0; // iteration counter, goes from 0 -> num_epochs * num_training_data
    this.foldix = 0; // index of active fold

    // callbacks
    this.finish_fold_callback = null;
    this.finish_batch_callback = null;

    // initializations
    if(this.data.length > 0) {
      this.sampleFolds();
      this.sampleCandidates();
    }
  };

  MagicNet.prototype = {

    // sets this.folds to a sampling of this.num_folds folds
    sampleFolds: function() {
      var N = this.data.length;
      var num_train = Math.floor(this.train_ratio * N);
      this.folds = []; // flush folds, if any
      for(var i=0;i<this.num_folds;i++) {
        var p = randperm(N);
        this.folds.push({train_ix: p.slice(0, num_train), test_ix: p.slice(num_train, N)});
      }
    },

    // returns a random candidate network
    sampleCandidate: function() {
      var input_depth = this.data[0].w.length;
      var num_classes = this.unique_labels.length;

      // sample network topology and hyperparameters
      var layer_defs = [];
      layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth: input_depth});
      var nl = weightedSample([0,1,2,3], [0.2, 0.3, 0.3, 0.2]); // prefer nets with 1,2 hidden layers
      for(var q=0;q<nl;q++) {
        var ni = randi(this.neurons_min, this.neurons_max);
        var act = ['tanh','maxout','relu'][randi(0,3)];
        if(randf(0,1)<0.5) {
          var dp = Math.random();
          layer_defs.push({type:'fc', num_neurons: ni, activation: act, drop_prob: dp});
        } else {
          layer_defs.push({type:'fc', num_neurons: ni, activation: act});
        }
      }
      layer_defs.push({type:'softmax', num_classes: num_classes});
      var net = new Net();
      net.makeLayers(layer_defs);

      // sample training hyperparameters
      var bs = randi(this.batch_size_min, this.batch_size_max); // batch size
      var l2 = Math.pow(10, randf(this.l2_decay_min, this.l2_decay_max)); // l2 weight decay
      var lr = Math.pow(10, randf(this.learning_rate_min, this.learning_rate_max)); // learning rate
      var mom = randf(this.momentum_min, this.momentum_max); // momentum. Lets just use 0.9, works okay usually ;p
      var tp = randf(0,1); // trainer type
      var trainer_def;
      if(tp<0.33) {
        trainer_def = {method:'adadelta', batch_size:bs, l2_decay:l2};
      } else if(tp<0.66) {
        trainer_def = {method:'adagrad', learning_rate: lr, batch_size:bs, l2_decay:l2};
      } else {
        trainer_def = {method:'sgd', learning_rate: lr, momentum: mom, batch_size:bs, l2_decay:l2};
      }
      
      var trainer = new Trainer(net, trainer_def);

      var cand = {};
      cand.acc = [];
      cand.accv = 0; // this will maintained as sum(acc) for convenience
      cand.layer_defs = layer_defs;
      cand.trainer_def = trainer_def;
      cand.net = net;
      cand.trainer = trainer;
      return cand;
    },

    // sets this.candidates with this.num_candidates candidate nets
    sampleCandidates: function() {
      this.candidates = []; // flush, if any
      for(var i=0;i<this.num_candidates;i++) {
        var cand = this.sampleCandidate();
        this.candidates.push(cand);
      }
    },

    step: function() {
      
      // run an example through current candidate
      this.iter++;

      // step all candidates on a random data point
      var fold = this.folds[this.foldix]; // active fold
      var dataix = fold.train_ix[randi(0, fold.train_ix.length)];
      for(var k=0;k<this.candidates.length;k++) {
        var x = this.data[dataix];
        var l = this.labels[dataix];
        this.candidates[k].trainer.train(x, l);
      }

      // process consequences: sample new folds, or candidates
      var lastiter = this.num_epochs * fold.train_ix.length;
      if(this.iter >= lastiter) {
        // finished evaluation of this fold. Get final validation
        // accuracies, record them, and go on to next fold.
        var val_acc = this.evalValErrors();
        for(var k=0;k<this.candidates.length;k++) {
          var c = this.candidates[k];
          c.acc.push(val_acc[k]);
          c.accv += val_acc[k];
        }
        this.iter = 0; // reset step number
        this.foldix++; // increment fold

        if(this.finish_fold_callback !== null) {
          this.finish_fold_callback();
        }

        if(this.foldix >= this.folds.length) {
          // we finished all folds as well! Record these candidates
          // and sample new ones to evaluate.
          for(var k=0;k<this.candidates.length;k++) {
            this.evaluated_candidates.push(this.candidates[k]);
          }
          // sort evaluated candidates according to accuracy achieved
          this.evaluated_candidates.sort(function(a, b) { 
            return (a.accv / a.acc.length) 
                 > (b.accv / b.acc.length) 
                 ? -1 : 1;
          });
          // and clip only to the top few ones (lets place limit at 3*ensemble_size)
          // otherwise there are concerns with keeping these all in memory 
          // if MagicNet is being evaluated for a very long time
          if(this.evaluated_candidates.length > 3 * this.ensemble_size) {
            this.evaluated_candidates = this.evaluated_candidates.slice(0, 3 * this.ensemble_size);
          }
          if(this.finish_batch_callback !== null) {
            this.finish_batch_callback();
          }
          this.sampleCandidates(); // begin with new candidates
          this.foldix = 0; // reset this
        } else {
          // we will go on to another fold. reset all candidates nets
          for(var k=0;k<this.candidates.length;k++) {
            var c = this.candidates[k];
            var net = new Net();
            net.makeLayers(c.layer_defs);
            var trainer = new Trainer(net, c.trainer_def);
            c.net = net;
            c.trainer = trainer;
          }
        }
      }
    },

    evalValErrors: function() {
      // evaluate candidates on validation data and return performance of current networks
      // as simple list
      var vals = [];
      var fold = this.folds[this.foldix]; // active fold
      for(var k=0;k<this.candidates.length;k++) {
        var net = this.candidates[k].net;
        var v = 0.0;
        for(var q=0;q<fold.test_ix.length;q++) {
          var x = this.data[fold.test_ix[q]];
          var l = this.labels[fold.test_ix[q]];
          net.forward(x);
          var yhat = net.getPrediction();
          v += (yhat === l ? 1.0 : 0.0); // 0 1 loss
        }
        v /= fold.test_ix.length; // normalize
        vals.push(v);
      }
      return vals;
    },

    // returns prediction scores for given test data point, as Vol
    // uses an averaged prediction from the best ensemble_size models
    // x is a Vol.
    predict_soft: function(data) {
      // forward prop the best networks
      // and accumulate probabilities at last layer into a an output Vol
      var nv = Math.min(this.ensemble_size, this.evaluated_candidates.length);
      if(nv === 0) { return new convnetjs.Vol(0,0,0); } // not sure what to do here? we're not ready yet
      var xout, n;
      for(var j=0;j<nv;j++) {
        var net = this.evaluated_candidates[j].net;
        var x = net.forward(data);
        if(j===0) { 
          xout = x; 
          n = x.w.length; 
        } else {
          // add it on
          for(var d=0;d<n;d++) {
            xout.w[d] += x.w[d];
          }
        }
      }
      // produce average
      for(var d=0;d<n;d++) {
        xout.w[d] /= n;
      }
      return xout;
    },

    predict: function(data) {
      var xout = this.predict_soft(data);
      if(xout.w.length !== 0) {
        var stats = maxmin(xout.w);
        var predicted_label = stats.maxi; 
      } else {
        var predicted_label = -1; // error out
      }
      return predicted_label;

    },

    toJSON: function() {
      // dump the top ensemble_size networks as a list
      var nv = Math.min(this.ensemble_size, this.evaluated_candidates.length);
      var json = {};
      json.nets = [];
      for(var i=0;i<nv;i++) {
        json.nets.push(this.evaluated_candidates[i].net.toJSON());
      }
      return json;
    },

    fromJSON: function(json) {
      this.ensemble_size = json.nets.length;
      this.evaluated_candidates = [];
      for(var i=0;i<this.ensemble_size;i++) {
        var net = new Net();
        net.fromJSON(json.nets[i]);
        var dummy_candidate = {};
        dummy_candidate.net = net;
        this.evaluated_candidates.push(dummy_candidate);
      }
    },

    // callback functions
    // called when a fold is finished, while evaluating a batch
    onFinishFold: function(f) { this.finish_fold_callback = f; },
    // called when a batch of candidates has finished evaluating
    onFinishBatch: function(f) { this.finish_batch_callback = f; }
    
  };

  global.MagicNet = MagicNet;
})(convnetjs);
(function(lib) {
  "use strict";
  if (typeof module === "undefined" || typeof module.exports === "undefined") {
    window.jsfeat = lib; // in ordinary browser attach library to window
  } else {
    module.exports = lib; // in nodejs
  }
})(convnetjs);

},{}],2:[function(require,module,exports){

// contains various utility functions 
var cnnutil = (function(exports){

  // a window stores _size_ number of values
  // and returns averages. Useful for keeping running
  // track of validation or training accuracy during SGD
  var Window = function(size, minsize) {
    this.v = [];
    this.size = typeof(size)==='undefined' ? 100 : size;
    this.minsize = typeof(minsize)==='undefined' ? 20 : minsize;
    this.sum = 0;
  }
  Window.prototype = {
    add: function(x) {
      this.v.push(x);
      this.sum += x;
      if(this.v.length>this.size) {
        var xold = this.v.shift();
        this.sum -= xold;
      }
    },
    get_average: function() {
      if(this.v.length < this.minsize) return -1;
      else return this.sum/this.v.length;
    },
    reset: function(x) {
      this.v = [];
      this.sum = 0;
    }
  }

  // returns min, max and indeces of an array
  var maxmin = function(w) {
    if(w.length === 0) { return {}; } // ... ;s

    var maxv = w[0];
    var minv = w[0];
    var maxi = 0;
    var mini = 0;
    for(var i=1;i<w.length;i++) {
      if(w[i] > maxv) { maxv = w[i]; maxi = i; } 
      if(w[i] < minv) { minv = w[i]; mini = i; } 
    }
    return {maxi: maxi, maxv: maxv, mini: mini, minv: minv, dv:maxv-minv};
  }

  // returns string representation of float
  // but truncated to length of d digits
  var f2t = function(x, d) {
    if(typeof(d)==='undefined') { var d = 5; }
    var dd = 1.0 * Math.pow(10, d);
    return '' + Math.floor(x*dd)/dd;
  }

  exports = exports || {};
  exports.Window = Window;
  exports.maxmin = maxmin;
  exports.f2t = f2t;
  return exports;

})(typeof module != 'undefined' && module.exports);  // add exports to module.exports if in node.js



},{}],3:[function(require,module,exports){
function E_Axis()
{
  THREE.Mesh.call(this);
  this.geometry = new THREE.SphereGeometry( 1, 5, 5 );
  this.material = new THREE.MeshBasicMaterial({color: 0xffff00});

  xGeo = new THREE.Geometry();
  xGeo.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0));
  xMat = new THREE.LineBasicMaterial({color:0xff0000, linewidth:3});
  var xAxis  = new THREE.Line(xGeo, xMat);

  yGeo = new THREE.Geometry();
  yGeo.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 10, 0));
  yMat = new THREE.LineBasicMaterial({color:0x00ff00, linewidth:3});
  var yAxis  = new THREE.Line(yGeo, yMat);

  zGeo = new THREE.Geometry();
  zGeo.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 10));
  zMat = new THREE.LineBasicMaterial({color:0x0000ff,  linewidth:3});
  var zAxis  = new THREE.Line(zGeo, zMat);

  this.add(xAxis);
  this.add(yAxis);
  this.add(zAxis);
}


E_Axis.prototype = Object.create(THREE.Mesh.prototype);

module.exports = E_Axis

},{}],4:[function(require,module,exports){
function E_Image()
{
  THREE.Mesh.call(this);

  this.canvas = document.createElement('canvas');
}

E_Image.prototype = Object.create(THREE.Mesh.prototype);

E_Image.prototype.ImportImage = function(path, scene)
{
  var IMAGE = this;
  var loader = new THREE.TextureLoader();
  loader.load(
    path, //texture path
    function(texture) //onload function
    {
      var height = texture.image.height;
      var width =  texture.image.width;

      //update canvas element

      IMAGE.canvas.width = texture.image.width;
      IMAGE.canvas.height = texture.image.height;
      IMAGE.canvas.getContext('2d').drawImage(texture.image, 0, 0, IMAGE.canvas.width, IMAGE.canvas.height);

      texture.minFilter = THREE.LinearFilter;

      IMAGE.material = new THREE.MeshBasicMaterial({ map : texture });
      IMAGE.material.side = THREE.DoubleSide;
      IMAGE.geometry = new THREE.PlaneGeometry(width/15, height/15);

      IMAGE.geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

      scene.add(IMAGE);
      // Mgr.Redraw();
    }
  );
}

E_Image.prototype.GetImageData = function()
{
  return this.canvas.getContext('2d').getImageData(0, 0, this.canvas.width, this.canvas.height);
}

E_Image.prototype.SetImageData = function(imgData)
{
  this.canvas.width = imgData.width;
  this.canvas.height = imgData.height;
  this.canvas.getContext('2d').putImageData(imgData, 0, 0);
  var texture = new THREE.Texture(this.canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  this.material.map = texture;
}

////TEST Image Procssing
E_Image.prototype.SetImageRed = function()
{
  //TEST if image modify is possible
  var imgData = this.GetImageData();

  //Set R value maximum
  for(var i=2 ; i<imgData.data.length ; i+=4){
    imgData.data[i] = 140;
  }
  this.SetImageData(imgData);
}


module.exports = E_Image;

},{}],5:[function(require,module,exports){
function E_Tracker(Mgr)
{
  this.Manager = Mgr;

  //Original Features in UV
  this.initFeature = [];
  this.initFeature[0] = new THREE.Vector2(-150.83334350585938, -144.5);
  this.initFeature[1] = new THREE.Vector2(-150.83334350585938, 144.5);
  this.initFeature[2] = new THREE.Vector2(150.16665649414062, -144.5);
  this.initFeature[3] = new THREE.Vector2(150.16665649414062, 144.5);


  //Fake Feature Position
  this.fakeFeature = []
  this.fakeFeature[1] = new THREE.Vector3(-11.787260127517664, 0, -11.787260127517664);
  this.fakeFeature[0] = new THREE.Vector3(-11.787260127517664, 0, 11.787260127517664);
  this.fakeFeature[3] = new THREE.Vector3(11.787260127517664, 0, -11.787260127517664);
  this.fakeFeature[2] = new THREE.Vector3(11.787260127517664, 0, 11.787260127517664);

  //Calculated Fake Feature
  this.calFeature = [];
  this.calFeature[0] = new THREE.Vector2();
  this.calFeature[1] = new THREE.Vector2();
  this.calFeature[2] = new THREE.Vector2();
  this.calFeature[3] = new THREE.Vector2();
}

E_Tracker.prototype.CalculateVelocity = function(camera)
{
  var imgMgr = this.Manager.ImageMgr();

  var lambda = camera.aspect;
  var z = 90;

  //Column Matrix
  var uvBuffer = [];
  var LBuffer = [];

  var isCalibrated = true;


  this.UpdateFeatureLable();

  for(var i=0 ; i<4 ; i++){
    imgMgr.DrawLine(this.initFeature[i], this.calFeature[i] );

    var err = this.initFeature[i].clone().sub(this.calFeature[i]);
    var u = this.calFeature[i].x;
    var v = this.calFeature[i].y;

    uvBuffer.push([err.x]);
    uvBuffer.push([err.y]);

    if(Math.abs(err.x) > 1 || Math.abs(err.y) > 1) isCalibrated = false;

    LBuffer.push([]);
    LBuffer[i].push( lambda / z);
    LBuffer[i].push( 0 );
    LBuffer[i].push( -u/z );
    LBuffer[i].push( -u*v/lambda );
    LBuffer[i].push( (Math.pow(lambda, 2)+Math.pow(u, 2))/lambda );
    LBuffer[i].push( -v );

    LBuffer.push([]);
    LBuffer[i+1].push( 0 );
    LBuffer[i+1].push( lambda/z );
    LBuffer[i+1].push( -v/z );
    LBuffer[i+1].push( (-Math.pow(lambda,2)-Math.pow(v,2))/lambda );
    LBuffer[i+1].push( u*v/lambda );
    LBuffer[i+1].push( u );
  }


  var e = Sushi.Matrix.fromArray(uvBuffer);
  var L = Sushi.Matrix.fromArray(LBuffer);

  if(isCalibrated){
    //Finish Calibration
    this.Manager.SetLog("E : " + e.toCSV() );
    // document.getElementById("LMat").innerHTML =  "<h3 style='color:blue'>Press 'P' to start Calibration </h3> </div>";

    this.Manager.m_bCalibration = false;
    return{
      vx:0,
      vy:0,
      vz:0,
      wx:0,
      wy:0,
      wz:0
    };
  }


  var invL = Sushi.Matrix.mul( Sushi.Matrix.mul(L.t(), L).inverse(), L.t() );
  var resultMat =  Sushi.Matrix.mul(invL, e);


  var factorElement = new Array([-1/100000, -1/100000, 1/100, 5, 5, -1/100]);
  var factorMatrix = Sushi.Matrix.fromArray(factorElement);
  resultMat = resultMat.mulEach(factorMatrix.t());
  var result = Sushi.Matrix.toArray( resultMat );


  this.Manager.SetLog("<strong>E<strong> : " + e.toCSV() );
  this.Manager.AppendLog( "<br> <strong>Pseudo Inverse L<strong> <br> : " + invL.toCSV() + "<br> result :  " + resultMat.toCSV() );

  return {
    vx:result[0],
    vy:result[1],
    vz:result[2],
    wx:result[3],
    wy:result[4],
    wz:result[5]
  };
}


E_Tracker.prototype.UpdateFeatureLable = function()
{

  for(var i=0 ; i<3 ; i++){
    for(var j=0 ; j< 3-i ; j++ ){
      if(this.calFeature[j].x > this.calFeature[j+1].x){
        var temp = this.calFeature[j].clone();
        this.calFeature[j] = this.calFeature[j+1].clone();
        this.calFeature[j+1] = temp.clone();
      }
    }
  }

  if(this.calFeature[0].y > this.calFeature[1].y){
    var temp = this.calFeature[0].clone();
    this.calFeature[0] = this.calFeature[1].clone();
    this.calFeature[1] = temp;
  }

  if(this.calFeature[2].y > this.calFeature[3].y){
    var temp = this.calFeature[2].clone();
    this.calFeature[2] = this.calFeature[3].clone();
    this.calFeature[3] = temp;
  }
}

E_Tracker.prototype.GetError = function()
{
  var imgMgr = this.Manager.ImageMgr();
  this.UpdateFeatureLable();
  var result = [];

  
  for(var i=0 ; i<4 ; i++){
    imgMgr.DrawLine(this.initFeature[i], this.calFeature[i] );

    var err = this.initFeature[i].clone().sub(this.calFeature[i]);
    result.push(err);
  }

  return result;
}

module.exports = E_Tracker;

},{}],6:[function(require,module,exports){
function E_ImageManager(Mgr)
{
  this.Manager = Mgr;

  this.rtTexture = new THREE.WebGLRenderTarget(window.innerWidth,
                                             window.innerHeight,
                                             {minFilter: THREE.LinearFilter,
                                               magFilter: THREE.NearestFilter,
                                               format: THREE.RGBAFormat
                                             });

  this.rtTexture.scissorTest = true;


  var viewport = $$("ID_VIEW_LEFT").getNode();
  this.canvas = document.createElement("canvas");
  viewport.appendChild(this.canvas);
  // this.canvas.style.backgroundColor ="lightblue"
  this.canvas.style.position="absolute";


  this.ctx = this.canvas.getContext('2d');
  this.features = [];
  this.nFeatures = 0;

  //Image Pyramids for optical flow                curr_img_pyr = new jsfeat.pyramid_t(3);
  this.curr_img_pyr = new jsfeat.pyramid_t(3);
  this.prev_img_pyr = new jsfeat.pyramid_t(3);

  this.curr_img_pyr.allocate(640, 480, jsfeat.U8_t|jsfeat.C1_t);
  this.prev_img_pyr.allocate(640, 480, jsfeat.U8_t|jsfeat.C1_t);

  this.point_status = new Uint8Array(10);
  this.prev_xy = new Float32Array(100*2);
  this.curr_xy = new Float32Array(100*2);


  this.UpdateSize();
}

E_ImageManager.prototype.ClearCanvas = function()
{
  var canvas = this.canvas
  this.ctx.clearRect(0, 0, canvas.width, canvas.height);
}


E_ImageManager.prototype.RendererToImage = function(renderer, scene, camera, left, bottom, width, height)
{

  ///Resize Renderer
  var size = renderer.getSize();

  var reduceFactor = (width * height) / (500 * 500);
  if(reduceFactor < 1) reduceFactor = 1;
  var tempWidth = Math.round(width / reduceFactor);
  var tempHeight = Math.round(height / reduceFactor);
  renderer.setSize(tempWidth, tempHeight);

  //Set RenderTarget Scissro and Viewport
  this.rtTexture.viewport = new THREE.Vector4(left, bottom, tempWidth, tempHeight);
  this.rtTexture.scissor =  new THREE.Vector4(left, bottom, tempWidth, tempHeight);

  //Generate Image Data
  var imageData = new ImageData(tempWidth, tempHeight);

  //Update Render Target
  renderer.render( scene, camera, this.rtTexture, true );
  var img_u8 = new Uint8Array( tempWidth * tempHeight * 4 )
  renderer.readRenderTargetPixels(this.rtTexture, 0, 0, tempWidth, tempHeight, img_u8 );
  imageData.data.set(img_u8);

  //Resize to Original
  renderer.setSize(size.width, size.height);

  return imageData;
}


E_ImageManager.prototype.SetImageDataTo2DRenderer = function(imageData)
{
  var canvas = this.canvas;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
}


E_ImageManager.prototype.ScaleImageData = function(imageData, scale)
{
  var scaled = new ImageData(imageData.width * scale, imageData.height * scale);

  for(var row = 0; row < imageData.height; row++) {
    for(var col = 0; col < imageData.width; col++) {
      var sourcePixel = [
        imageData.data[(row * imageData.width + col) * 4 + 0],
        imageData.data[(row * imageData.width + col) * 4 + 1],
        imageData.data[(row * imageData.width + col) * 4 + 2],
        imageData.data[(row * imageData.width + col) * 4 + 3]
      ];
      for(var y = 0; y < scale; y++) {
        var destRow = row * scale + y;
        for(var x = 0; x < scale; x++) {
          var destCol = col * scale + x;
          for(var i = 0; i < 4; i++) {
            scaled.data[(destRow * scaled.width + destCol) * 4 + i] =
              sourcePixel[i];
          }
        }
      }
    }
  }

  return scaled;
}

E_ImageManager.prototype.Canny = function(imageData)
{
  var width = imageData.width;
  var height = imageData.height;

  var img_u8 = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);

 jsfeat.imgproc.grayscale(imageData.data, width, height, img_u8);

 var r = 0.1;
 var kernel_size = (r+1) << 1;

 jsfeat.imgproc.gaussian_blur(img_u8, img_u8, kernel_size, 0);
 jsfeat.imgproc.canny(img_u8, img_u8, 0, 1);

 // render result back to canvas
 var data_u32 = new Uint32Array(imageData.data.buffer);
 var alpha = (0xff << 24);
 var i = img_u8.cols*img_u8.rows, pix = 0;
 while(--i >= 0) {
     pix = img_u8.data[i];
     data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
 }

 return imageData
}

E_ImageManager.prototype.Yape06 = function(imageData)
{
  //Get Canvas Information and Clear CTX
  viewport =  $$("ID_VIEW_LEFT").getNode();



  var canvas = this.canvas;
  var rect = viewport.getBoundingClientRect();
  var canvasWidth = rect.right - rect.left;
  var canvasHeight = canvas.height;

  var width = imageData.width;
  var height = imageData.height;
  var img_u8 = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);

  this.features = [];
  var i = width*height;
  while(--i >= 0) {
      this.features[i] = new jsfeat.keypoint_t(0,0,0,0);
  }

  jsfeat.imgproc.grayscale(imageData.data, width, height, img_u8);
  jsfeat.imgproc.box_blur_gray(img_u8, img_u8, 2, 0);

  jsfeat.yape06.laplacian_threshold = 1;
  jsfeat.yape06.min_eigen_value_threshold = 0;


  this.nFeatures = jsfeat.yape06.detect(img_u8, this.features);

  // render result back to canvas
  var data_u32 = new Uint32Array(imageData.data.buffer);

  var pix = (0xff << 24) | (0x00 << 16) | (0xff << 8) | 0x00;
  for(var i=0; i < this.nFeatures; ++i)
  {
      var x = this.features[i].x * (canvasWidth/width);
      var y = this.features[i].y * (canvasHeight/height);
      var off = (x + y * width);
      data_u32[off] = pix;
      data_u32[off-1] = pix;
      data_u32[off+1] = pix;
      data_u32[off-width] = pix;
      data_u32[off+width] = pix;

      this.DrawFeature(x, y, i);
      ///Optical Flow
      this.curr_xy[i << 1] = x;
      this.curr_xy[(i << 1)+1] = y;
  }

  if(this.nFeatures > 4) {
    jsfeat.imgproc.grayscale(imageData.data, width, height, this.curr_img_pyr.data[0]);
    jsfeat.imgproc.grayscale(imageData.data, width, height, this.prev_img_pyr.data[0]);
  }

  return imageData;
}

E_ImageManager.prototype.FastCorners = function(imageData)
{
  //Clear Canvas
  var canvas = this.canvas;

  var rect = viewport.getBoundingClientRect();
  var canvasWidth = rect.right - rect.left;
  var canvasHeight = canvas.height;

  var width = imageData.width;
  var height = imageData.height;
  var img_u8 = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);

  jsfeat.imgproc.grayscale(imageData.data, width, height, img_u8);

  threshold = 5;

  jsfeat.fast_corners.set_threshold(threshold);

  this.features = [];
  var i = width * height;
  while(--i >= 0) {
      this.features[i] = new jsfeat.keypoint_t(0,0,0,0);
  }


  this.nFeatures = jsfeat.fast_corners.detect(img_u8, this.features, 50);

  // render result back to canvas
  var data_u32 = new Uint32Array(imageData.data.buffer);
  var pix = (0xff << 24) | (0x00 << 16) | (0xff << 8) | 0x00;

  for(var i=0; i < this.nFeatures; ++i)
  {
      var x = this.features[i].x * (canvasWidth/width);
      var y = this.features[i].y * (canvasHeight/height);
      var off = (x + y * width);
      data_u32[off] = pix;
      data_u32[off-1] = pix;
      data_u32[off+1] = pix;
      data_u32[off-width] = pix;
      data_u32[off+width] = pix;

      this.DrawFeature(x, y, i);
      ///Optical Flow
      this.curr_xy[i << 1] = x;
      this.curr_xy[(i << 1)+1] = y;
  }

  if(this.nFeatures > 4) jsfeat.imgproc.grayscale(imageData.data, width, height, this.curr_img_pyr.data[0]);

  return imageData
}

E_ImageManager.prototype.OpticalFlow = function(imageData)
{
  var canvas = this.canvas;

  var width = imageData.width;
  var height = imageData.height;

  // swap flow data
  var _pt_xy = this.prev_xy;
  this.prev_xy = this.curr_xy;
  this.curr_xy = _pt_xy;

  var _pyr = this.prev_img_pyr;
  this.prev_img_pyr = this.curr_img_pyr;
  this.curr_img_pyr = _pyr;

  jsfeat.imgproc.grayscale(imageData.data, width, height, this.curr_img_pyr.data[0]);
  this.curr_img_pyr.build(this.curr_img_pyr.data[0], true);
  jsfeat.optical_flow_lk.track(this.prev_img_pyr, this.curr_img_pyr, this.prev_xy, this.curr_xy, this.nFeatures, 20, 30, this.point_status, 0.01, 0.001);

  var n = this.nFeatures;
  var i=0,j=0;



  for(; i < n; ++i) {
    if(this.point_status[i] == 1) {
        console.log("Optical Flow");
        if(j < i) {
            this.curr_xy[j<<1] = this.curr_xy[i<<1];
            this.curr_xy[(j<<1)+1] = this.curr_xy[(i<<1)+1];
        }
        this.DrawFeature(this.curr_xy[j<<1], this.curr_xy[(j<<1)+1]);
        ++j;
    }
  }
  this.nFeatures = j;
}

E_ImageManager.prototype.UpdateImagePyramid = function()
{

  var canvas = this.canvas;
  viewport =  $$("ID_VIEW_LEFT").getNode();
  var rect = viewport.getBoundingClientRect();
  var canvasWidth = canvas.width
  var canvasHeight = canvas.height;

  this.curr_img_pyr.allocate(canvasWidth, canvasHeight, jsfeat.U8_t|jsfeat.C1_t);
  this.prev_img_pyr.allocate(canvasWidth, canvasHeight, jsfeat.U8_t|jsfeat.C1_t);
}



E_ImageManager.prototype.DrawFeature = function(x, y)
{
  var canvas = this.canvas
  viewport =  $$("ID_VIEW_LEFT").getNode();
  var rect = viewport.getBoundingClientRect();
  var canvasWidth = rect.right - rect.left;
  var canvasHeight = canvas.height;

  //Convert to UV coordinate
  var u = x - canvasWidth/2;
  var v = -(y - canvasHeight / 2);

  ///clear Canvas
  this.ctx.fillStyle = "rgb(0,255,0)";
  this.ctx.strokeStyle = "rgb(0,0,255)";
  this.ctx.font="10px Georgia";

  this.ctx.beginPath();
  this.ctx.arc(x, y, 4, 0, Math.PI*2, true);
  this.ctx.fillText("( " + u.toFixed(2) + "," + v.toFixed(2) + " ) ",x, y);
  this.ctx.closePath();
  this.ctx.fill();
}


E_ImageManager.prototype.DrawInitPoints = function()
{
  var featurePosition = this.Manager.Tracker().initFeature;
  var p1 = this.UVToScreen(featurePosition[0].x, featurePosition[0].y);
  var p2 = this.UVToScreen(featurePosition[1].x, featurePosition[1].y);
  var p3 = this.UVToScreen(featurePosition[2].x, featurePosition[2].y);
  var p4 = this.UVToScreen(featurePosition[3].x, featurePosition[3].y);

  this.ctx.fillStyle = "rgb(0,0,255)";
  this.ctx.font="10px Georgia";
  this.ctx.beginPath();
  this.ctx.arc(p1[0], p1[1], 4, 0, Math.PI*2, true);
  this.ctx.fill();
  this.ctx.beginPath();
  this.ctx.arc(p2[0], p2[1], 4, 0, Math.PI*2, true);
  this.ctx.fill();
  this.ctx.beginPath();
  this.ctx.arc(p3[0], p3[1], 4, 0, Math.PI*2, true);
  this.ctx.fill();
  this.ctx.beginPath();
  this.ctx.arc(p4[0], p4[1], 4, 0, Math.PI*2, true);
  this.ctx.closePath();
  this.ctx.fill();
}

E_ImageManager.prototype.UVToScreen = function(u, v)
{
  var canvas = this.canvas;
  viewport =  $$("ID_VIEW_LEFT").getNode();
  var rect = viewport.getBoundingClientRect();
  var canvasWidth = rect.right - rect.left;
  var canvasHeight = canvas.height;
  var result = [];

  result[0] = u + canvasWidth/2;
  result[1] = -v + canvasHeight / 2;

  return result;
}

E_ImageManager.prototype.ScreenToUV = function(x, y)
{
  var canvas = this.canvas;
  viewport =  $$("ID_VIEW_LEFT").getNode();
  var rect = viewport.getBoundingClientRect();
  var canvasWidth = rect.right - rect.left;
  var canvasHeight = canvas.height;
  var result = [];

  result[0] = x - canvasWidth/2;
  result[1] = -(y - canvasHeight / 2);

  return result;
}



E_ImageManager.prototype.RenderFakeFeatures = function(camera)
{
  var canvas = this.canvas;

  //Original Features
  var points = this.Manager.Tracker().fakeFeature;

  //Calculated features
  var features = this.Manager.Tracker().calFeature;

  for(var i=0 ; i<4 ; i++){
    var vec = new THREE.Vector3(points[i].x, points[i].y, points[i].z)
    vec.project(camera);

    //Update Current Feature Position

    var x = Math.round( ( vec.x + 1 ) * canvas.width / 2 );
    var y = Math.round( ( - vec.y + 1 ) * canvas.height / 2 );

    var featUV = this.ScreenToUV(x, y);
    features[i].set(featUV[0], featUV[1]);

    this.DrawFeature(x, y);
  }
}

E_ImageManager.prototype.DrawLine = function(p1, p2)
{
  if(!p1 instanceof THREE.Vector2) return;
  if(!p2 instanceof THREE.Vector2) return;

  var start = this.UVToScreen(p1.x, p1.y);
  var end = this.UVToScreen(p2.x, p2.y);

  this.ctx.strokeStyle = "rgb(255,255,0)";
  this.ctx.beginPath();
  this.ctx.moveTo(start[0], start[1]);
  this.ctx.lineTo(end[0], end[1]);
  this.ctx.stroke();
}


E_ImageManager.prototype.UpdateSize = function()
{



  viewport =  $$("ID_VIEW_LEFT").getNode();
  var rect = viewport.getBoundingClientRect();
  this.canvas.width = rect.right - rect.left;
  this.canvas.height = $$("ID_VIEW_LEFT").$height;


  var oL = viewport.offsetLeft.toString() + "px";
  var oT = viewport.offsetTop.toString() + "px";
  this.canvas.style.left= oL;
  this.canvas.style.top= oT;

  //
  // console.log(viewport.offsetLeft);
  // console.log(viewport.offsetTop);

}



module.exports = E_ImageManager;

},{}],7:[function(require,module,exports){
function E_Interactor(Mgr, renderer)
{
  this.Manager = Mgr;

  this.m_bDown = false;
  this.m_bRDown = false;
  this.m_keyCode = -1;

  this.prevPosition = new THREE.Vector2(0, 0);
  this.v2Delta = new THREE.Vector2(0, 0);

  this.canvas = renderer.domElement;

  this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this), false);
  this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this), false);
  this.Manager.ImageMgr().canvas.addEventListener("mousedown", this.onMouseDown.bind(this), false);
  this.Manager.ImageMgr().canvas.addEventListener("mousemove", this.onMouseMove.bind(this), false);
}

E_Interactor.prototype.onMouseDown = function(event)
{
  this.m_bDown = true;

  var mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  var mouseY = -(event.clientY / window.innerHeight) * 2 + 1;


  //Store Position;
  this.prevPosition.x = mouseX;
  this.prevPosition.y = mouseY;
}

E_Interactor.prototype.onMouseUp = function(event)
{
  this.m_bDown = false;
}

E_Interactor.prototype.onMouseRDown = function(event)
{
}

E_Interactor.prototype.onMouseRUp = function(event)
{

}

E_Interactor.prototype.onMouseMove = function(event)
{
  if(!this.m_bDown) return;

  //Get Current position
  var mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  var mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  var currentPosition = new THREE.Vector2(mouseX, mouseY);

  this.v2Delta = currentPosition.clone().sub(this.prevPosition.clone());

  this.prevPosition = currentPosition;
}

E_Interactor.prototype.onKeyboardDown = function(event)
{
  this.m_keyCode = event.keyCode;
}

E_Interactor.prototype.onKeyboardUp = function(event)
{

  this.m_keyCode = -1;
}

E_Interactor.prototype.Update = function()
{
  if(this.m_keyCode != -1){
    this.HandleKeyEvent();
  }

  if(this.v2Delta.length() != 0.0){
    this.HandleMouseMove();
    this.v2Delta = new THREE.Vector2();
  }

}

E_Interactor.prototype.HandleMouseMove = function()
{
  var camera = this.Manager.renderer[0].camera;
  var camera2 = this.Manager.renderer[1].camera;

  var xComp = new THREE.Vector2(this.v2Delta.x, 0);
  var yComp = new THREE.Vector2(0, this.v2Delta.y);
  var theta = xComp.clone().add(yComp).length();

  var xEul = new THREE.Vector3(0, -this.v2Delta.x, 0);
  var yEul = new THREE.Vector3(this.v2Delta.y, 0, 0);
  var axis = xEul.clone().add(yEul).normalize();

  var mat = camera.matrix.clone()
  mat.multiply(new THREE.Matrix4().makeRotationAxis(axis , theta));
  camera.rotation.setFromRotationMatrix(mat);
  camera2.userData.axis.matrix.copy(mat);
  camera2.userData.helper.matrix.copy(mat);



  // //Trainning Data
  // if(this.Manager.m_bRunTrainning){
  //   this.Manager.RunTraining();
  // }

  this.Manager.Redraw();
}

E_Interactor.prototype.HandleKeyEvent = function()
{
  if(this.m_keyCode === -1) return;


  var camera = this.Manager.renderer[0].camera;
  var mat = camera.matrix.clone();


  switch (this.m_keyCode) {
    case 67: // c
      mat.multiply(new THREE.Matrix4().makeTranslation(0, 0, 1));
      camera.position.setFromMatrixPosition(mat);
    break;
    case 32: // Space key
      mat.multiply(new THREE.Matrix4().makeTranslation(0, 0, -1));
      camera.position.setFromMatrixPosition(mat);
    break;
    case 87: // W Key
      mat.multiply(new THREE.Matrix4().makeTranslation(0, 1, 0));
      camera.position.setFromMatrixPosition(mat);
    break;
    case 83: // S key
      mat.multiply(new THREE.Matrix4().makeTranslation(0, -1, 0));
      camera.position.setFromMatrixPosition(mat);
    break;
    case 65: // A key
      mat.multiply(new THREE.Matrix4().makeTranslation(-1, 0, 0));
      camera.position.setFromMatrixPosition(mat);
    break;
    case 68: // D Key
      mat.multiply(new THREE.Matrix4().makeTranslation(1, 0, 0));
      camera.position.setFromMatrixPosition(mat);
    break;
    case 81: // Q
      mat.multiply(new THREE.Matrix4().makeRotationZ(0.01));
      camera.rotation.setFromRotationMatrix(mat);

    break;
    case 69: // E Key
      mat.multiply(new THREE.Matrix4().makeRotationZ(-0.01));
      camera.rotation.setFromRotationMatrix(mat);
    break;
    default:
    break;
  }

  //Trainning Data
  if(this.Manager.m_bRunTrainning){
    this.Manager.RunTraining();
  }


  //Handle Mouse Move
  this.Manager.Redraw();

}

module.exports = E_Interactor


// //Event Handlers
// $("#viewport").mousedown(function(event){
//   Manager.renderer[0].onMouseDown(event);
// });
//
// $("#viewport").mousemove(function(event){
//   Manager.renderer[0].interactor.onMouseMove(event);
// });

},{}],8:[function(require,module,exports){
var convnetjs = require('convnetjs');
var deepqlearn = require('../libs/E_Brain.js')


//Machine Learning Manager
function E_MLManager(Mgr, network)
{
  this.Mgr = Mgr;

  this.network = new convnetjs.Net();
  this.brain = null;

  ///Initialize
  this.Initialize(network);
}

E_MLManager.prototype.Initialize = function(network)
{
  //4 error 2-diimensional vector
  var num_inputs = 8;
  //Random Position and Rotation
  var num_actions = 6;
  var temporal_window = 1;
  var network_size = num_inputs * temporal_window + num_actions * temporal_window + num_inputs;
  // this.MakeActions(num_actions);

  layer_defs = [];
  layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth:network_size});
  layer_defs.push({type:'fc', num_neurons: 50, activation:'relu'});
  layer_defs.push({type:'fc', num_neurons: 50, activation:'relu'});
  layer_defs.push({type:'regression', num_neurons:num_actions});


  // options for the Temporal Difference learner that trains the above net
  // by backpropping the temporal difference learning rule.
  tdtrainer_options = {learning_rate:0.0001, momentum:0.0, batch_size:64, l2_decay:0.01};
  var opt = {};
  opt.temporal_window = temporal_window;
  opt.experience_size = 30000;
  opt.start_learn_threshold = 100;
  opt.gamma = 0.7;
  opt.learning_steps_total = 200000;
  opt.learning_steps_burnin = 3000;
  opt.epsilon_min = 0.005;
  opt.epsilon_test_time = 0.05;
  opt.layer_defs = layer_defs;
  opt.tdtrainer_options = tdtrainer_options;



  //DeepQLearn Brain
  this.brain = new deepqlearn.Brain(num_inputs, num_actions, opt)

  //Load Saved Network
  //this.brain.value_net.fromJSON( JSON.parse(network) );
  this.Mgr.SetLog(network);


  //Initialize Network
  this.network.makeLayers(layer_defs);
  // this.network.fromJSON( JSON.parse(network) );
}

E_MLManager.prototype.ForwardBrain = function(volume)
{
  var action = this.brain.forward(volume.data);
  return action;
}

E_MLManager.prototype.BackwardBrain = function(reward)
{
  this.brain.backward(reward);



  log = this.brain.getLog() + '# of episodes : ' + this.Mgr.episode;
  log += '<br> iterations : ' + this.Mgr.iterations;

  if(this.Mgr.startTime !== null){
    var elapsedTime = new Date() - this.Mgr.startTime;
    log += '<br> elapsed time : ' + elapsedTime / 1000;
  }

  this.Mgr.SetLog(log);
  this.SaveBrain();
}

E_MLManager.prototype.PutVolume = function( volume )
{
  var inputVol = new convnetjs.Vol(volume.data);


  trainer = new convnetjs.SGDTrainer(this.network, {learning_rate:0.01, momentum:0.0, batch_size:1, l2_decay:0.001});
  trainer.train(inputVol, volume.class);


  //Save Netwrok
  this.SaveNetwork();
}

E_MLManager.prototype.Predict = function(volume)
{
  var action = this.brain.predict(volume.data);
  return action;
}

E_MLManager.prototype.SaveNetwork = function()
{
  ///Save Network
  var jsonNetwork = JSON.stringify( this.network.toJSON() );
  this.Mgr.SocketMgr().EmitData("SAVE_NETWORK", jsonNetwork);
}

E_MLManager.prototype.SaveBrain = function()
{
  //Save Brain
  var jsonBrain = JSON.stringify( this.brain.value_net.toJSON() );
  this.Mgr.SocketMgr().EmitData("SAVE_BRAIN", jsonBrain);
}


E_MLManager.prototype.MakeActions = function(numActions)
{
  if(numActions === 6){
    this.MakeSixActions();
    return;
  }
  var results = [];
  var trV = 1.0;
  var rotV = 0.01;

  for(var i=0 ; i<numActions ; i++){
    var mat = new THREE.Matrix4();

    mat.multiply(new THREE.Matrix4().makeTranslation(this.Mgr.Frand(trV * -1.0, trV), this.Mgr.Frand(trV * -1.0, trV), this.Mgr.Frand(trV * -1.0, trV) ));
    mat.multiply(new THREE.Matrix4().makeRotationX(this.Mgr.Frand(rotV * -1.0, rotV)));
    mat.multiply(new THREE.Matrix4().makeRotationY(this.Mgr.Frand(rotV * -1.0, rotV)));
    mat.multiply(new THREE.Matrix4().makeRotationZ(this.Mgr.Frand(rotV * -1.0, rotV)));

    results.push(mat.elements);
  }

  this.Mgr.SocketMgr().EmitData("SAVE_ACTIONS", results );
}

E_MLManager.prototype.MakeSixActions = function()
{
  var results = [];
  var trV = 0.2;



  //forward
  var mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(0, 0, trV * -1.0));
  results.push(mat.elements)


  //backward
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(0, 0, trV));
  results.push(mat.elements)

  //right
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(trV, 0, 0));
  results.push(mat.elements)

  //left
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(trV * -1.0, 0, 0));
  results.push(mat.elements)

  //top
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(0, trV, 0));
  results.push(mat.elements)

  //bottom
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(0, trV * -1.0, 0));
  results.push(mat.elements)



  // console.log(results);
  this.Mgr.SocketMgr().EmitData("SAVE_ACTIONS", results );
}

module.exports = E_MLManager;

},{"../libs/E_Brain.js":12,"convnetjs":1}],9:[function(require,module,exports){
var E_SocketManager = require('./E_SocketManager.js');
var E_MLManager = require('./E_MLManager.js');
var E_ImageManager = require('./E_ImageManager.js');

//Interactor
var E_Interactor = require('./E_Interactor.js');

var E_Image = require('../Core/E_Image.js');
var E_Axis = require('../Core/E_Axis.js');
var E_Tracker = require('../Core/E_Tracker.js')


//
// //STL Loader
// var STLLoader = require('three-stl-loader')(THREE);



function E_Manager()
{
  var m_socketMgr = new E_SocketManager(this);
  var m_imgMgr = new E_ImageManager(this);
  var m_tracker = new E_Tracker(this);

  this.mlMgr = null;
  this.renderer = [];

  this.SocketMgr = function()
  {
    return m_socketMgr;
  }

  this.ImageMgr = function()
  {
    return m_imgMgr;
  }

  this.Tracker = function()
  {
    return m_tracker;
  }

  this.m_bRunTrainning = false;
  this.m_bCalibration = false;
  this.m_bNNCalibration = false;

  this.prevTransform = new THREE.Matrix4();



  //Ground-Truth of Calibration
  //Get Global Annotation Matrix
  var globalmax = "[0.99999998211860657, 0.0005886557628400624, 0.0000024272976588690653, 0, -2.329772001985475e-7, 0.004519194730209017, 0.9999898076057434, 0,-0.00058866071049124, 0.9999896287918091, 0.0045191943645477295, 0,-0.052400823682546616, 48.713191986083984, 0.02711086571216583, 1]"
  this.groundMat = new THREE.Matrix4();
  this.groundMat.elements = JSON.parse(globalmax)



  ///recording values
  this.episode = 0;
  this.startTime = null;

  this.iterations = 0;
  this.iter_error_table = [['iterations', 'error']];

}

E_Manager.prototype.Initialize = function()
{
  $$("ID_LOG").getNode().style.background = "black"
  $$("ID_LOG").getNode().style.color = "green"
  $$("ID_LOG").getNode().style.fontSize = "9px"
  // $$("ID_LOG").getNode().style.marginLeft = "50px";
  // $$("ID_LOG").getNode().style.marginTop = "15px";


  //Initialzie Render Window
  var renWin = [];
  renWin[0] = $$("ID_VIEW_LEFT");
  renWin[1] = $$("ID_VIEW_RIGHT");

  //Initialize Renderer
  for(var i=0 ; i<2 ; i++){
    this.renderer[i] = new THREE.WebGLRenderer({preserveDrawingBuffer:true, alpha:true});
    this.renderer[i].scene = new THREE.Scene();
    this.renderer[i].camera = new THREE.PerspectiveCamera( 45, renWin[i].$width/renWin[i].$height, 0.1, 1000 );

    //Set Init Camera Position
    this.renderer[i].camera.position.z = -20;

    //Add Renderer to The Render Window
    renWin[i].getNode().replaceChild(this.renderer[i].domElement, renWin[i].$view.childNodes[0] );

    // console.log(this.renderer[i].domElement);
    this.renderer[i].renderWindow = renWin[i];
    this.renderer[i].setClearColor(0x000015);


    //Set Interactor
    this.renderer[i].interactor = new E_Interactor(this, this.renderer[i]);
  }

  this.renderer[0].camera.far = 100;

  this.renderer[0].pointLight = new THREE.PointLight(0xffffff);
  this.renderer[0].scene.add(this.renderer[0].pointLight);

  var camera1 = this.renderer[0].camera;
  var camera2 = this.renderer[1].camera;


  camera2.userData.axis = new E_Axis();
  this.renderer[1].scene.add(camera2.userData.axis);

  camera2.userData.helper = new THREE.CameraHelper(camera1);
  // var dist = 90 / 1200;
  // camera2.userData.helper.geometry.scale(dist, dist, dist);
  this.renderer[1].scene.add(camera2.userData.helper);

  this.UpdateWindowSize();
  this.Redraw();


  this.Animate();

  //Initialize Objects
  this.InitObject();
}

E_Manager.prototype.OnInitialize = function(data)
{
  this.actions = data.action;

  this.mlMgr = new E_MLManager(this, data.network);

  this.Initialize();
}

E_Manager.prototype.InitObject = function()
{
  var scene = this.renderer[0].scene;
  var scene2 = this.renderer[1].scene;

  var camera = this.renderer[0].camera;
  var camera2 = this.renderer[1].camera;

  var ambient = new THREE.AmbientLight(0x000000);

  this.tempImage = new E_Image();
  this.tempImage2 = new E_Image();

  this.tempImage.ImportImage('/images/four.png', scene);
  this.tempImage2.ImportImage('/images/four.png', scene2);



  camera.position.setFromMatrixPosition(new THREE.Matrix4().makeTranslation(4, 50, 40));
  camera.rotation.setFromRotationMatrix(new THREE.Matrix4().makeRotationX(-Math.PI/2));

  camera2.position.x = -150;
  camera2.position.z = 150;
  camera2.position.y = 65;
  camera2.lookAt(new THREE.Vector3(0, 45, 0));
}


E_Manager.prototype.UpdateWindowSize = function()
{
  for(var i=0 ; i<2 ; i++){
    this.renderer[i].setSize(this.renderer[i].renderWindow.$width, this.renderer[i].renderWindow.$height);
    this.renderer[i].camera.aspect = this.renderer[i].renderWindow.$width/this.renderer[i].renderWindow.$height;
    this.renderer[i].camera.updateProjectionMatrix();
  }

  this.ImageMgr().UpdateSize()
}

E_Manager.prototype.Redraw = function()
{

  camera1 = this.renderer[0].camera;
  camera2 = this.renderer[1].camera;


  // camera2.userData.axis.matrix.copy(camera2.matrixWorld.clone());
  var lookAt =  camera1.position.clone().sub( new THREE.Vector3(0, 0, 0)).multiplyScalar(0.5);
  camera2.lookAt( lookAt );
  camera2.userData.axis.position.setFromMatrixPosition(camera1.matrix.clone());
  camera2.userData.axis.rotation.setFromRotationMatrix(camera1.matrix.clone());
  var vec1 = camera1.position.clone().sub(camera2.position);
  var vec2 = lookAt.clone().sub(camera2.position);
  var eFov = Math.acos(vec1.clone().normalize().dot(vec2.clone().normalize())) * 3 ;
  camera2.fov =   eFov * ( 180 / Math.PI);
  camera2.updateProjectionMatrix();



  //Redraw
  for(var i=0 ; i<2 ; i++){
    this.renderer[i].render(this.renderer[i].scene, this.renderer[i].camera);
  }



  //Update 2d Canvas
  if(!this.m_bCalibration) {this.ImageMgr().ClearCanvas();}
  this.ImageMgr().RenderFakeFeatures(camera1);
  this.ImageMgr().DrawInitPoints();


}

E_Manager.prototype.Animate = function()
{

  this.renderer[0].interactor.Update();

  if(this.m_bCalibration){
    this.RunCalibration();
  }

  if(this.m_bRunTrainning){
    this.RunTraining();
  }

  if(this.m_bNNCalibration){
    this.NNCalibration();
  }

  requestAnimationFrame( this.Animate.bind(this) );
}

E_Manager.prototype.RunTraining = function()
{
  if(this.mlMgr.brain.epsilon <= this.mlMgr.brain.epsilon_min) return;


  var camera = this.renderer[0].camera;
  var currMat = camera.matrix.clone();
  var log = "FeatureError : ";

  //Get 2D Feature Error
  var featureError = this.Tracker().GetError();
  var prevScore = 0.0;

  var inputData = [];
  for(var i in featureError){
    log +=  featureError[i].x + "," + featureError[i].y + "//";
    inputData.push(featureError[i].x);
    inputData.push(featureError[i].y);

    prevScore += featureError[i].length()
  }

  prevScore /= featureError.length;

  // console.log(curScore);

  //Get Camera Matrix
  var currentMat = camera.matrix.clone();
  var invCur = new THREE.Matrix4().getInverse(currentMat, true);
  //Annotation is a transformation matrix to the ground-truth matrix
  var annotation = invCur.clone().multiply(this.groundMat);

  var features = this.Tracker().calFeature;
  if(features[0].x < -270 || features[1].x < -270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[2].x > 270 || features[3].x > 270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[0].y < -270 || features[2].y < -270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[1].y > 270 || features[3].y > 270) {
    this.ReturnCamera(camera)
    return;
  }

  var volume = {data:inputData, class:annotation.elements};

  var idx = this.mlMgr.ForwardBrain(volume);

  //Get Action Transformation
  var action = this.actions[idx];
  actionArr = [];
  $.each(action, function(i, n){
    actionArr.push(n);
  });
  var actionMat = new THREE.Matrix4();
  actionMat.elements = actionArr;


  //Transform
  currMat.multiply(actionMat);


  this.prevTransform = camera.matrix.clone();
  camera.position.setFromMatrixPosition(currMat);
  camera.rotation.setFromRotationMatrix(currMat);

  this.Redraw();

  //Get Reward After actionMat
  //Get 2D Feature Error
  var featureError = this.Tracker().GetError();


  var curScore = 0.0;
  for(var i in featureError){
    curScore += featureError[i].length()
  }
  curScore /= featureError.length;


  //Iter of this episode
  this.iterations++;
  if(this.iterations % 10 === 0){
    this.iter_error_table.push([this.iterations, curScore]);
  }


  var reward = Math.tanh(curScore - prevScore);

  if(reward >= 0) reward = -1;
  else reward = 1;

  this.mlMgr.BackwardBrain(reward);

  log += "<br><br>Reward : " + reward;

  if(curScore <= 10.0){
    this.GoToInit();
    this.Redraw();
  }
}

E_Manager.prototype.NNCalibration = function()
{
  if(this.mlMgr.brain.age < 1000){
    this.RunTraining();
    return;
  }
  var camera = this.renderer[0].camera;

  //Get Camera Matrix
  var currentMat = camera.matrix.clone();
  var invCur = new THREE.Matrix4().getInverse(currentMat, true);
  //Annotation is a transformation matrix to the ground-truth matrix
  var annotation = invCur.clone().multiply(this.groundMat);

  //Get 2D Feature Error
  var featureError = this.Tracker().GetError();

  var inputData = [];
  for(var i in featureError){
    inputData.push(featureError[i].x);
    inputData.push(featureError[i].y);
  }

  var features = this.Tracker().calFeature;
  if(features[0].x < -270 || features[1].x < -270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[2].x > 270 || features[3].x > 270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[0].y < -270 || features[2].y < -270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[1].y > 270 || features[3].y > 270) {
    this.ReturnCamera(camera)
    return;
  }

  var volume = {data:inputData, class:annotation.elements};
  var idx = this.mlMgr.ForwardBrain(volume);
  //No Reward

  //Get Action Transformation
  var action = this.actions[idx];
  actionArr = [];
  $.each(action, function(i, n){
    actionArr.push(n);
  });
  var actionMat = new THREE.Matrix4();
  actionMat.elements = actionArr;

  //Transform
  currentMat.multiply(actionMat);

  //Update Camear Transformation
  this.prevTransform = camera.matrix.clone();
  camera.position.setFromMatrixPosition(currentMat);
  camera.rotation.setFromRotationMatrix(currentMat);

  this.Redraw();


  //Calculate Current Score
  //Get 2D Feature Error
  var featureError = this.Tracker().GetError();
  var curScore = 0.0;
  for(var i in featureError){
    curScore += featureError[i].length()
  }
  curScore /= featureError.length;

  //Iter of this episode
  this.iterations++;
  if(this.iterations % 10 === 0){
    this.iter_error_table.push([this.iterations, curScore]);
  }

  if(curScore <= 10.0){
    this.GoToInit();
    this.Redraw();
  }
}




E_Manager.prototype.RanBool = function()
{
  d = Math.random();

  if(d < 0.5) return -1;
  else return 1;
}

E_Manager.prototype.GoToInit = function()
{
  // this.m_bRunTrainning = false;
  var camera = this.renderer[0].camera;

  var y = Math.random() * camera.far;
  var x = Math.tan(camera.fov / 5.0) * (camera.far - y) * this.Frand(-1, 1);
  var z = Math.tan(camera.fov / 5.0) * (camera.far - y) * this.Frand(-1, 1);

  camera.position.set(x, y, z);



  if(this.startTime === null){
    this.startTime = new Date();
    return;
  }

  //Save Progress untill now

  if(this.iter_error_table.length > 1){
    elapsedTime = (new Date() - this.startTime) / 1000;
    this.SocketMgr().EmitData("SAVE_LEARNING_PROGRESS", [this.episode, elapsedTime]);

    //Save currnet episode error reduction
    this.SocketMgr().EmitData("SAVE_ITERATION_ERROR", this.iter_error_table);
    this.episode++;
  }

  //Re-initialize for next episode
  this.startTime = new Date();
  this.iterations = 0;
  this.iter_error_table = [['iterations', 'error']];

}

E_Manager.prototype.RunCalibration = function()
{
  this.ImageMgr().ClearCanvas();
  var camera = this.renderer[0].camera;
  var camera2 = this.renderer[1].camera;
  var trans = camera.matrix.clone();
  var rot = camera.matrix.clone();
  var velocity = this.Tracker().CalculateVelocity(camera);


  var scalefactor = 200000;
  rot.multiply(new THREE.Matrix4().makeRotationX(velocity.wx ));
  rot.multiply(new THREE.Matrix4().makeRotationY(velocity.wy ));
  rot.multiply(new THREE.Matrix4().makeRotationZ(velocity.wz ));
  camera.rotation.setFromRotationMatrix(rot);


  trans.multiply(new THREE.Matrix4().makeTranslation(velocity.vx, velocity.vy, velocity.vz ));
  camera.position.setFromMatrixPosition(trans);

  this.Redraw();
}

E_Manager.prototype.ReturnCamera = function(camera)
{

  camera.position.setFromMatrixPosition(this.prevTransform);
  camera.rotation.setFromRotationMatrix(this.prevTransform);
  this.Redraw();
}


E_Manager.prototype.Frand = function(min, max)
{
  var range = max - min;
  var value = Math.random();

  value *= range;
  value += min;

  return value;
}

E_Manager.prototype.OnNNCalibration = function(value)
{

  this.m_bNNCalibration = value;
}


E_Manager.prototype.CalibrateGround = function()
{
  var camera = this.renderer[0].camera;

  console.log(camera.position)
  var currentMat = camera.matrix.clone();
  var invCur = new THREE.Matrix4().getInverse(currentMat, true);

  // This Translation Matrix will be the Annotation of Deep Learning
  var trans = invCur.clone().multiply(this.groundMat);

  // Predicted Matrix will be Applied like this way
  currentMat.multiply(trans);

  //Update Camear Transformation
  camera.position.setFromMatrixPosition(currentMat);
  camera.rotation.setFromRotationMatrix(currentMat);

  this.Redraw();
}



E_Manager.prototype.SetLog = function(text)
{
  $$("ID_LOG").getNode().innerHTML = text
}

E_Manager.prototype.AppendLog = function(text)
{
  $$("ID_LOG").getNode().innerHTML += text;
}

E_Manager.prototype.OnRunTrainning = function(value)
{
  if(value === 1){
    this.m_bRunTrainning = true;
  }else{
    this.m_bRunTrainning = false;
  }
}

E_Manager.prototype.OnRunCalibration = function(value)
{
  this.m_bCalibration = value;
}

module.exports = E_Manager;

},{"../Core/E_Axis.js":3,"../Core/E_Image.js":4,"../Core/E_Tracker.js":5,"./E_ImageManager.js":6,"./E_Interactor.js":7,"./E_MLManager.js":8,"./E_SocketManager.js":10}],10:[function(require,module,exports){
function E_SocketManager(Mgr)
{
  this.Mgr = Mgr;
  this.io = io();


  this.Initialize()

}

E_SocketManager.prototype.Initialize = function()
{
  this.HandleSignal();
}

E_SocketManager.prototype.HandleSignal = function()
{
  var socket = this.io;
  var Mgr = this.Mgr;

  socket.on("INITIALIZE_NETOWORK", function(data){
    Mgr.OnInitialize(data)

  });

  socket.on("SIGNAL_RESTART", function(data){
    // //clear scene
    // if(Mgr.m_bRunTrainning){
    //   Mgr.ClearScene();
    // }


  })

}

E_SocketManager.prototype.EmitData = function(signal, data)
{
  this.io.emit(signal, data);
}

module.exports = E_SocketManager;

},{}],11:[function(require,module,exports){
var E_Manager = require('./E_Manager.js');


///WEBIX LAYOUT

/// Left Menu
//Toolbar
var l_toolBar = {view:"toolbar",
                elements:[
                  {
                    id:"ID_BUTTON_GROUND_TRUTH", view:"button", value:"Ground Truth", width:150
                  },
                  { id:"ID_TOGGLE_CALIBRATION",view:"toggle", type:"iconButton", name:"s4", width:150,
                      offIcon:"play",  onIcon:"pause",
                      offLabel:"Run Calibration", onLabel:"Stop Calibration"
                  },
                  { id:"ID_TOGGLE_TRAINNING",view:"toggle", type:"iconButton", name:"s4", width:150,
                      offIcon:"play",  onIcon:"pause",
                      offLabel:"Run Trainning", onLabel:"Stop Trainning"
                  },
                  {
                    id:"ID_TOGGLE_NNCALIB", view:"toggle", type:"iconButton", name:"s4", offIcon:"play", onIcon:"pause", offLabel:"Calibration (using NN)", onLabel:"Stop Calib", width:250
                  }
                ]};


//Left Viewport : Visualize Original Mesh
var l_leftMenu = {id:"ID_VIEW_LEFT", view:"template", gravity:1.8};

//Right Viewport : Visuzlize Voxelized Mesh
var l_rightMenu = {id:"ID_VIEW_RIGHT", view:"template"};

//Log Menuv
var l_logMenu = {id:"ID_LOG", view:"template", gravity:0.2};

var layout = new webix.ui({
  rows:[
    l_toolBar,
    {
      cols:[
        l_leftMenu,
        {view:"resizer"},
        l_rightMenu
      ]
    },
    {view:"resizer"},
    l_logMenu
  ]
})



//Initialize Manager
var Manager = new E_Manager();


///IO event
window.addEventListener("resize", function(){
  Manager.UpdateWindowSize();
  Manager.Redraw();
});

$$("ID_VIEW_LEFT").attachEvent("onViewResize", function(){
  Manager.UpdateWindowSize();
  Manager.Redraw();
});

$$("ID_VIEW_RIGHT").attachEvent("onViewResize", function(){
  Manager.UpdateWindowSize();
  Manager.Redraw();
});

$$("ID_LOG").attachEvent("onViewResize", function(){
  Manager.UpdateWindowSize();
  Manager.Redraw();
});



$$("ID_TOGGLE_TRAINNING").attachEvent("onItemClick", function(id){
  Manager.OnRunTrainning(this.getValue());
});

$$("ID_TOGGLE_CALIBRATION").attachEvent("onItemClick", function(id){
  Manager.OnRunCalibration(this.getValue());
});

$$("ID_TOGGLE_NNCALIB").attachEvent("onItemClick", function(id){
  Manager.OnNNCalibration(this.getValue());
});

$$("ID_BUTTON_GROUND_TRUTH").attachEvent("onItemClick", function(id){
  Manager.CalibrateGround();
});



$(window).mouseup(function(event){
  Manager.renderer[0].interactor.onMouseUp(event);
});

$(window).keydown(function(event){
  Manager.renderer[0].interactor.onKeyboardDown(event);
});

$(window).keyup(function(event){
  Manager.renderer[0].interactor.onKeyboardUp(event);
});

},{"./E_Manager.js":9}],12:[function(require,module,exports){
var deepqlearn = deepqlearn || { REVISION: 'ALPHA' };

(function(global) {

  var convnetjs = require('convnetjs');
  var cnnutil = require('convnetjs/build/util.js');

  "use strict";

  // An agent is in state0 and does action0
  // environment then assigns reward0 and provides new state, state1
  // Experience nodes store all this information, which is used in the
  // Q-learning update step
  var Experience = function(state0, action0, reward0, state1) {
    this.state0 = state0;
    this.action0 = action0;
    this.reward0 = reward0;
    this.state1 = state1;
  }

  // A Brain object does all the magic.
  // over time it receives some inputs and some rewards
  // and its job is to set the outputs to maximize the expected reward
  var Brain = function(num_states, num_actions, opt) {
    var opt = opt || {};
    // in number of time steps, of temporal memory
    // the ACTUAL input to the net will be (x,a) temporal_window times, and followed by current x
    // so to have no information from previous time step going into value function, set to 0.
    this.temporal_window = typeof opt.temporal_window !== 'undefined' ? opt.temporal_window : 1;
    // size of experience replay memory
    this.experience_size = typeof opt.experience_size !== 'undefined' ? opt.experience_size : 30000;
    // number of examples in experience replay memory before we begin learning
    this.start_learn_threshold = typeof opt.start_learn_threshold !== 'undefined'? opt.start_learn_threshold : Math.floor(Math.min(this.experience_size*0.1, 1000));
    // gamma is a crucial parameter that controls how much plan-ahead the agent does. In [0,1]
    this.gamma = typeof opt.gamma !== 'undefined' ? opt.gamma : 0.8;

    // number of steps we will learn for
    this.learning_steps_total = typeof opt.learning_steps_total !== 'undefined' ? opt.learning_steps_total : 100000;
    // how many steps of the above to perform only random actions (in the beginning)?
    this.learning_steps_burnin = typeof opt.learning_steps_burnin !== 'undefined' ? opt.learning_steps_burnin : 3000;
    // what epsilon value do we bottom out on? 0.0 => purely deterministic policy at end
    this.epsilon_min = typeof opt.epsilon_min !== 'undefined' ? opt.epsilon_min : 0.05;
    // what epsilon to use at test time? (i.e. when learning is disabled)
    this.epsilon_test_time = typeof opt.epsilon_test_time !== 'undefined' ? opt.epsilon_test_time : 0.01;

    // advanced feature. Sometimes a random action should be biased towards some values
    // for example in flappy bird, we may want to choose to not flap more often
    if(typeof opt.random_action_distribution !== 'undefined') {
      // this better sum to 1 by the way, and be of length this.num_actions
      this.random_action_distribution = opt.random_action_distribution;
      if(this.random_action_distribution.length !== num_actions) {
        console.log('TROUBLE. random_action_distribution should be same length as num_actions.');
      }
      var a = this.random_action_distribution;
      var s = 0.0; for(var k=0;k<a.length;k++) { s+= a[k]; }
      if(Math.abs(s-1.0)>0.0001) { console.log('TROUBLE. random_action_distribution should sum to 1!'); }
    } else {
      this.random_action_distribution = [];
    }

    // states that go into neural net to predict optimal action look as
    // x0,a0,x1,a1,x2,a2,...xt
    // this variable controls the size of that temporal window. Actions are
    // encoded as 1-of-k hot vectors
    this.net_inputs = num_states * this.temporal_window + num_actions * this.temporal_window + num_states;
    this.num_states = num_states;
    this.num_actions = num_actions;
    this.window_size = Math.max(this.temporal_window, 2); // must be at least 2, but if we want more context even more
    this.state_window = new Array(this.window_size);
    this.action_window = new Array(this.window_size);
    this.reward_window = new Array(this.window_size);
    this.net_window = new Array(this.window_size);

    // create [state -> value of all possible actions] modeling net for the value function
    var layer_defs = [];
    if(typeof opt.layer_defs !== 'undefined') {
      // this is an advanced usage feature, because size of the input to the network, and number of
      // actions must check out. This is not very pretty Object Oriented programming but I can't see
      // a way out of it :(
      layer_defs = opt.layer_defs;
      if(layer_defs.length < 2) { console.log('TROUBLE! must have at least 2 layers'); }
      if(layer_defs[0].type !== 'input') { console.log('TROUBLE! first layer must be input layer!'); }
      if(layer_defs[layer_defs.length-1].type !== 'regression') { console.log('TROUBLE! last layer must be input regression!'); }
      if(layer_defs[0].out_depth * layer_defs[0].out_sx * layer_defs[0].out_sy !== this.net_inputs) {
        console.log('TROUBLE! Number of inputs must be num_states * temporal_window + num_actions * temporal_window + num_states!');
      }
      if(layer_defs[layer_defs.length-1].num_neurons !== this.num_actions) {
        console.log('TROUBLE! Number of regression neurons should be num_actions!');
      }
    } else {
      // create a very simple neural net by default
      layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth:this.net_inputs});
      if(typeof opt.hidden_layer_sizes !== 'undefined') {
        // allow user to specify this via the option, for convenience
        var hl = opt.hidden_layer_sizes;
        for(var k=0;k<hl.length;k++) {
          layer_defs.push({type:'fc', num_neurons:hl[k], activation:'relu'}); // relu by default
        }
      }
      layer_defs.push({type:'regression', num_neurons:num_actions}); // value function output
    }
    this.value_net = new convnetjs.Net();
    this.value_net.makeLayers(layer_defs);

    // and finally we need a Temporal Difference Learning trainer!
    var tdtrainer_options = {learning_rate:0.01, momentum:0.0, batch_size:64, l2_decay:0.01};
    if(typeof opt.tdtrainer_options !== 'undefined') {
      tdtrainer_options = opt.tdtrainer_options; // allow user to overwrite this
    }
    this.tdtrainer = new convnetjs.SGDTrainer(this.value_net, tdtrainer_options);

    // experience replay
    this.experience = [];

    // various housekeeping variables
    this.age = 0; // incremented every backward()
    this.forward_passes = 0; // incremented every forward()
    this.epsilon = 1.0; // controls exploration exploitation tradeoff. Should be annealed over time
    this.latest_reward = 0;
    this.last_input_array = [];
    this.average_reward_window = new cnnutil.Window(1000, 10);
    this.average_loss_window = new cnnutil.Window(1000, 10);
    this.learning = true;
  }
  Brain.prototype = {
    random_action: function() {
      // a bit of a helper function. It returns a random action
      // we are abstracting this away because in future we may want to
      // do more sophisticated things. For example some actions could be more
      // or less likely at "rest"/default state.
      if(this.random_action_distribution.length === 0) {
        return convnetjs.randi(0, this.num_actions);
      } else {
        // okay, lets do some fancier sampling:
        var p = convnetjs.randf(0, 1.0);
        var cumprob = 0.0;
        for(var k=0;k<this.num_actions;k++) {
          cumprob += this.random_action_distribution[k];
          if(p < cumprob) { return k; }
        }
      }
    },
    policy: function(s) {
      // compute the value of doing any action in this state
      // and return the argmax action and its value
      var svol = new convnetjs.Vol(1, 1, this.net_inputs);
      svol.w = s;
      var action_values = this.value_net.forward(svol);
      var maxk = 0;
      var maxval = action_values.w[0];
      for(var k=1;k<this.num_actions;k++) {
        if(action_values.w[k] > maxval) { maxk = k; maxval = action_values.w[k]; }
      }
      return {action:maxk, value:maxval};
    },
    getNetInput: function(xt) {
      // return s = (x,a,x,a,x,a,xt) state vector.
      // It's a concatenation of last window_size (x,a) pairs and current state x
      var w = [];
      w = w.concat(xt); // start with current state
      // and now go backwards and append states and actions from history temporal_window times
      var n = this.window_size;
      for(var k=0;k<this.temporal_window;k++) {
        // state
        w = w.concat(this.state_window[n-1-k]);
        // action, encoded as 1-of-k indicator vector. We scale it up a bit because
        // we dont want weight regularization to undervalue this information, as it only exists once
        var action1ofk = new Array(this.num_actions);
        for(var q=0;q<this.num_actions;q++) action1ofk[q] = 0.0;
        action1ofk[this.action_window[n-1-k]] = 1.0*this.num_states;
        w = w.concat(action1ofk);
      }
      return w;
    },
    predict: function(input_array) {
      // compute forward (behavior) pass given the input neuron signals from body
      // this.forward_passes += 1;
      // this.last_input_array = input_array; // back this up

      // create network input
      var net_input = this.getNetInput(input_array);

      var maxact = this.policy(net_input);
      var action = maxact.action;

      return action;
    },
    forward: function(input_array) {
      // compute forward (behavior) pass given the input neuron signals from body
      this.forward_passes += 1;
      this.last_input_array = input_array; // back this up

      // create network input
      var action;
      if(this.forward_passes > this.temporal_window) {
        // we have enough to actually do something reasonable
        var net_input = this.getNetInput(input_array);
        if(this.learning) {
          // compute epsilon for the epsilon-greedy policy
          this.epsilon = Math.min(1.0, Math.max(this.epsilon_min, 1.0-(this.age - this.learning_steps_burnin)/(this.learning_steps_total - this.learning_steps_burnin)));
        } else {
          this.epsilon = this.epsilon_test_time; // use test-time value
        }
        var rf = convnetjs.randf(0,1);
        if(rf < this.epsilon) {
          // choose a random action with epsilon probability
          action = this.random_action();
        } else {
          // otherwise use our policy to make decision
          var maxact = this.policy(net_input);
          action = maxact.action;
       }
      } else {
        // pathological case that happens first few iterations
        // before we accumulate window_size inputs
        var net_input = [];
        action = this.random_action();
      }

      // remember the state and action we took for backward pass
      this.net_window.shift();
      this.net_window.push(net_input);
      this.state_window.shift();
      this.state_window.push(input_array);
      this.action_window.shift();
      this.action_window.push(action);

      return action;
    },
    backward: function(reward) {
      this.latest_reward = reward;
      this.average_reward_window.add(reward);
      this.reward_window.shift();
      this.reward_window.push(reward);

      if(!this.learning) { return; }

      // various book-keeping
      this.age += 1;

      // it is time t+1 and we have to store (s_t, a_t, r_t, s_{t+1}) as new experience
      // (given that an appropriate number of state measurements already exist, of course)
      if(this.forward_passes > this.temporal_window + 1) {
        var e = new Experience();
        var n = this.window_size;
        e.state0 = this.net_window[n-2];
        e.action0 = this.action_window[n-2];
        e.reward0 = this.reward_window[n-2];
        e.state1 = this.net_window[n-1];
        if(this.experience.length < this.experience_size) {
          this.experience.push(e);
        } else {
          // replace. finite memory!
          var ri = convnetjs.randi(0, this.experience_size);
          this.experience[ri] = e;
        }
      }

      // learn based on experience, once we have some samples to go on
      // this is where the magic happens...
      if(this.experience.length > this.start_learn_threshold) {
        var avcost = 0.0;
        for(var k=0;k < this.tdtrainer.batch_size;k++) {
          var re = convnetjs.randi(0, this.experience.length);
          var e = this.experience[re];
          var x = new convnetjs.Vol(1, 1, this.net_inputs);
          x.w = e.state0;
          var maxact = this.policy(e.state1);
          var r = e.reward0 + this.gamma * maxact.value;
          var ystruct = {dim: e.action0, val: r};
          var loss = this.tdtrainer.train(x, ystruct);
          avcost += loss.loss;
        }
        avcost = avcost/this.tdtrainer.batch_size;
        this.average_loss_window.add(avcost);
      }
    },
    visSelf: function(elt) {
      elt.innerHTML = ''; // erase elt first

      // elt is a DOM element that this function fills with brain-related information
      var brainvis = document.createElement('div');

      // basic information
      var desc = document.createElement('div');
      var t = '';
      t += 'experience replay size: ' + this.experience.length + '<br>';
      t += 'exploration epsilon: ' + this.epsilon + '<br>';
      t += 'age: ' + this.age + '<br>';
      t += 'average Q-learning loss: ' + this.average_loss_window.get_average() + '<br />';
      t += 'smooth-ish reward: ' + this.average_reward_window.get_average() + '<br />';
      desc.innerHTML = t;
      brainvis.appendChild(desc);

      elt.appendChild(brainvis);
    },
    getLog: function() {
      var t = '';
      t += 'experience replay size: ' + this.experience.length + '<br>';
      t += 'exploration epsilon: ' + this.epsilon + '<br>';
      t += 'age: ' + this.age + '<br>';
      t += 'average Q-learning loss: ' + this.average_loss_window.get_average() + '<br />';
      t += 'smooth-ish reward: ' + this.average_reward_window.get_average() + '<br />';
      return t;
    }
  }

  global.Brain = Brain;
})(deepqlearn);

(function(lib) {
  "use strict";
  if (typeof module === "undefined" || typeof module.exports === "undefined") {
    window.deepqlearn = lib; // in ordinary browser attach library to window
  } else {
    module.exports = lib; // in nodejs
  }
})(deepqlearn);

},{"convnetjs":1,"convnetjs/build/util.js":2}]},{},[11]);
