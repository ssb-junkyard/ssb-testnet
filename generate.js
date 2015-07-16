var sbot = require('scuttlebot')
var fs = require('fs')
var path = require('path')
var pull = require('pull-stream')
var paramap = require('pull-paramap')
var Blather = require('blather')

function markov (name) {
  var m = new Blather()
  var text = fs.readFileSync(path.join(__dirname, 'text', name+'.txt'), 'utf8')
  console.log(text.length)
  m.addText(text)
  return m
}

//some text sources from the front pages of project gutenburg
var markovs = {
  melville: markov('moby-dick'),
  twain   : markov('a-tale-of-two-cities'),
  wilde   : markov('picture-of-dorian-grey'),
  kafka   : markov('metamorphosis'),
  grim    : markov('grims-fairy-tales')
}

var keys = Object.keys(markovs)

var crypto = require('crypto')
var ssbKeys = require('ssb-keys')

function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var names = require('random-name')

function randomName(feed) {
  return names.first() + '_' + names.last()
}

function randA(feeds) {
  return feeds[~~(Math.random()*feeds.length)]
}

function addNames () {

  return paramap(function (feed, cb) {
    feed.name = randomName()
    feed.voice = keys.shift()
    keys.push(feed.voice)

    feed.add({
      type: 'contact',
      contact: {feed: feed.id},
      following: true,
      name: feed.name, voice: feed.voice
    }, function () { cb(null, feed) })
  })

}


function addMessage (feeds) {

  return paramap(function (feed, cb) {
    var random = Math.random()
    var f = randA(feeds)

    if(random < 0.5) //say something
      feed.add({
        type: 'post',
        text: markovs[feed.voice].paragraph()
      }, function (_, msg) {
        //track the latest message
        feed.msg = msg
        cb(null, msg)
      })
    if(random < 0.7) { //follow someone
      feed.add({
        type: 'contact',
        contact: {feed: f.id},
        name: f.name
      }, cb)
    }
    else { //reply to some one
      feed.add({
        type: 'post',
        repliesTo: f.msg ? {msg: f.msg.key} : undefined,
        text: markovs[feed.voice].sentence() + ' @' + f.id,
        mentions: [{feed: f.id}],
      }, function (_, msg) {
        //track the latest message
        feed.msg = msg
        cb(null, msg)
      })

    }
  })
}

var config = {
  feeds: 1500,
  messages: 200000,
  seed: 'generate test networks key, [add your own entropy here]'
}

function flowMeter (log, slice) {
  var count = 0, slice_count = 0, ts
  return pull.through(function (data) {
    count ++; slice_count++
    if(!ts) ts = Date.now()
    if(Date.now() > ts + slice) {
      log(count, slice_count, slice_count/slice)
      ts = Date.now(); slice_count = 0
    }
  })

}

function initFeed(feed) {
  feed.name = randomName()
  feed.voice = keys.shift()
  keys.push(feed.voice)
  return feed
}

module.exports = function (ssb, main, cb) {

  var count = 0, key = 0

  var root = hash(config.seed)

  var last = ''


  pull(
    pull.count(config.feeds),
    pull.map(function () {
      var keys = ssbKeys.generate('ed25519', hash(config.seed + ++key))
      var feed = initFeed(ssb.createFeed(keys))

      last = feed.id
      return feed
    }),
    addNames(),
    pull.collect(function (err, feeds) {
      if(err) throw err
      if(!feeds.length) throw new Error('feed generation failed')

      feeds.push(initFeed(main))

      pull(
        pull.count(config.messages),
        pull.map(function (n) {
          return randA(feeds)
        }),
        addMessage(feeds),
        flowMeter(console.log, 1000),
        pull.drain(null, cb)
      )

    })
  )

}

sbot.init(require('./config'), function (err, sbot) {
  module.exports(sbot.ssb, sbot.feed, function () {
    console.log('generated!')
    sbot.close()
    process.exit(0)
  })
})
