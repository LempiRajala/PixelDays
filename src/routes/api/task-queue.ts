type HandlerFunction<Args extends any[], Return> = (...args: Args) => Promise<Return> | Return;

export class TaskQueue<Args extends any[], Return> {
  private queue: Array<{
    args: Args;
    resolve: (value: Return | PromiseLike<Return>) => void;
    reject: (reason?: any) => void;
  }> = [];
  private isProcessing = false;
  
  public get length(): number {
    return this.queue.length;
  }
  
  constructor(
    private handler: HandlerFunction<Args, Return>
  ) {}
  
  public async add(...args: Args): Promise<Return> {
    return new Promise<Return>((resolve, reject) => {
      this.queue.push({ args, resolve, reject });
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (true) {
      const task = this.queue.shift();
      if(!task) break;
      
      try {
        const result = await this.handler(...task.args);
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      }
    }
    
    this.isProcessing = false;
  }
  
  public clear(): void {
    this.queue = [];
  }
}