#!/usr/bin/node
// Processes the files queue for generating thumbnails
import Queue from 'bull';
import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import { promises as fsPromises } from 'fs';
import dbClient from './utils/db';

const fileQueue = new Queue('image thumbnails');
const userQueue = new Queue('users manager');

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;
  if (!fileId) done(new Error('Missing fileId'));
  if (!userId) done(new Error('Missing userId'));
  const file = await dbClient.db.collection('files').findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });
  if (file === null) done(new Error('File not found'));
  const widths = [500, 250, 100];
  widths.forEach(async (width) => {
    try {
      const thumbnail = await imageThumbnail(file.localPath, { width });
      await fsPromises.writeFile(`${file.localPath}_${width}`, thumbnail);
    } catch (err) {
      console.log(err.message);
    }
  });
  done();
});

userQueue.process(async (job, done) => {
  const { userId } = job.data;
  if (!userId) done(new Error('Missing userId'));
  const file = await dbClient.db.collection('files').findOne({ userId: ObjectId(userId) });
  if (file === null) done(new Error('User not found'));
  const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
  console.log(`Welcome ${user.email}!`);
  done();
});
