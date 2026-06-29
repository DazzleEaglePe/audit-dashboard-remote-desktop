"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("@next/env");
const dev = process.env.NODE_ENV !== "production";
(0, env_1.loadEnvConfig)(process.cwd(), dev);
