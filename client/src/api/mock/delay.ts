export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const jitter = (min: number, max: number) => min + Math.random() * (max - min);
