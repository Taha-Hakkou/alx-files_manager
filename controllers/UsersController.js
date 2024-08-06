#!/usr/bin/node
// Users Controller
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import sha1 from 'sha1';
import {ObjectId} from 'mongodb';
import Queue from 'bull';

const userQueue = Queue('users manager');

const UsersController = class {
  static postNew = async (req, res) => {
    const {email, password} = req.body;
    if (!email) {
      res.status(400).json({'error': 'Missing email'});
    } else if (!password) {
      res.status(400).json({'error': 'Missing password'});
    }
    let user = await dbClient.db.collection('users').findOne({'email': email});
    if (user !== null) {
      res.status(400).json({'error': 'Already exist'});
    } else {
      const result = await dbClient.db.collection('users').insertOne({
        'email': email,
	'password': sha1(password)
      });
      userQueue.add({'userId': result.insertedId});
      user = await dbClient.db.collection('users').findOne({'email': email});
      res.status(201).json({
        'id': user._id,
	'email': user.email
      });
    }
  }

  static getMe = async (req, res) => {
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);
    const user = await dbClient.db.collection('users').findOne({'_id': ObjectId(userId)});
    if (user === null) {
      res.status(401).json({'error': 'Unauthorized'});
    } else {
      res.json({
        'id': user._id,
	'email': user.email
      });
    }
  }
}

export default UsersController;
