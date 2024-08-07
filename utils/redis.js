#!/usr/bin/node
// RedisClient class
import redis from 'redis';
import util from 'util';

const RedisClient = class {
  constructor() {
    this.isConnected = true;
    this.client = redis.createClient()
      .on('error', (err) => {
        console.log(err);
        this.isConnected = false;
      });
    this.getAsync = util.promisify(this.client.get).bind(this.client);
  }

  isAlive() { return this.isConnected; }

  async get(key) { return this.getAsync(key); }

  async set(key, value, duration) { return this.client.setex(key, duration, value); }

  async del(key) {
    const result = await this.client.del(key);
    return result;
  }
};

const redisClient = new RedisClient();
export default redisClient;
