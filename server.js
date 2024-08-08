// App server
import express from 'express';
import routesLoader from './routes/index';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
routesLoader(app);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
