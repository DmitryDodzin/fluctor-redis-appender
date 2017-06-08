
const chai = require('chai');
const expect = chai.expect;

const Redis = require('ioredis');

const { Appender } = require('../index');


describe('Blocks', () => {

  let redisClient; 
  let redisAppender;

  before(done => {
    redisClient = new Redis();

    redisClient.on('ready', () =>
      redisClient.flushall(() => {
        console.log('    Database flushed');
        done();
      })
    );
  });

  before(done => {
    redisAppender = new Appender();

    redisAppender.on('ready', () => done());
    redisAppender.on('error', err => done(err));
  });

  it('Append', done => {

    let block = {
      id: '24e475cf-5f19-4e3b-83ed-e7c157c1b9eb',
      transaction: [],
      timestamp: Date.now(),
      fake: 'keys',
      to: {
        fool: 'the system'
      }
    };

    const checkBlock = () => 
      redisClient
        .pipeline()
        .get('blocks:block:' + block.id)
        .lrange('blocks:block:stack', 0, Number.MAX_SAFE_INTEGER)
        .exec()
        .then(result => {
          let block = JSON.parse(result[0][1]);
          expect(block).to.deep.equal({
            id: block.id,
            transaction: block.transaction,
            timestamp: block.timestamp
          });

          let blocks = result[1][1];
          expect(blocks).to.contain(block.id);
        });

    redisAppender
      .pushBlock(block)
      .then(checkBlock)
      .then(() => done())
      .catch(err => done(err));
  });

  it('Load', done => {

    let block1 = { id: '156001ff-10d3-465b-a380-179a1895497b', transaction: ['some fake data for 1'], timestamp: Date.now() };
    let block2 = { id: '296dddc2-a419-4461-8046-335045314490', transaction: ['some fake data for 2'], timestamp: Date.now() };
    let block3 = { id: '33ce42a7-2d0e-4d45-84fc-cef70e49313d', transaction: ['some fake data for 3'], timestamp: Date.now() };

    redisClient
      .pipeline()
      .set('blocks:block:' + block1.id, JSON.stringify(block1))
      .set('blocks:block:' + block2.id, JSON.stringify(block2))
      .set('blocks:block:' + block3.id, JSON.stringify(block3))
      .lpush('blocks:block:stack', block1.id)
      .lpush('blocks:block:stack', block2.id)
      .lpush('blocks:block:stack', block3.id)
      .exec()
      .then(() => 
        redisAppender.loadBlocks([block1.id, block2.id, block3.id])
          .then(blockchain => expect(blockchain).to.deep.equal([block3, block2, block1]))
      )
      .then(() => done())
      .catch(err => done(err));

  });

  after(() => {
    redisClient.quit();
  });
});
