import { OnApplicationBootstrap } from '@nestjs/common';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';

import { CronJob } from 'cron';

import { ContextStorage } from '@/core/logger/context-storage';
import { FrameworkLogger } from '@/core/logger/framework-logger';

export abstract class CronJobAbstract implements OnApplicationBootstrap {
  private isRunning: boolean = false; // 중복 실행 방지 플래그
  protected logger!: FrameworkLogger;

  protected constructor(
    protected readonly schedulerRegistry: SchedulerRegistry,
    protected readonly cronExpression: string = CronExpression.EVERY_MINUTE,
    protected readonly withoutOverlapping: boolean = true,
  ) {
    Object.freeze(this.onApplicationBootstrap);
  }

  protected abstract handleJob(): Promise<void>;

  // 모듈 초기화 시 스케줄링 작업 등록
  onApplicationBootstrap() {
    this.logger = new FrameworkLogger(this.constructor.name);
    this.logger.debug(`Cron job is initialized: ${this.cronExpression}`, this.constructor.name);

    const job = new CronJob(this.cronExpression, async () => {
      await ContextStorage.getContextStorage().run(ContextStorage.generateContext(), async () => {
        if (this.withoutOverlapping && this.isRunning) {
          this.logger.warn('Job is already running, skipping this execution', this.constructor.name);
          return;
        } else this.logger.debug('Job is running', this.constructor.name);

        this.isRunning = true;

        try {
          await this.handleJob();
        } catch (error) {
          this.logger.error('An error occurred while executing the task', this.constructor.name, error);
        } finally {
          this.isRunning = false;
          this.logger.debug('Job is done', this.constructor.name);
        }
      });
    });

    this.schedulerRegistry.addCronJob(this.constructor.name, job as CronJob);
    job.start();
  }
}
