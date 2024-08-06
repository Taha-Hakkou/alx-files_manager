#!/usr/bin/node
// Auth Controller
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import sha1 from 'sha1';
import {v4 as uuidv4} from 'uuid';
import {ObjectId} from 'mongodb';

const AuthController = class {
  static getConnect = async (req, res) => {
    const basicAuth = req.headers.authorization.split(' ')[1];
    const [email, password] = Buffer.from(basicAuth, 'base64').toString('utf8').split(':');
    const user = await dbClient.db.collection('users').findOne({
      'email': email,
      'password': sha1(password)
    });
    if (user === null) {
      res.status(401).json({'error': 'Unauthorized'});
    } else {
      const token = uuidv4();
      const key = `auth_${token}`;
      redisClient.set(key, user._id.toString(), 24 * 60 * 60 * 1000);
      res.status(200).json({'token': token});
    }
  }

  static getDisconnect = async (req, res) => {
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);
    const user = await dbClient.db.collection('users').findOne({'_id': ObjectId(userId)});
    if (user === null) {
      res.status(401).json({'error': 'Unauthorized'});
    } else {
      redisClient.del(`auth_${req.headers['x-token']}`);
      res.status(204).send();
    }
  }
}

export default AuthController;
