#!/usr/bin/node
// App controller
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const AppController = class {
  static getStatus = (_req, res) => {
    res.status(200).json({
      'redis': redisClient.isAlive(),
      'db': dbClient.isAlive()
    });
  }

  static getStats = async (_req, res) => {
    res.status(200).json({
      'users': await dbClient.nbUsers(),
      'files': await dbClient.nbFiles()
    });
  }
}

export default AppController;
