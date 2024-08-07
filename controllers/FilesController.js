#!/usr/bin/node
// Files Controller
import { ObjectId } from 'mongodb';
import fs, { promises as fsPromises } from 'fs';
// import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import Queue from 'bull';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const fileQueue = new Queue('image thumbnails');

const FilesController = class {
  static async postUpload(req, res) {
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (user === null) res.status(401).json({ error: 'Unauthorized' });
    const {
      name,
      type,
      parentId,
      isPublic,
      data,
    } = req.body;
    const validTypes = ['folder', 'file', 'image'];
    if (!name) {
      res.status(400).json({ error: 'Missing name' });
    } else if (!type || !validTypes.includes(type)) {
      res.status(400).json({ error: 'Missing type' });
    } else if (!data && type !== 'folder') {
      res.status(400).json({ error: 'Missing data' });
    } else {
      if (parentId) {
        const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
        if (!file) {
          res.status(400).json({ error: 'Parent not found' });
        } else if (file.type !== 'folder') {
          res.status(400).json({ error: 'Parent is not a folder' });
        }
      }
      const query = {
        userId: ObjectId(userId),
        name,
        type,
        parentId: parentId ? ObjectId(parentId) : '0',
      };
      if (type !== 'folder') {
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
        const localPath = `${folderPath}/${uuidv4()}`;
        const content = Buffer.from(data, 'base64').toString('utf8');
        await fsPromises.mkdir(folderPath, { recursive: true });
        await fsPromises.writeFile(localPath, content);
        query.isPublic = isPublic || false;
        query.localPath = localPath;
      }
      const result = await dbClient.db.collection('files').insertOne(query);
      if (type === 'image') {
        fileQueue.add({
          fileId: ObjectId(result.insertedId),
          userId,
        });
      }
      res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId || 0,
      });
    }
  }

  static async getShow(req, res) {
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (user === null) res.status(401).json({ error: 'Unauthorized' });
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(req.params.id),
      userId: ObjectId(userId),
    });
    if (file === null) res.status(404).json({ error: 'Not found' });
    res.json({
      id: file._id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (user === null) res.status(401).json({ error: 'Unauthorized' });
    let { parentId, page } = req.query;
    parentId = parentId ? ObjectId(parentId) : '0';
    page = page ? Number(page) : 0;
    const folder = await dbClient.db.collection('files').findOne({
      _id: parentId,
      userId: ObjectId(userId),
      type: 'folder',
    });
    if (folder === null && parentId !== '0') res.json([]);
    const files = await dbClient.db.collection('files').aggregate([
      { $match: { parentId } },
      { $skip: page * 20 },
      { $limit: 20 },
    ]).toArray();
    res.json(files);
  }

  static async putPublish(req, res) {
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (user === null) res.status(401).json({ error: 'Unauthorized' });
    let file = await dbClient.db.collection('files').findOne({
      userId: ObjectId(userId),
      _id: ObjectId(req.params.id),
    });
    if (file === null) res.status(404).json({ error: 'Not found' });
    file = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: ObjectId(file._id) },
      { $set: { isPublic: true } },
      { returnDocument: 'after' },
    );
    file = file.value;
    const { _id, localPath, ...pfile } = file;
    res.status(200).json({ id: file._id, ...pfile });
  }

  static async putUnpublish(req, res) {
    // same as putPublish just isPublic to false
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (user === null) res.status(401).json({ error: 'Unauthorized' });
    let file = await dbClient.db.collection('files').findOne({
      userId: ObjectId(userId),
      _id: ObjectId(req.params.id),
    });
    if (file === null) res.status(404).json({ error: 'Not found' });
    file = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: ObjectId(file._id) },
      { $set: { isPublic: false } },
      { returnDocument: 'after' },
    );
    file = file.value;
    const { _id, localPath, ...pfile } = file;
    res.status(200).json({ id: file._id, ...pfile });
  }

  static async getFile(req, res) {
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(req.params.id),
    });
    if (file === null) res.status(404).json({ error: 'Not found' });
    if (!file.isPublic) {
      const userId = await redisClient.get(`auth_${req.headers['x-token']}`);
      if (userId === null || userId !== file.userId.toString()) res.status(404).json({ error: 'Not found' });
    }
    if (file.type === 'folder') res.status(400).json({ error: 'A folder doesn\'t have content' });
    const filePath = file.type === 'image' ? `${file.localPath}_${req.query.size}` : file.localPath;
    if (!fs.existsSync(filePath)) res.status(404).json({ error: 'Not found' });
    res.setHeader('content-type', mime.lookup(file.name));
    const content = await fsPromises.readFile(file.localPath, 'utf8');
    if (file.type === 'file') {
      res.send(content);
    } else {
      res.sendFile(filePath);
    }
  }
};

export default FilesController;
