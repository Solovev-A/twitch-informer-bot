import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV}`) });

console.log(process.env.PORT);