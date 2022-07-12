import { Request } from 'express';

export async function parseExpressRequestBody(req: Request): Promise<any> {
    return new Promise((resolve) => {
        let buffer: any[] = [];
        req.on('data', (chunk) => {
            buffer.push(chunk);
        }).on('end', () => {
            const str = Buffer.concat(buffer).toString();
            const obj = JSON.parse(str);
            resolve(obj);
        });
    })

}