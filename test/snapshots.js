
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;

const Redis = require('ioredis');

const { Appender } = require('../index');


const initialSnapshot = {
  id: "dd8457fd-d543-4221-abc0-a0039f958d45",
  state: { value: 1 },
  timestamp: Date.now(),
  block: "98a87d3d-6a1a-40af-a370-0bdd98c058d0"
};

const initialBlock = {
  id: "98a87d3d-6a1a-40af-a370-0bdd98c058d0",
  transaction: [],
  timestamp: Date.now() - 100
};

describe('Snapshots', () => {

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
          .set('blocks:block:' + initialBlock.id, JSON.stringify(initialBlock))
          .lpush('blocks:block:stack', initialBlock.id)
          .exec()
          .then(() => done())      
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
    expect(redisAppender.getLatestSnapshot())
      .to.be.fulfilled.and
      .to.eventually.equal(initialSnapshot.id)
      .and.notify(done);
  });

  it('Push', done => {
    expect(redisAppender.getLatestSnapshot())
      .to.eventually.equal(initialSnapshot.id)
      .and.notify(done);
  });

  it('Append', done => {

    let snapshot = {
      id: '24e475cf-5f19-4e3b-83ed-e7c157c1b9eb',
      state: { value: 2 },
      timestamp: Date.now(),
      block: "98a87d3d-6a1a-40af-a370-0bdd98c058d0",
      fake: 'keys',
      to: {
        fool: 'the system'
      }
    };

    const checkSnapshot = () => 
      redisClient
        .pipeline()
        .get('snapshots:snapshot:' + snapshot.id)
        .lrange('snapshots:snapshot:snapshots', 0, Number.MAX_SAFE_INTEGER)
        .exec()
        .then(result => {
          let snapshot = JSON.parse(result[0][1]);
          expect(snapshot).to.deep.equal({
            id: snapshot.id,
            state: snapshot.state,
            timestamp: snapshot.timestamp,
            block: snapshot.block
          });

          let snapshots = result[1][1];
          expect(snapshots).to.contain(snapshot.id);
        });

    redisAppender
      .pushSnapshot(snapshot)
      .then(checkSnapshot)
      .then(() => done())
      .catch(err => done(err));
  });

    it('Load', done => {

    let snapshot1 = { id: '156001ff-10d3-465b-a380-179a1895497b', state: {  value: 3 }, timestamp: Date.now() };

    redisClient
      .pipeline()
      .set('snapshots:snapshot:' + snapshot1.id, JSON.stringify(snapshot1))
      .lpush('snapshots:snapshot:snapshots', snapshot1.id)
      .exec()
      .then(() => 
        redisAppender.loadSnapshot(snapshot1.id)
          .then(snapshot => expect(snapshot).to.deep.equal(snapshot1))
      )
      .then(() => done())
      .catch(err => done(err));

  });

  after(() => {
    redisClient.quit();
  });
});
