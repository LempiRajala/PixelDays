import * as Minio from 'minio'
import type { Stream } from "stream";
import "dotenv/config";

class MinioService {
  private _client: Promise<Minio.Client> | null = null;

  private async getClient() {
    if (this._client === null) {
      this._client = new Promise<Minio.Client>(async resolve => {
        const client = new Minio.Client({
          endPoint: process.env.MINIO_HOST!,
          port: +process.env.MINIO_PORT!,
          useSSL: false,
          accessKey: process.env.MINIO_ACCESS_KEY!,
          secretKey: process.env.MINIO_SECRET_KEY!,
        });

        const bucketName = process.env.MINIO_BUCKET!;
        const bucketExists = await client.bucketExists(bucketName);
        if(!bucketExists) {
          await client.makeBucket(bucketName, process.env.MINIO_REGION!);
          console.log(`created minio bucket "${bucketName}"`);
        
          await client.setBucketPolicy(bucketName, JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: [
                  's3:GetObject',
                  's3:GetObjectVersion'
                ],
                Resource: [
                  `arn:aws:s3:::${bucketName}/*`
                ]
              }
            ]
          }));
          console.log(`set policy for minio bucket "${bucketName}"`);
        }

        resolve(client);
      });
    }
    return this._client;
  }

  public async writeObject(
    filename: string,
    file: Pick<File, 'name' | 'type' | 'size'> & { buffer: Buffer },
  ) {
    const client = await this.getClient();
    client.putObject(
      process.env.MINIO_BUCKET!,
      filename,
      file.buffer,
      file.size,
      {
        'Content-Type': file.type,
      }
    );
  }

  public async getStream(filename: string) {
    try {
      const client = await this.getClient();
      return await client.getObject(process.env.MINIO_BUCKET!, filename);
    } catch (error) {
      if (isNoSuchKeyError(error)) {
        return null;
      }
      throw error;
    }
  }

  public async getBuffer(filename: string) {
    const stream = await this.getStream(filename);
    if (!stream) return null;
    return await streamToBuffer(stream);
  }
  
  public async getBase64(filename: string) {
    const buffer = await this.getBuffer(filename);
    if (!buffer) return null;
    return buffer.toString('base64');
  }
  
  public async getFileMetadata(filename: string) {
    const client = await this.getClient();
    return await client.statObject(process.env.MINIO_BUCKET!, filename);
  }
  
  public async objectExists(filename: string) {
    try {
      const client = await this.getClient();
      await client.statObject(process.env.MINIO_BUCKET!, filename);
      return true;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }
}

function streamToBuffer(stream: Stream): Promise<Buffer> {
  return new Promise<Buffer> ((resolve, reject) => {
    const _buf = Array<any> ();
    stream.on("data", chunk => _buf.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(_buf)));
    stream.on("error", err => reject(`error converting stream - ${err}`));
  });
}

function isNoSuchKeyError(error: any) {
  return error.code === 'NoSuchKey';
}

function isNotFoundError(error: any) {
  return error.code === 'NotFound';
}

export const minioService = new MinioService();