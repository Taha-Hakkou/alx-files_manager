#!/usr/bin/node
// DBClient class
import {MongoClient} from 'mongodb';

const DBClient = class {
  constructor() {
    const HOST = process.env.DB_HOST || 'localhost';
    const PORT = process.env.DB_PORT || 27017;
    const DB = process.env.DB_DATABASE || 'files_manager';
    const uri = `mongodb://${HOST}:${PORT}`;
    this.client = new MongoClient(uri, {useUnifiedTopology: true});
    (async () => {
      await this.client.connect();
      this.db = await this.client.db(DB);
    })();
  }

  isAlive = () => Boolean(this.db); // this.client.isConnected(); [Deprecated]
  nbUsers = async () => await this.db.collection('users').countDocuments();
  nbFiles = async () => await this.db.collection('files').countDocuments();
}

const dbClient = new DBClient();
export default dbClient;
