var argv = require('optimist').argv
  , FeedParser = require('feedparser')
  , request = require('request')
  , utils = require('./utils');

// setup

var app
  , appConfig = utils.readJsonSync('config/app.json')
  , port = argv.port || 4002
  , httpProxy = argv.http_proxy || null
  , apiBase = argv.api_base || 'http://localhost:4000'
  , itemsToProcessRss = 5
  , itemsToProcessSchedule = 5;

if (!process.env.NODE_ENV) {
  throw('NODE_ENV is not set');
}
environment = process.env.NODE_ENV;

function getRss(url, callback) {
  var feedParser = new FeedParser()
    , thumb;

  request({
    url: url,
    proxy: httpProxy
  })
    .on('error', function(error) {
      console.log('request error', error);
      callback(false);
    })
    .pipe(feedParser)
    .on('error', function(error) {
      console.log('FeedParser error', error);
      callback(false);
    })
    .on('data', function (data) {
      //console.log('data');
    })
    .on('end', function () {
      var index
        , item
        , maxItems = feedParser.nodes.channel.item.length > itemsToProcessRss ? itemsToProcessRss : feedParser.nodes.channel.item.length
        , result
        , results = [];
      for (index=0; index<maxItems; index++) {
        item = feedParser.nodes.channel.item[index];
        result = {
          title: item.title['#'],
          description: item.description['#'],
          date: item.pubdate['#'],
          guid: item.guid['#'],
          link: item.guid['#'],
          image: null
        };

        if (item['media:thumbnail']) {
          thumb = item['media:thumbnail'].length ? item['media:thumbnail'][0] : item['media:thumbnail'];
          if (thumb['@']) {
            result.image = thumb['@'].url;
          } else {
            result.image = thumb[0];
          }
        }
        results.push(result);
      };
      callback(results);
    });
};

function getSchedule(url, callback) {
  request({
    url: url,
    proxy: httpProxy
  }, function(error, response, body) {
    if (error) {
      callback(false);
      return;
    }
    var broadcasts
      , index
      , broadcast
      , maxItems
      , result
      , results = [];

    try {
      broadcasts = JSON.parse(body).episodes;
    } catch(e) {
      console.log(e);
      callback(false);
      return;
    }

    maxItems = broadcasts.length > itemsToProcessSchedule ? itemsToProcessSchedule : broadcasts.length;

    for (index=0; index<maxItems; index++) {
      broadcast = broadcasts[index];
      result = {
        title: broadcast.programme.display_titles.title +' ' +broadcast.programme.display_titles.subtitle,
        description: broadcast.programme.short_synopsis,
        date: new Date(broadcast.programme.actual_start),
        guid: broadcast.programme.pid,
        link: 'http://www.bbc.co.uk/programmes/' +broadcast.programme.pid,
        image: 'http://ichef.bbci.co.uk/images/ic/272x153/legacy/episode/' +broadcast.programme.pid +'.jpg?nodefault=true'
      };
      results.push(result);
    };
    callback(results);
  });
};


function scrapeResource(resource) {

  function saveArticles(resource, articles) {
    request.post({
      url: apiBase +'/articles/ingest',
      followRedirects: true,
      json: articles
    })
      .on('error', function(error) {
        console.log('request PUT error', error);
      })
      .on('end', function(result) {
        console.log('request PUT end');
        getNextResource();
      });
  }

  if ('rss' === resource.type) {
    console.log('rss resource.url', resource.url);
    getRss(resource.url, function(results) {
      if (false !== results) {
        results.forEach(function(result){
          result.type = "article",
          result.product = resource.product;
          result.section = resource.section;
        });
        saveArticles(resource, results);
      }
    });
  } else if ('schedule' === resource.type) {
    console.log('schedule resource.url', resource.url);
    getSchedule(resource.url, function(results) {
      if (false !== results) {
        results.forEach(function(result){
          result.type = "programme",
          result.product = resource.product;
          result.section = resource.section;
        });
        saveArticles(resource, results);
      }
    });
  } else {
    getNextResource();
  }
}


var noOfResourcesRemaining = appConfig.resources.length

function getNextResource() {
  noOfResourcesRemaining--;
  if (-1 === noOfResourcesRemaining) {
    setTimeout(function(){
      noOfResourcesRemaining = appConfig.resources.length;
      getNextResource();
    }, 300000);
  } else {
    scrapeResource(appConfig.resources[noOfResourcesRemaining]);
  }
}
getNextResource();
