
const _ = require('lodash');
const Redis = require('ioredis');
const EventEmitter = require('events');

const META_DEFAULTS = {
  block_prefix: 'blocks:block:',
  snapshot_prefix: 'snapshots:snapshot:'
};

class RedisAppender extends EventEmitter {

  constructor(options={}) {
    super();
    this.options = options;
    this.meta = _.merge(META_DEFAULTS, options.meta);
    this.redis_client = new Redis(this.options);

    this.redis_client.on('ready', () => this.emit('ready', this));
    this.redis_client.on('error', err => this.emit('error', err));
  }

  getLatestSnapshot(){
    return this.redis_client
      .lrange(this.meta.snapshot_prefix + 'snapshots', 0, Number.MAX_SAFE_INTEGER)
      .then(snapshots => snapshots.pop());
  }

  pushBlock(block){
    let store_block = {
      id: block.id,
      transaction: block.transaction,
      timestamp: block.timestamp,
    };

    return this.redis_client
      .pipeline()
      .set(this.meta.block_prefix + block.id, JSON.stringify(store_block))
      .lpush(this.meta.block_prefix + 'stack', block.id)
      .exec();
  }

  pushSnapshot(snapshot){
    let store_snapshot = {
      id: snapshot.id,
      state: snapshot.state,
      timestamp: snapshot.timestamp,
      block: snapshot.block
    };

    return this.redis_client
      .pipeline()
      .set(this.meta.snapshot_prefix + snapshot.id, JSON.stringify(store_snapshot))
      .lpush(this.meta.snapshot_prefix + 'snapshots', snapshot.id)
      .exec();
  }

  loadBlocks(blocks){
    var redis_client = this.redis_client;
    var block_prefix = this.meta.block_prefix;

    const blockchain = [];

    return new Promise((resolve, reject) => {
      (function loadBlock(){
        let block_id = blocks.pop();
        if(block_id){
          redis_client.get(block_prefix + block_id)
            .then(rawBlock => JSON.parse(rawBlock))
            .then(block => blockchain.push(block))
            .then(loadBlock)
            .catch(reject);
        } else {
          resolve(blockchain);
        }
      })();
    });
  }

  loadSnapshot(snapshot_id){
    return this.redis_client
      .get(this.meta.snapshot_prefix + snapshot_id)
      .then(rawSnapshot => JSON.parse(rawSnapshot));
  }

  load(){
    return this.getLatestSnapshot()
      .then(snapshotId => this.loadSnapshot(snapshotId))
      .then(snapshot =>
        this.redis_client.lrange(this.meta.block_prefix + 'stack', 0, Number.MAX_SAFE_INTEGER)
          .then(blocks => {
            if(snapshot)
              return blocks.slice(0, blocks.indexOf(snapshot.block));
            else
              return blocks;
          })
          .then(blocks => this.loadBlocks(blocks))
          .then(blockchain => {
            if(snapshot)
              return { blockchain, state: snapshot.state };
            else
              return { blockchain };
          })
      );
  }

}

module.exports = RedisAppender;