var fs = require('fs')
  , url = require('url')
  , http = require('http');

exports.readJsonSync = function(file) {
  return JSON.parse(fs.readFileSync(file));
};

exports.getHttp = function(options, callback) {
  var req = http.request(options, function(res) {
    var str = ''
      , json;
    res.on('data', function (chunk) {
      str += chunk;
    });
    res.on('end', function () {
      callback(str);;
    });
  });
  req.on('error', function(e) {
    console.log('Request error: ' + e.message);
    callback(false);
    return;
  });
  req.end();
};

exports.getJson = function(options, callback) {
  exports.getHttp(options, function(result) {
    if (false === result) {
      callback(false);
      return;
    }
    try {
      result = JSON.parse(result)
    } catch (e) {
      callback(false);
      return;
    }
    callback(result);
  });
};

exports.getHttpOptions = function(uri, proxyUri) {
  var options = {headers:{}}
    , uri = url.parse(uri)
    , header;

  if (proxyUri) proxyUri = url.parse(proxyUri);

  options.protocol = uri.protocol || 'http:';
  options.hostname = uri.hostname || 'localhost';
  options.port = uri.port || null;
  options.path = uri.path || '/';

  if (proxyUri && proxyUri.hostname) {
    options.path = options.protocol +'//' +uri.hostname + uri.path;
    options.hostname = proxyUri.hostname;
    options.headers.Host = uri.hostname;
    options.port = proxyUri.port | null;
  }
  return options;
};
