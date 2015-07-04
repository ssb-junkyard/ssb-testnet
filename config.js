var path = require('path')
var home = require('osenv').home

module.exports = require('rc')('ssb-testnet', {
  //just use an ipv4 address by default.
  //there have been some reports of seemingly non-private
  //ipv6 addresses being returned and not working.
  //https://github.com/ssbc/scuttlebot/pull/102
  host: 'localhost',
  port: 8009,
  timeout: 1000,
  pub: true,
  local: true,
  phoenix: true,
  friends: {
    dunbar: 150,
    hops: 3
  },
  gossip: {
    connections: 2
  },
  path: path.join(home(), '.testnet')
})
