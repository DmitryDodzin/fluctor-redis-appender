
const chai = require('chai');
const expect = chai.expect;

const Redis = require('ioredis');

const { Appender } = require('../index');


const initialSnapshot = {
  id: "dd8457fd-d543-4221-abc0-a0039f958d45",
  state: { value: 1 },
  timestamp: Date.now()
};

const fistBlock = {
  id: "98a87d3d-6a1a-40af-a370-0bdd98c058d0",
  transaction: [],
  timestamp: Date.now() - 100
};

const secondBlock = {
  id: "f2af27fa-6148-4b85-afb6-d9bae4c5a980",
  transaction: [],
  timestamp: Date.now() + 100
};

describe('Loading', () => {

  let redisClient; 
  let redisAppender;

  before(done => {
    redisClient = new Redis();

    redisClient.on('ready', () =>
       redisClient.flushall(() => {
        console.log('    Database flushed');
        redisClient
          .pipeline()
          .set('snapshots:snapshot:' + initialSnapshot.id, JSON.stringify(initialSnapshot))
          .lpush('snapshots:snapshot:snapshots', initialSnapshot.id)
          .set('blocks:block:' + fistBlock.id, JSON.stringify(fistBlock))
          .set('blocks:block:' + secondBlock.id, JSON.stringify(secondBlock))
          .lpush('blocks:block:stack', fistBlock.id)
          .lpush('blocks:block:stack', secondBlock.id)
          .exec()
          .then(() => done());
        })
    );

    redisClient.on('error', err => done(err));
  });

  before(done => {
    redisAppender = new Appender();

    redisAppender.on('ready', () => done());
    redisAppender.on('error', err => done(err));
  });

  it('Latest', done => {
    redisAppender.load()
      .then(({ state, blockchain }) => {
        expect(state).to.deep.equal(initialSnapshot.state);
        expect(blockchain).to.deep.equal([secondBlock]);

        done();
      })
      .catch(err => done(err));
  });

  after(() => {
    redisClient.quit();
  });
});
