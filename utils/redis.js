#!/usr/bin/node
// RedisClient class
import redis from 'redis';
import util from 'util';

class RedisClient {
  constructor() {
    this.isConnected = true;
    this.client = redis.createClient()
      .on('error', (err) => {
	console.log(err);
	this.isConnected = false;
      });
    this.getAsync = util.promisify(this.client.get).bind(this.client);
  }

  isAlive = () => this.isConnected;
  get = async (key) => this.getAsync(key);
  set = async (key, value, duration) => this.client.setex(key, duration, value);
  del = async (key) => await this.client.del(key);
}

const redisClient = new RedisClient();
export default redisClient;
