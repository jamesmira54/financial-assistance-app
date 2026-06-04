import cors from "cors";
import express from "express";
import routes from "./routes";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/v1', routes);

export default app;
